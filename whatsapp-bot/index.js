require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize WhatsApp Client
let waClient = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

waClient.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
});

waClient.on('authenticated', () => {
    console.log('WhatsApp Client authenticated successfully!');
});

waClient.on('ready', () => {
    console.log('WhatsApp Client is ready and connected!');
});

waClient.on('auth_failure', (msg) => {
    console.error('WhatsApp Auth Failure', msg);
});

waClient.on('disconnected', async (reason) => {
    console.log('WhatsApp disconnected', reason);
    try {
        await waClient.destroy();
    } catch (err) {
        console.error('Error destroying client on disconnect', err);
    }
    
    // Attempt to restart
    waClient.initialize().catch(e => console.error("Re-init failed", e));
});

waClient.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp Client:', err);
});

// Helper function to send messages
async function sendReminderMessages() {
    console.log('Running daily check for expiring members...');
    if (!waClient || !waClient.info) {
        console.log('WhatsApp is not ready yet. Skipping this run.');
        return;
    }

    try {
        const [members] = await pool.query("SELECT * FROM members WHERE isDeleted = 0 AND membershipStatus = 'Valid'");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let successCount = 0;

        for (const m of members) {
            if (!m.expiryDate) continue;

            const expDate = new Date(m.expiryDate);
            expDate.setHours(0, 0, 0, 0);

            // Calculate diff in days
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Send reminder exactly 5 days before, 2 days before, and 1 day before
            if (diffDays === 5 || diffDays === 2 || diffDays === 1) {
                let phoneStr = m.whatsapp || m.phone;
                if (!phoneStr) continue;

                let phone = phoneStr.replace(/\D/g, '');
                if (phone.length === 10) phone = `91${phone}`;
                const chatId = `${phone}@c.us`;

                try {
                    const isRegistered = await waClient.isRegisteredUser(chatId);
                    if (!isRegistered) {
                        console.log(`Number not on WhatsApp: ${phone}`);
                        continue;
                    }

                    const day = String(expDate.getDate()).padStart(2, '0');
                    const month = String(expDate.getMonth() + 1).padStart(2, '0');
                    const dateStr = `${day}/${month}/${expDate.getFullYear()}`;
                    
                    const message = `Hello ${m.fullName},\n\nThis is a gentle reminder from GymPro V2 that your membership is expiring on ${dateStr} (in ${diffDays} days).\n\nPlease renew your membership on time to continue your fitness journey!\n\nThank you!`;

                    await waClient.sendMessage(chatId, message);
                    console.log(`Reminder sent to ${m.fullName} (${phone})`);
                    successCount++;
                    
                    // Delay to avoid spam bans
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (err) {
                    console.error(`Failed to send to ${phone}`, err);
                }
            }
        }
        
        console.log(`Finished sending reminders. Total sent: ${successCount}`);
    } catch (dbErr) {
        console.error('Database error during reminder check:', dbErr);
    }
}

// Schedule the cron job to run every day at 10:00 AM
cron.schedule('0 10 * * *', () => {
    sendReminderMessages();
});

console.log('WhatsApp Bot service started. Waiting for connection...');
