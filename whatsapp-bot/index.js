require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');
const cron = require('node-cron');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool
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

let waStatus = 'DISCONNECTED';
let waQR = null;

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

waClient.on('qr', async (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
    
    // Also save for API
    if (waStatus !== 'CONNECTED') {
        waStatus = 'QR_READY';
        try {
            waQR = await qrcodeLib.toDataURL(qr);
        } catch (e) {
            console.error('QR Generate Error', e);
        }
    }
});

waClient.on('authenticated', () => {
    console.log('WhatsApp Client authenticated successfully!');
    waStatus = 'CONNECTED';
    waQR = null;
});

waClient.on('ready', () => {
    console.log('WhatsApp Client is ready and connected!');
    waStatus = 'CONNECTED';
    waQR = null;
});

waClient.on('auth_failure', (msg) => {
    console.error('WhatsApp Auth Failure', msg);
    waStatus = 'DISCONNECTED';
    waQR = null;
});

waClient.on('disconnected', async (reason) => {
    console.log('WhatsApp disconnected', reason);
    waStatus = 'DISCONNECTED';
    waQR = null;
    try {
        await waClient.destroy();
    } catch (err) {
        console.error('Error destroying client on disconnect', err);
    }
    
    // Clear auth folder
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    }
    
    setTimeout(() => waClient.initialize().catch(e => console.error("Re-init failed", e)), 3000);
});

waClient.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp Client:', err);
});

// ======================
// API ROUTES
// ======================
app.get('/', (req, res) => {
    res.send("WhatsApp Bot is running.");
});

app.get('/api/admin/whatsapp/status', (req, res) => {
    res.json({ status: waStatus, qr: waQR });
});

app.post('/api/admin/whatsapp/send-reminders', async (req, res) => {
    if (waStatus !== 'CONNECTED') {
        return res.status(400).json({ error: 'WhatsApp is not connected' });
    }
    const { members } = req.body;
    let successCount = 0;
    let failedList = [];

    for (const m of members) {
        let phoneStr = m.whatsapp || m.phone;
        if (!phoneStr) continue;

        let phone = phoneStr.replace(/\D/g, '');
        if (phone.length === 10) phone = `91${phone}`;
        const chatId = `${phone}@c.us`;

        try {
            const isRegistered = await waClient.isRegisteredUser(chatId);
            if (!isRegistered) {
                console.log(`Number not on WhatsApp: ${phone}`);
                failedList.push(m.fullName);
                continue;
            }

            const expDate = new Date(m.expiryDate);
            const day = String(expDate.getDate()).padStart(2, '0');
            const month = String(expDate.getMonth() + 1).padStart(2, '0');
            const dateStr = `${day}/${month}/${expDate.getFullYear()}`;
            
            // Diff days
            const today = new Date();
            today.setHours(0,0,0,0);
            const exp = new Date(m.expiryDate);
            exp.setHours(0,0,0,0);
            const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            let message = '';
            if (diffDays === 0) {
                 message = `Hello ${m.fullName},\n\nThis is a gentle reminder from GymPro V2 that your membership expires TODAY (${dateStr}).\n\nPlease renew your membership on time to continue your fitness journey!\n\nThank you!`;
            } else {
                 message = `Hello ${m.fullName},\n\nThis is a gentle reminder from GymPro V2 that your membership is expiring on ${dateStr} (in ${diffDays} days).\n\nPlease renew your membership on time to continue your fitness journey!\n\nThank you!`;
            }

            await waClient.sendMessage(chatId, message);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
            console.error(`Failed to send to ${phone}`, error);
            failedList.push(m.fullName);
        }
    }

    let resultMsg = `Sent ${successCount} reminders.`;
    if (failedList.length > 0) {
        resultMsg += ` Failed for ${failedList.length} members (Invalid WA number).`;
    }
    res.json({ message: resultMsg });
});

app.post('/api/admin/whatsapp/send-qr', async (req, res) => {
    if (waStatus !== 'CONNECTED') {
        return res.status(400).json({ error: 'WhatsApp is not connected' });
    }
    try {
        const { phone, name, whatsapp } = req.body;
        let phoneStr = whatsapp || phone;
        if (!phoneStr) return res.status(400).json({ error: 'No WhatsApp number available' });

        let cleanPhone = phoneStr.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
        const chatId = `${cleanPhone}@c.us`;

        const isRegistered = await waClient.isRegisteredUser(chatId);
        if (!isRegistered) {
            return res.status(400).json({ error: 'Number not registered on WhatsApp' });
        }

        // Generate QR code as base64 image
        const qrBuffer = await qrcodeLib.toBuffer(phone, { type: 'png', width: 400, margin: 2 });
        const { MessageMedia } = require('whatsapp-web.js');
        const media = new MessageMedia('image/png', qrBuffer.toString('base64'), `${name}_QR.png`);

        await waClient.sendMessage(chatId, media, { caption: `🏋️ *${name}* - Gym QR Code\nScan this code at the kiosk for attendance.` });

        res.json({ message: `QR Code sent to ${name}'s WhatsApp!` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`WhatsApp Bot Server is running on port ${PORT}`);
});
