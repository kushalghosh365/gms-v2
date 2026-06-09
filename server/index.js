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

// --- IST Timezone Helpers ---
// Returns IST { hour, minute }
const getISTTime = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    return { hour: istDate.getUTCHours(), minute: istDate.getUTCMinutes() };
};

// Returns IST time as "HH:MM:SS AM/PM"
const getISTTimeString = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    let hours = istDate.getUTCHours();
    const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
};

// Returns IST date as "YYYY-MM-DD"
const getISTDateString = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        const today = getISTDateString();

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
        const today = getISTDateString();

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

    res.json({ message: 'OTP sent successfully (check terminal)' });
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

// 1. Register Member
app.post('/api/members/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, whatsapp, memberCategory, packageType, admissionFeePaid, packageFeePaid, gender } = req.body;
        let photoPath = '';
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, 'gms-members');
            photoPath = result.secure_url;
        }

        const existingMember = await Member.findOne({ where: { phone } });
        if (existingMember) {
            if (existingMember.isDeleted) {
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

                existingMember.fullName = fullName;
                existingMember.email = email;
                existingMember.whatsapp = whatsapp;
                if (photoPath) existingMember.photo = photoPath;
                existingMember.memberCategory = memberCategory || 'General';
                existingMember.packageType = packageType || '1 Month';
                existingMember.membershipStatus = 'Valid';
                existingMember.expiryDate = expiryDate;
                existingMember.gender = gender || 'Male';
                existingMember.isDeleted = false; // Reactivate!
                await existingMember.save();

                const admissionAmt = Number(admissionFeePaid || 0);
                const packageAmt = Number(packageFeePaid || 0);

                if (admissionAmt > 0) {
                    await Payment.create({
                        memberId: existingMember.id,
                        amount: admissionAmt,
                        type: 'Admission',
                        method: 'Manual',
                        packageType: 'Admission Fee',
                        durationDays: 0
                    });
                }

                if (packageAmt > 0) {
                    await Payment.create({
                        memberId: existingMember.id,
                        amount: packageAmt,
                        type: 'Renewal',
                        method: 'Manual',
                        packageType: packageType || '1 Month',
                        durationDays
                    });
                }

                const qrCodeData = await QRCode.toDataURL(phone);

                return res.status(201).json({
                    message: 'Registration successful',
                    member: mapRecord(existingMember),
                    qrCode: qrCodeData
                });
            } else {
                return res.status(400).json({ error: 'Member with this phone number already exists' });
            }
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
            expiryDate,
            gender: gender || 'Male'
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
        const members = await Member.findAll({ where: { isDeleted: false } });
        res.json(mapRecords(members));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Staff: Register
app.post('/api/staff/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, whatsapp, role, joiningDate, gender } = req.body;
        let photo = '';
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, 'gms-staff');
            photo = result.secure_url;
        }

        const existingStaff = await Staff.findOne({ where: { phone } });
        if (existingStaff) {
            if (existingStaff.isDeleted) {
                existingStaff.fullName = fullName;
                existingStaff.email = email;
                existingStaff.whatsapp = whatsapp;
                if (photo) existingStaff.photo = photo;
                existingStaff.role = role;
                existingStaff.joiningDate = joiningDate;
                existingStaff.gender = gender || 'Male';
                existingStaff.isDeleted = false; // Reactivate!
                await existingStaff.save();

                const qrCodeData = await QRCode.toDataURL(phone);
                return res.status(201).json({ message: 'Staff Registration successful', staff: mapRecord(existingStaff), qrCode: qrCodeData });
            } else {
                return res.status(400).json({ error: 'Staff with this phone number already exists' });
            }
        }

        const newStaff = await Staff.create({ fullName, email, phone, whatsapp, photo, role, joiningDate, gender: gender || 'Male' });
        const qrCodeData = await QRCode.toDataURL(phone);

        res.status(201).json({ message: 'Staff Registration successful', staff: mapRecord(newStaff), qrCode: qrCodeData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Staff: Get All
app.get('/api/staff', async (req, res) => {
    try {
        const staff = await Staff.findAll({ where: { isDeleted: false } });
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

        const targetDate = date || getISTDateString();
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
        let member = await Member.findOne({ where: { phone: req.params.phone, isDeleted: false } });
        if (member) {
            let memberObj = mapRecord(member);
            const responseData = { ...memberObj, userType: 'MEMBER' };
            if (member.paymentNotification) {
                await Member.update({ paymentNotification: null }, { where: { id: member.id } });
            }
            return res.json(responseData);
        }

        let staff = await Staff.findOne({ where: { phone: req.params.phone, isDeleted: false } });
        if (staff) return res.json({ ...mapRecord(staff), userType: 'STAFF' });

        res.status(404).json({ message: 'User not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helpers for Staff Kiosk Time Constraints
const validateStaffCheckInTime = () => {
    const { hour, minute } = getISTTime();
    
    // Morning shift cutoff: 6:10 AM (06:10)
    if (hour < 12) {
        if (hour > 6 || (hour === 6 && minute > 10)) {
            return {
                allowed: false,
                message: "Morning check-in is not allowed after 06:10 AM."
            };
        }
    } else {
        // Afternoon shift cutoff: 4:10 PM (16:10)
        if (hour > 16 || (hour === 16 && minute > 10)) {
            return {
                allowed: false,
                message: "Afternoon check-in is not allowed after 04:10 PM."
            };
        }
    }
    return { allowed: true };
};

// 4. Kiosk: Check In/Out (using Mobile Number)
app.post('/api/kiosk/attendance', async (req, res) => {
    try {
        const { phone, action } = req.body;

        // Member Logic
        let member = await Member.findOne({ where: { phone } });
        if (member) {
            const today = getISTDateString();
            let attendance = Array.isArray(member.attendance) ? [...member.attendance] : [];
            let attendanceRecord = attendance.find(a => a.date === today);

            if (action === 'IN') {
                if (member.membershipStatus === 'Expired') return res.status(403).json({ message: 'Membership Expired. Please Pay.' });
                if (attendanceRecord) {
                    if (attendanceRecord.status === 'IN') return res.status(400).json({ message: 'Already Checked IN' });
                    if (attendanceRecord.status === 'OUT') return res.status(400).json({ message: 'Your attendance limit 1 time in a single day' });
                } else {
                    attendance.push({ date: today, inTime: getISTTimeString(), status: 'IN' });
                }
            } else if (action === 'OUT') {
                if (!attendanceRecord || attendanceRecord.status === 'OUT') return res.status(400).json({ message: "You are not IN, so you can't OUT" });
                attendanceRecord.status = 'OUT';
                attendanceRecord.outTime = getISTTimeString();
            }

            member.attendance = attendance;
            member.changed('attendance', true);
            await member.save();
            return res.json({ message: `Successfully checked ${action}`, user: { ...mapRecord(member), userType: 'MEMBER' } });
        }

        // Staff Logic
        let staff = await Staff.findOne({ where: { phone } });
        if (staff) {
            const today = getISTDateString();
            let attendance = Array.isArray(staff.attendance) ? [...staff.attendance] : [];
            let attendanceRecord = attendance.find(a => a.date === today);

            if (action === 'IN') {
                // Time validation for staff check-in
                const timeCheck = validateStaffCheckInTime();
                if (!timeCheck.allowed) {
                    return res.status(403).json({ message: timeCheck.message });
                }

                if (attendanceRecord) {
                    if (attendanceRecord.status === 'IN') return res.status(400).json({ message: 'Already Checked IN' });
                    if (attendanceRecord.dayType === 'FULL_DAY' || attendanceRecord.dayType === 'HALF_WORK_HALF_LEAVE') return res.status(400).json({ message: 'Your attendance limit 2time in a single day' });
                    if (attendanceRecord.dayType === 'FULL_LEAVE') return res.status(400).json({ message: 'Staff is marked on LEAVE today' });

                    attendanceRecord.status = 'IN';
                    attendanceRecord.inTime = getISTTimeString();
                    attendanceRecord.inTimeTimestamp = Date.now();
                } else {
                    attendance.push({ date: today, inTime: getISTTimeString(), status: 'IN', dayType: 'PENDING', inTimeTimestamp: Date.now() });
                }
            } else if (action === 'OUT') {
                if (!attendanceRecord || attendanceRecord.status === 'OUT') return res.status(400).json({ message: "You are not IN, so you can't OUT" });

                let sessionMs = 0;
                if (attendanceRecord.inTimeTimestamp) {
                    sessionMs = Date.now() - attendanceRecord.inTimeTimestamp;
                }

                const minSessionMs = 4.5 * 60 * 60 * 1000; // 4 hours 30 minutes
                if (sessionMs < minSessionMs) {
                    return res.status(403).json({ message: "You must complete at least 4 hours 30 minutes to checkout." });
                }

                attendanceRecord.totalWorkingMs = (attendanceRecord.totalWorkingMs || 0) + sessionMs;
                attendanceRecord.inTimeTimestamp = null;

                attendanceRecord.status = 'OUT';
                attendanceRecord.outTime = getISTTimeString();

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

        const targetDate = date || getISTDateString();
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

// =============================================
// OLD MEMBER REGISTRATION (No fees recorded)
// =============================================
app.post('/api/members/register-old', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, whatsapp, memberCategory, packageType, joiningDate, gender } = req.body;
        let photoPath = '';
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, 'gms-members');
            photoPath = result.secure_url;
        }

        const existingMember = await Member.findOne({ where: { phone } });
        if (existingMember) {
            if (existingMember.isDeleted) {
                let durationDays = 30;
                let settings = await Settings.findOne();
                if (settings) {
                    const categoryConfig = settings.pricing.find(c => c.category === (memberCategory || 'General'));
                    if (categoryConfig) {
                        const pack = categoryConfig.packages.find(p => p.name === (packageType || '1 Month'));
                        if (pack) durationDays = pack.durationDays;
                    }
                }

                const joinDate = joiningDate ? new Date(joiningDate) : new Date();
                let expiryDate = new Date(joinDate);
                expiryDate.setDate(expiryDate.getDate() + durationDays);

                const membershipStatus = expiryDate > new Date() ? 'Valid' : 'Expired';

                existingMember.fullName = fullName;
                existingMember.email = email;
                existingMember.whatsapp = whatsapp;
                if (photoPath) existingMember.photo = photoPath;
                existingMember.memberCategory = memberCategory || 'General';
                existingMember.packageType = packageType || '1 Month';
                existingMember.membershipStatus = membershipStatus;
                existingMember.expiryDate = expiryDate;
                existingMember.registrationDate = joinDate;
                existingMember.gender = gender || 'Male';
                existingMember.isDeleted = false; // Reactivate!
                await existingMember.save();

                const qrCodeData = await QRCode.toDataURL(phone);
                return res.status(201).json({
                    message: 'Old Member Registration successful',
                    member: mapRecord(existingMember),
                    qrCode: qrCodeData
                });
            } else {
                return res.status(400).json({ error: 'Member with this phone number already exists' });
            }
        }

        // Calculate expiry from joining date + package duration
        let durationDays = 30;
        let settings = await Settings.findOne();
        if (settings) {
            const categoryConfig = settings.pricing.find(c => c.category === (memberCategory || 'General'));
            if (categoryConfig) {
                const pack = categoryConfig.packages.find(p => p.name === (packageType || '1 Month'));
                if (pack) durationDays = pack.durationDays;
            }
        }

        const joinDate = joiningDate ? new Date(joiningDate) : new Date();
        let expiryDate = new Date(joinDate);
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        const membershipStatus = expiryDate > new Date() ? 'Valid' : 'Expired';

        const newMember = await Member.create({
            fullName, email, phone, whatsapp, photo: photoPath,
            memberCategory: memberCategory || 'General',
            packageType: packageType || '1 Month',
            membershipStatus,
            expiryDate,
            registrationDate: joinDate,
            gender: gender || 'Male'
        });

        const qrCodeData = await QRCode.toDataURL(phone);
        res.status(201).json({
            message: 'Old Member Registration successful',
            member: mapRecord(newMember),
            qrCode: qrCodeData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// SOFT DELETE: Member (keeps fees & history)
// =============================================
app.delete('/api/members/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        if (admin.password !== password) {
            return res.status(401).json({ message: 'Incorrect password' });
        }
        const member = await Member.findByPk(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        member.isDeleted = true;
        await member.save();
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// SOFT DELETE: Staff (keeps history)
// =============================================
app.delete('/api/staff/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne();
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        if (admin.password !== password) {
            return res.status(401).json({ message: 'Incorrect password' });
        }
        const staff = await Staff.findByPk(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        staff.isDeleted = true;
        await staff.save();
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
//============================================
//member & staff edit options
//============================================
/*
edit options
if photo is being updated, send it as multipart form data with key 'photo'
other fields can be sent in JSON body as usual
name, email, whatsapp, memberCategory, packageType, joiningDate,gender can be updated for members
name, email, whatsapp, role, joiningDate,gender can be updated for staff
*/

// Edit Member

app.put('/api/members/:id', upload.single('photo'), async (req, res) => {
    try {
        const member = await Member.findByPk(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });

        const { fullName, email, whatsapp, memberCategory, packageType, joiningDate, gender } = req.body;
        if (fullName) member.fullName = fullName;
        if (email) member.email = email;
        if (whatsapp) member.whatsapp = whatsapp;
        if (memberCategory) member.memberCategory = memberCategory;
        if (packageType) member.packageType = packageType;
        if (joiningDate) member.joiningDate = joiningDate;
        if (gender) member.gender = gender;

        await member.save();
        res.json({ message: 'Member updated successfully', member });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Edit Staff

app.put('/api/staff/:id', upload.single('photo'), async (req, res) => {
    try {
        const staff = await Staff.findByPk(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        const { fullName, email, whatsapp, role, joiningDate, gender } = req.body;
        if (fullName) staff.fullName = fullName;
        if (email) staff.email = email;
        if (whatsapp) staff.whatsapp = whatsapp;
        if (role) staff.role = role;
        if (joiningDate) staff.joiningDate = joiningDate;
        if (gender) staff.gender = gender;

        await staff.save();
        res.json({ message: 'Staff updated successfully', staff });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Helper function to run robust fail-safe migrations for TiDB
async function runFailSafeMigrations() {
    console.log('Running fail-safe TiDB schema migrations...');
    try {
        await sequelize.query("ALTER TABLE `members` ADD COLUMN `isDeleted` TINYINT(1) DEFAULT 0;");
        console.log("Migration SUCCESS: Added 'isDeleted' to 'members'.");
    } catch (e) {
        // Ignored if column already exists
    }
    try {
        await sequelize.query("ALTER TABLE `members` ADD COLUMN `gender` VARCHAR(255) DEFAULT 'Male';");
        console.log("Migration SUCCESS: Added 'gender' to 'members'.");
    } catch (e) {}
    try {
        await sequelize.query("ALTER TABLE `members` MODIFY COLUMN `memberCategory` VARCHAR(255) DEFAULT 'General';");
        console.log("Migration SUCCESS: Altered 'memberCategory' column to VARCHAR(255) in 'members'.");
    } catch (e) {}

    try {
        await sequelize.query("ALTER TABLE `staffs` ADD COLUMN `isDeleted` TINYINT(1) DEFAULT 0;");
        console.log("Migration SUCCESS: Added 'isDeleted' to 'staffs'.");
    } catch (e) {}
    try {
        await sequelize.query("ALTER TABLE `staffs` ADD COLUMN `gender` VARCHAR(255) DEFAULT 'Male';");
        console.log("Migration SUCCESS: Added 'gender' to 'staffs'.");
    } catch (e) {}
    console.log('Fail-safe migrations execution complete.');
}

const { Op } = require('sequelize');
sequelize.sync({ alter: true }).then(async () => {
    await runFailSafeMigrations();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(async err => {
    console.error('DB sync alter failed, applying fail-safe schema migrations:', err.message);
    await runFailSafeMigrations();
    // Start anyway so Render doesn't crash
    app.listen(PORT, () => console.log(`Server running on port ${PORT} (running with fail-safe schemas)`));
});

