const fs = require('fs');
const path = 'c:/Users/KUSHAL GHOSH/Desktop/GYM/gms-v2/server/index.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove whatsapp-web.js imports and initialization
content = content.replace(/const { Client, LocalAuth } = require\('whatsapp-web\.js'\);[\s\S]*?initializeWhatsApp\(\);/, '');

// 2. Remove WA sending from OTP
const otpBlockRegex = /[ \t]*if \(waClient && waStatus === 'CONNECTED'\) \{[\s\S]*?\}\n/g;
content = content.replace(otpBlockRegex, '');
content = content.replace("'OTP sent successfully (check terminal or WhatsApp if connected)'", "'OTP sent successfully (check terminal)'");

// 3. Remove WA routes block
content = content.replace(/\/\/ --- WHATSAPP ROUTES ---[\s\S]*?(?=\/\/ 1\. Register Member)/, '');

// 4. Remove Send QR Code block
content = content.replace(/\/\/ =============================================\r?\n\/\/ WHATSAPP: Send QR Code to member\/staff[\s\S]*?(?=const PORT = )/, '');

fs.writeFileSync(path, content);
console.log('Successfully updated server/index.js');
