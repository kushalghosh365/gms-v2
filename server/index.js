const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper: Upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder = 'gms-members') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image', transformation: [{ width: 600, quality: 80, fetch_format: 'auto' }] },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
};

// MySQL Config and Models
const sequelize = require('./config/database');
const Member = require('./models/Member');
const Payment = require('./models/Payment');
const Staff = require('./models/Staff');
const PaymentRequest = require('./models/PaymentRequest');
const Settings = require('./models/Settings');
const Admin = require('./models/Admin');

// Establish associations
PaymentRequest.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Member.hasMany(PaymentRequest, { foreignKey: 'memberId' });

Payment.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Member.hasMany(Payment, { foreignKey: 'memberId' });

const sharp = require('sharp');
const cron = require('node-cron');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

let waStatus = 'DISCONNECTED';
let waQR = null;
let waClient = null;

function initializeWhatsApp() {
    waClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    waClient.on('qr', async (qr) => {
        waStatus = 'QR_READY';
        try {
            waQR = await QRCode.toDataURL(qr);
        } catch (e) {
            console.error('QR Generate Error', e);
        }
    });

    waClient.on('ready', () => {
        waStatus = 'CONNECTED';
        waQR = null;
        console.log('WhatsApp Client is ready!');
    });

    waClient.on('disconnected', (reason) => {
        console.log('WhatsApp disconnected', reason);
        waStatus = 'DISCONNECTED';
        waQR = null;
    });

    waClient.initialize();
}

initializeWhatsApp();

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Multer Memory Storage (files go to Cloudinary, not local disk)
const upload = multer({ storage: multer.memoryStorage() });

// Helper to map Sequelize records to match MongoDB format (adds _id)
const mapRecord = (rec) => {
    if (!rec) return null;
    const plain = typeof rec.toJSON === 'function' ? rec.toJSON() : rec;
    return {
        ...plain,
        _id: plain.id
    };
};

const mapRecords = (recs) => {
    if (!recs) return [];
    return recs.map(r => mapRecord(r));
};

// Database authentication and synchronization
sequelize.authenticate()
    .then(() => {
        console.log('MySQL Connected');
        return sequelize.sync();
    })
    .then(() => {
        console.log('MySQL Database & Tables Synced');
        cleanupStaleAttendance();
    })
    .catch(err => {
        console.error('MySQL Connection/Sync Error:', err);
    });

// --- CRON JOBS & TASKS ---
const cleanupStaleAttendance = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Checkout Staff from previous days
        const staffs = await Staff.findAll();
        for (let staff of staffs) {
            let attendance = Array.isArray(staff.attendance) ? [...staff.attendance] : [];
            let modified = false;
            for (let a of attendance) {
                if (a.status === 'IN' && a.date !== today) {
                    a.status = 'OUT';
                    a.outTime = 'Auto-Checkout';
                    a.inTimeTimestamp = null;
                    a.dayType = 'HALF_DAY'; // Penalty for not checking out
                    modified = true;
                }
            }
            if (modified) {
                staff.attendance = attendance;
                staff.changed('attendance', true);
                await staff.save();
            }
        }

        // Checkout Members from previous days
        const members = await Member.findAll();
        for (let member of members) {
            let attendance = Array.isArray(member.attendance) ? [...member.attendance] : [];
            let modified = false;
            for (let a of attendance) {
                if (a.status === 'IN' && a.date !== today) {
                    a.status = 'OUT';
                    a.outTime = 'Auto-Checkout';
                    modified = true;
                }
            }
            if (modified) {
                member.attendance = attendance;
                member.changed('attendance', true);
                await member.save();
            }
        }
        console.log('Stale attendance cleanup completed.');
    } catch (error) {
        console.error('Cleanup Stale Attendance Error:', error);
    }
};

// Auto-Checkout Cron Job - runs every day at 23:59
cron.schedule('59 23 * * *', async () => {
    console.log('Running Midnight Auto-Checkout...');
    await cleanupStaleAttendance();
    
    // Also checkout today's remaining INs just in case
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const staffs = await Staff.findAll();
        for (let staff of staffs) {
            let attendance = Array.isArray(staff.attendance) ? [...staff.attendance] : [];
            let modified = false;
            for (let a of attendance) {
                if (a.status === 'IN' && a.date === today) {
                    a.status = 'OUT';
                    a.outTime = 'Auto-Checkout';
                    a.inTimeTimestamp = null;
                    a.dayType = 'HALF_DAY';
                    modified = true;
                }
            }
            if (modified) {
                staff.attendance = attendance;
                staff.changed('attendance', true);
                await staff.save();
            }
        }

        const members = await Member.findAll();
        for (let member of members) {
            let attendance = Array.isArray(member.attendance) ? [...member.attendance] : [];
            let modified = false;
            for (let a of attendance) {
                if (a.status === 'IN' && a.date === today) {
                    a.status = 'OUT';
                    a.outTime = 'Auto-Checkout';
                    modified = true;
                }
            }
            if (modified) {
                member.attendance = attendance;
                member.changed('attendance', true);
                await member.save();
            }
        }
    } catch (error) {
        console.error('Auto-Checkout Today Error:', error);
    }
});

// --- SETTINGS ROUTES ---
app.get('/api/admin/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            const defaultPricing = [
                { category: 'General', admissionFee: 2000, packages: [{ name: '1 Month', durationDays: 30, price: 800 }, { name: 'Quarterly', durationDays: 90, price: 3000 }, { name: 'Half Yearly', durationDays: 180, price: 5000 }, { name: 'Yearly', durationDays: 365, price: 9000 }, { name: 'Just One Month', durationDays: 30, price: 1000 }] },
                { category: 'Student', admissionFee: 1000, packages: [{ name: '1 Month', durationDays: 30, price: 700 }, { name: 'Quarterly', durationDays: 90, price: 2800 }, { name: 'Half Yearly', durationDays: 180, price: 4700 }, { name: 'Yearly', durationDays: 365, price: 6999 }] },
                { category: 'Yoga', admissionFee: 500, packages: [{ name: '1 Month', durationDays: 30, price: 500 }] },
                { category: 'Zumba', admissionFee: 600, packages: [{ name: '1 Month', durationDays: 30, price: 500 }] },
                { category: 'PT_Average', admissionFee: 1500, packages: [{ name: 'Monthly', durationDays: 30, price: 4000 }, { name: 'Quarterly', durationDays: 90, price: 10000 }] },
                { category: 'PT_Advanced', admissionFee: 1500, packages: [{ name: 'Monthly', durationDays: 30, price: 5000 }, { name: 'Quarterly', durationDays: 90, price: 12000 }] }
            ];
            settings = await Settings.create({ upiId: 'your-upi-id@ybl', pricing: defaultPricing });
        }
        res.json(mapRecord(settings));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({ upiId: 'your-upi-id@ybl', pricing: [] });
        }
        if (req.body.upiId) settings.upiId = req.body.upiId;
        if (req.body.pricing) settings.pricing = req.body.pricing;
        await settings.save();
        res.json({ message: 'Settings updated successfully', settings: mapRecord(settings) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API ROUTES ---

// --- ADMIN AUTH ROUTES ---
const otpStore = {};

app.get('/api/admin/setup-status', async (req, res) => {
    try {
        const count = await Admin.count();
        res.json({ isSetup: count > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = otp;
    
    console.log(`[OTP] Sent OTP ${otp} to phone ${phone}`);
    if (waClient && waStatus === 'CONNECTED') {
        let waPhone = phone.replace(/\D/g, '');
        if (waPhone.length === 10) waPhone = `91${waPhone}`;
        try {
            await waClient.sendMessage(`${waPhone}@c.us`, `Your Gym Management System OTP is: ${otp}`);
        } catch(e) {
             console.error("Failed to send OTP via WA", e);
        }
    }
    
    res.json({ message: 'OTP sent successfully (check terminal or WhatsApp if connected)' });
});

app.post('/api/admin/register', async (req, res) => {
    try {
        const { username, email, phone, password, confirmPassword, ownerControlPassword, confirmOwnerControlPassword, otp } = req.body;
        
        const count = await Admin.count();
        if (count > 0) return res.status(403).json({ message: 'Admin already exists. Registration locked.' });
        
        if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
        if (ownerControlPassword !== confirmOwnerControlPassword) return res.status(400).json({ message: 'Owner Control passwords do not match' });
        
        if (otpStore[phone] !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        
        await Admin.create({ username, email, phone, password, ownerControlPassword });
        delete otpStore[phone]; // Clear OTP
        
        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ where: { username, password } });
        if (!admin) return res.status(401).json({ message: 'Invalid username or password' });
        
        res.json({ message: 'Login successful', admin: { id: admin.id, _id: admin.id, username: admin.username } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/verify-owner-password', async (req, res) => {
    try {
        const { ownerControlPassword } = req.body;
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        
        if (admin.ownerControlPassword === ownerControlPassword) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Incorrect Owner Control Password' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/edit-register', async (req, res) => {
    try {
        const { phone, password, confirmPassword, ownerControlPassword, confirmOwnerControlPassword, otp } = req.body;
        
        if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
        if (ownerControlPassword !== confirmOwnerControlPassword) return res.status(400).json({ message: 'Owner Control passwords do not match' });
        
        if (otpStore[phone] !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        
        admin.phone = phone;
        admin.password = password;
        admin.ownerControlPassword = ownerControlPassword;
        await admin.save();
        
        delete otpStore[phone]; // Clear OTP
        
        res.json({ message: 'Admin details updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 0. Get Payment Stats
app.get('/api/admin/payment-stats', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const allPayments = await Payment.findAll();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const stats = {
            monthly: { admission: 0, renewal: 0, total: 0, monthName: months[now.getMonth()] },
            yearlyTotal: 0
        };

        allPayments.forEach(p => {
            const pDate = new Date(p.date);
            if (pDate >= startOfMonth) {
                if (p.type === 'Admission') stats.monthly.admission += p.amount;
                else if (p.type === 'Renewal') stats.monthly.renewal += p.amount;
                else if (p.type === 'Manual' || p.type === 'Internal') stats.monthly.renewal += p.amount; 
            }
            if (pDate >= startOfYear) stats.yearlyTotal += p.amount;
        });
        stats.monthly.total = stats.monthly.admission + stats.monthly.renewal;
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- WHATSAPP ROUTES ---
app.get('/api/admin/whatsapp/status', (req, res) => {
    res.json({ status: waStatus, qr: waQR });
});

app.post('/api/admin/whatsapp/logout', async (req, res) => {
    try {
        if (waClient) {
            try {
                await waClient.destroy();
            } catch (destroyErr) {
                console.error('WhatsApp destroy error (non-fatal):', destroyErr.message);
            }
        }

        const authDir = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('WhatsApp session data deleted.');
        }

        waStatus = 'DISCONNECTED';
        waQR = null;

        initializeWhatsApp();

        res.json({ message: 'WhatsApp disconnected and all session data cleared.' });
    } catch (error) {
        console.error('WhatsApp logout error:', error);
        waStatus = 'DISCONNECTED';
        waQR = null;
        const authDir = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }
        initializeWhatsApp();
        res.json({ message: 'WhatsApp disconnected (forced cleanup).' });
    }
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

            const message = `Hello ${m.fullName},\n\nThis is a gentle reminder from the Gym that your membership is expiring on ${new Date(m.expiryDate).toLocaleDateString('en-GB')}.\n\nPlease renew your membership on time to continue your fitness journey!\n\nThank you!`;
            
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

// 1. Register Member
app.post('/api/members/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, whatsapp, memberCategory, packageType, admissionFeePaid, packageFeePaid } = req.body;
        let photoPath = '';
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, 'gms-members');
            photoPath = result.secure_url;
        }
        
        const existingMember = await Member.findOne({ where: { phone } });
        if (existingMember) {
            return res.status(400).json({ error: 'Member with this phone number already exists' });
        }

        let durationDays = 30; // default
        let settings = await Settings.findOne();
        if (settings) {
            const categoryConfig = settings.pricing.find(c => c.category === (memberCategory || 'General'));
            if (categoryConfig) {
                const pack = categoryConfig.packages.find(p => p.name === (packageType || '1 Month'));
                if (pack) durationDays = pack.durationDays;
            }
        }
        
        let expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        const newMember = await Member.create({ 
            fullName, email, phone, whatsapp, photo: photoPath,
            memberCategory: memberCategory || 'General',
            packageType: packageType || '1 Month',
            membershipStatus: 'Valid',
            expiryDate
        });

        const admissionAmt = Number(admissionFeePaid || 0);
        const packageAmt = Number(packageFeePaid || 0);

        if (admissionAmt > 0) {
            await Payment.create({
                memberId: newMember.id,
                amount: admissionAmt,
                type: 'Admission',
                method: 'Manual',
                packageType: 'Admission Fee',
                durationDays: 0
            });
        }

        if (packageAmt > 0) {
            await Payment.create({
                memberId: newMember.id,
                amount: packageAmt,
                type: 'Renewal',
                method: 'Manual',
                packageType: packageType || '1 Month',
                durationDays
            });
        }

        const qrCodeData = await QRCode.toDataURL(phone);

        res.status(201).json({ 
            message: 'Registration successful', 
            member: mapRecord(newMember),
            qrCode: qrCodeData 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get All Members
app.get('/api/members', async (req, res) => {
    try {
        const members = await Member.findAll();
        res.json(mapRecords(members));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Staff: Register
app.post('/api/staff/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, whatsapp, role, joiningDate } = req.body;
        let photo = '';
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, 'gms-staff');
            photo = result.secure_url;
        }
        
        const existingStaff = await Staff.findOne({ where: { phone } });
        if (existingStaff) return res.status(400).json({ error: 'Staff with this phone number already exists' });

        const newStaff = await Staff.create({ fullName, email, phone, whatsapp, photo, role, joiningDate });
        const qrCodeData = await QRCode.toDataURL(phone);

        res.status(201).json({ message: 'Staff Registration successful', staff: mapRecord(newStaff), qrCode: qrCodeData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Staff: Get All
app.get('/api/staff', async (req, res) => {
    try {
        const staff = await Staff.findAll();
        res.json(mapRecords(staff));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Staff: Manual Attendance (by Owner)
app.post('/api/admin/staff-attendance', async (req, res) => {
    try {
        const { phone, action, date } = req.body; 
        const staff = await Staff.findOne({ where: { phone } });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        const targetDate = date || new Date().toISOString().split('T')[0];
        let attendance = Array.isArray(staff.attendance) ? [...staff.attendance] : [];
        let attendanceRecord = attendance.find(a => a.date === targetDate);

        if (action === 'IN') {
            if (attendanceRecord) {
                if (attendanceRecord.status === 'IN') return res.status(400).json({ message: 'Staff is already IN' });
                if (attendanceRecord.dayType === 'FULL_DAY' || attendanceRecord.dayType === 'HALF_WORK_HALF_LEAVE') return res.status(400).json({ message: 'Your attendance limit 2time in a single day' });
                if (attendanceRecord.dayType === 'FULL_LEAVE') return res.status(400).json({ message: 'Staff is marked on LEAVE today' });
                
                attendanceRecord.status = 'IN';
                attendanceRecord.inTime = 'Manual';
                attendanceRecord.inTimeTimestamp = Date.now();
            } else {
                attendance.push({ date: targetDate, inTime: 'Manual', status: 'IN', dayType: 'PENDING', inTimeTimestamp: Date.now() });
            }
        } else if (action === 'FULL_LEAVE' || action === 'HALF_LEAVE') {
            const statusToSet = 'OUT'; 
            let typeToSet = action;
            
            if (attendanceRecord) {
                if (attendanceRecord.status === 'OUT' && attendanceRecord.dayType === typeToSet) {
                    return res.status(400).json({ message: `Already marked as ${action.replace('_', ' ')}` });
                }
                if (attendanceRecord.dayType === 'HALF_WORK_HALF_LEAVE') {
                    return res.status(400).json({ message: 'Already marked as HALF WORK HALF LEAVE' });
                }
                if (attendanceRecord.dayType === 'FULL_DAY') {
                    return res.status(400).json({ message: 'Cannot mark Leave on a Full Working Day' });
                }
                if (action === 'FULL_LEAVE' && attendanceRecord.dayType === 'HALF_DAY') {
                    return res.status(400).json({ message: 'Cannot mark Full Leave after working a shift' });
                }
                
                if (action === 'HALF_LEAVE' && attendanceRecord.dayType === 'HALF_DAY') {
                    typeToSet = 'HALF_WORK_HALF_LEAVE';
                }
                
                attendanceRecord.status = statusToSet;
                attendanceRecord.outTime = attendanceRecord.outTime || 'Manual';
                attendanceRecord.dayType = typeToSet;
                attendanceRecord.inTimeTimestamp = null;
            } else {
                attendance.push({ date: targetDate, inTime: 'Manual', outTime: 'Manual', status: statusToSet, dayType: typeToSet });
            }
        } else if (action === 'OUT') {
            if (!attendanceRecord || attendanceRecord.status === 'OUT') {
                return res.status(400).json({ message: "Staff must be IN to click OUT" });
            }

            if (attendanceRecord.dayType === 'PENDING') {
                attendanceRecord.dayType = 'HALF_DAY';
            } else if (attendanceRecord.dayType === 'HALF_DAY') {
                attendanceRecord.dayType = 'FULL_DAY';
            } else if (attendanceRecord.dayType === 'HALF_LEAVE') {
                attendanceRecord.dayType = 'HALF_WORK_HALF_LEAVE';
            }

            attendanceRecord.status = 'OUT';
            attendanceRecord.outTime = attendanceRecord.outTime || 'Manual';
            attendanceRecord.inTimeTimestamp = null;
        }

        staff.attendance = attendance;
        staff.changed('attendance', true);
        await staff.save();
        res.json({ message: `Manual ${action} successful`, staff: mapRecord(staff) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Kiosk: Get Profile by Phone
app.get('/api/kiosk/profile/:phone', async (req, res) => {
    try {
        let member = await Member.findOne({ where: { phone: req.params.phone } });
        if (member) {
            let memberObj = mapRecord(member);
            const responseData = { ...memberObj, userType: 'MEMBER' };
            if (member.paymentNotification) {
                await Member.update({ paymentNotification: null }, { where: { id: member.id } });
            }
            return res.json(responseData);
        }
        
        let staff = await Staff.findOne({ where: { phone: req.params.phone } });
        if (staff) return res.json({ ...mapRecord(staff), userType: 'STAFF' });
        
        res.status(404).json({ message: 'User not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Kiosk: Check In/Out (using Mobile Number)
app.post('/api/kiosk/attendance', async (req, res) => {
    try {
        const { phone, action } = req.body;
        
        // Member Logic
        let member = await Member.findOne({ where: { phone } });
        if (member) {
            const today = new Date().toISOString().split('T')[0];
            let attendance = Array.isArray(member.attendance) ? [...member.attendance] : [];
            let attendanceRecord = attendance.find(a => a.date === today);

            if (action === 'IN') {
                if (member.membershipStatus === 'Expired') return res.status(403).json({ message: 'Membership Expired. Please Pay.' });
                if (attendanceRecord) {
                    if (attendanceRecord.status === 'IN') return res.status(400).json({ message: 'Already Checked IN' });
                    if (attendanceRecord.status === 'OUT') return res.status(400).json({ message: 'Your attendance limit 1 time in a single day' });
                } else {
                    attendance.push({ date: today, inTime: new Date().toLocaleTimeString(), status: 'IN' });
                }
            } else if (action === 'OUT') {
                if (!attendanceRecord || attendanceRecord.status === 'OUT') return res.status(400).json({ message: "You are not IN, so you can't OUT" });
                attendanceRecord.status = 'OUT'; 
                attendanceRecord.outTime = new Date().toLocaleTimeString();
            }
            
            member.attendance = attendance;
            member.changed('attendance', true);
            await member.save();
            return res.json({ message: `Successfully checked ${action}`, user: { ...mapRecord(member), userType: 'MEMBER' } });
        }

        // Staff Logic
        let staff = await Staff.findOne({ where: { phone } });
        if (staff) {
            const today = new Date().toISOString().split('T')[0];
            let attendance = Array.isArray(staff.attendance) ? [...staff.attendance] : [];
            let attendanceRecord = attendance.find(a => a.date === today);

            if (action === 'IN') {
                if (attendanceRecord) {
                    if (attendanceRecord.status === 'IN') return res.status(400).json({ message: 'Already Checked IN' });
                    if (attendanceRecord.dayType === 'FULL_DAY' || attendanceRecord.dayType === 'HALF_WORK_HALF_LEAVE') return res.status(400).json({ message: 'Your attendance limit 2time in a single day' });
                    if (attendanceRecord.dayType === 'FULL_LEAVE') return res.status(400).json({ message: 'Staff is marked on LEAVE today' });
                    
                    attendanceRecord.status = 'IN'; 
                    attendanceRecord.inTime = new Date().toLocaleTimeString(); 
                    attendanceRecord.inTimeTimestamp = Date.now();
                } else {
                    attendance.push({ date: today, inTime: new Date().toLocaleTimeString(), status: 'IN', dayType: 'PENDING', inTimeTimestamp: Date.now() });
                }
            } else if (action === 'OUT') {
                if (!attendanceRecord || attendanceRecord.status === 'OUT') return res.status(400).json({ message: "You are not IN, so you can't OUT" });
                
                let sessionMs = 0;
                if (attendanceRecord.inTimeTimestamp) {
                    sessionMs = Date.now() - attendanceRecord.inTimeTimestamp;
                }
                
                const fourHoursMs = 4 * 60 * 60 * 1000;
                if (sessionMs < fourHoursMs) {
                    return res.status(403).json({ message: "You must complete at least 4 hours to checkout." });
                }

                attendanceRecord.totalWorkingMs = (attendanceRecord.totalWorkingMs || 0) + sessionMs;
                attendanceRecord.inTimeTimestamp = null;
                
                attendanceRecord.status = 'OUT'; 
                attendanceRecord.outTime = new Date().toLocaleTimeString();

                if (attendanceRecord.dayType === 'PENDING') {
                    attendanceRecord.dayType = 'HALF_DAY';
                } else if (attendanceRecord.dayType === 'HALF_DAY') {
                    attendanceRecord.dayType = 'FULL_DAY';
                } else if (attendanceRecord.dayType === 'HALF_LEAVE') {
                    attendanceRecord.dayType = 'HALF_WORK_HALF_LEAVE';
                }
            }
            
            staff.attendance = attendance;
            staff.changed('attendance', true);
            await staff.save();
            return res.json({ message: `Successfully checked ${action}`, user: { ...mapRecord(staff), userType: 'STAFF' } });
        }

        res.status(404).json({ message: 'User not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4.1 Kiosk: Submit Payment Request
app.post('/api/kiosk/payment-request', async (req, res) => {
    try {
        const { phone, packageType, durationDays, amount, transactionId } = req.body;
        const member = await Member.findOne({ where: { phone } });
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        await PaymentRequest.create({
            memberId: member.id,
            packageType,
            durationDays,
            amount,
            transactionId
        });
        
        res.json({ message: 'Payment verification requested successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4.2 Update Payment (Legacy/Bypass if needed)
app.post('/api/members/payment', async (req, res) => {
    try {
        const { phone, months } = req.body;
        const member = await Member.findOne({ where: { phone } });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        let currentExpiry = member.expiryDate || new Date();
        if (currentExpiry < new Date()) currentExpiry = new Date();
        
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + (parseInt(months) * 30));

        member.expiryDate = newExpiry;
        member.membershipStatus = 'Valid';
        await member.save();

        const amount = months * 1000; 
        await Payment.create({
            memberId: member.id,
            amount,
            type: 'Internal',
            method: 'Manual',
            packageType: `${months} Month(s) Package`,
            durationDays: months * 30
        });

        res.json({ message: 'Payment Success. Expiry Updated.', member: mapRecord(member) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Manual Payment (by Owner)
app.post('/api/admin/manual-payment', async (req, res) => {
    try {
        const { phone, packageType, durationDays, amount, isAdmission } = req.body;
        const member = await Member.findOne({ where: { phone } });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        let currentExpiry = member.expiryDate || new Date();
        if (currentExpiry < new Date()) currentExpiry = new Date();
        
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + parseInt(durationDays));

        member.expiryDate = newExpiry;
        member.membershipStatus = 'Valid';
        member.packageType = packageType;
        await member.save();

        await Payment.create({
            memberId: member.id,
            amount: amount,
            type: isAdmission ? 'Admission' : 'Renewal',
            method: 'Manual',
            packageType: packageType,
            durationDays: durationDays
        });

        res.json({ message: 'Manual Payment Recorded.', member: mapRecord(member) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get Payment Requests
app.get('/api/admin/payment-requests', async (req, res) => {
    try {
        const requests = await PaymentRequest.findAll({
            where: { status: 'Pending' },
            include: [{
                model: Member,
                as: 'member',
                attributes: ['id', 'fullName', 'phone', 'photo', 'membershipStatus']
            }],
            order: [['date', 'DESC']]
        });
        
        const mappedRequests = requests.map(req => {
            const r = req.toJSON();
            r._id = r.id;
            r.memberId = mapRecord(r.member);
            delete r.member;
            return r;
        });
        
        res.json(mappedRequests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Confirm Payment Request
app.post('/api/admin/payment-requests/:id/confirm', async (req, res) => {
    try {
        const request = await PaymentRequest.findByPk(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'Pending') return res.status(400).json({ message: 'Request already processed' });
        
        const member = await Member.findByPk(request.memberId);
        
        let currentExpiry = member.expiryDate || new Date();
        if (currentExpiry < new Date()) currentExpiry = new Date();
        
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + parseInt(request.durationDays));
        
        member.expiryDate = newExpiry;
        member.membershipStatus = 'Valid';
        member.paymentNotification = 'Confirmed';
        member.packageType = request.packageType;
        await member.save();
        
        await Payment.create({
            memberId: member.id,
            amount: request.amount,
            type: 'Renewal', 
            method: 'Kiosk',
            packageType: request.packageType,
            durationDays: request.durationDays
        });
        
        request.status = 'Confirmed';
        await request.save();
        
        res.json({ message: 'Payment Confirmed & Expiry Updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Reject Payment Request
app.post('/api/admin/payment-requests/:id/reject', async (req, res) => {
    try {
        const request = await PaymentRequest.findByPk(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        
        const member = await Member.findByPk(request.memberId);
        if (member) {
            member.paymentNotification = 'Rejected';
            await member.save();
        }
        
        request.status = 'Rejected';
        await request.save();
        
        res.json({ message: 'Payment Request Rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Manual Attendance Override (by Owner)
app.post('/api/admin/manual-attendance', async (req, res) => {
    try {
        const { phone, action, date } = req.body; 
        const member = await Member.findOne({ where: { phone } });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        const targetDate = date || new Date().toISOString().split('T')[0];
        let attendance = Array.isArray(member.attendance) ? [...member.attendance] : [];
        let attendanceRecord = attendance.find(a => a.date === targetDate);

        if (action === 'IN') {
            if (!attendanceRecord) {
                attendance.push({ date: targetDate, inTime: 'Manual', status: 'IN' });
            } else {
                attendanceRecord.status = 'IN';
                attendanceRecord.inTime = attendanceRecord.inTime || 'Manual';
            }
        } else if (action === 'OUT') {
            if (!attendanceRecord) {
                attendance.push({ date: targetDate, inTime: 'Manual', outTime: 'Manual', status: 'OUT' });
            } else {
                attendanceRecord.status = 'OUT';
                attendanceRecord.outTime = attendanceRecord.outTime || 'Manual';
            }
        }

        member.attendance = attendance;
        member.changed('attendance', true);
        await member.save();
        res.json({ message: `Manual ${action} successful`, member: mapRecord(member) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Get Attendance History (Flat list for all members)
app.get('/api/admin/attendance-history', async (req, res) => {
    try {
        const members = await Member.findAll({ attributes: ['id', 'fullName', 'phone', 'attendance', 'photo'] });
        let history = [];
        members.forEach(m => {
            const attendance = Array.isArray(m.attendance) ? m.attendance : [];
            attendance.forEach(log => {
                history.push({
                    _id: m.id,
                    id: m.id,
                    fullName: m.fullName,
                    phone: m.phone,
                    photo: m.photo,
                    ...log
                });
            });
        });
        history.sort((a, b) => b.date.localeCompare(a.date));
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Get All Payments
app.get('/api/admin/payments', async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [{
                model: Member,
                as: 'member',
                attributes: ['id', 'fullName', 'phone', 'photo']
            }],
            order: [['date', 'DESC']]
        });
        
        const mappedPayments = payments.map(p => {
            const pay = p.toJSON();
            pay._id = pay.id;
            pay.memberId = mapRecord(pay.member);
            delete pay.member;
            return pay;
        });
        
        res.json(mappedPayments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Get Staff Attendance History
app.get('/api/admin/staff-attendance-history', async (req, res) => {
    try {
        const staff = await Staff.findAll({ attributes: ['id', 'fullName', 'phone', 'role', 'attendance', 'photo'] });
        let history = [];
        staff.forEach(s => {
            const attendance = Array.isArray(s.attendance) ? s.attendance : [];
            attendance.forEach(log => {
                history.push({
                    _id: s.id,
                    id: s.id,
                    fullName: s.fullName,
                    phone: s.phone,
                    role: s.role,
                    photo: s.photo,
                    ...log
                });
            });
        });
        history.sort((a, b) => b.date.localeCompare(a.date));
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Clear Member Attendance History
app.post('/api/admin/clear-member-attendance', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin details not found.' });
        if (admin.password !== password) {
            return res.status(401).json({ message: 'Incorrect Admin Password.' });
        }
        await Member.update({ attendance: [] }, { where: {} });
        res.json({ message: 'All Member attendance history deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Clear Staff Attendance History
app.post('/api/admin/clear-staff-attendance', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin details not found.' });
        if (admin.ownerControlPassword !== password) {
            return res.status(401).json({ message: 'Incorrect Owner Control Password.' });
        }
        await Staff.update({ attendance: [] }, { where: {} });
        res.json({ message: 'All Staff attendance history deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
