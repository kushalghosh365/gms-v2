# Gym Management System V2

This project is a modern, automated Gym Management System designed for the owner and members.

## Features
- **Member Kiosk**: IN/OUT attendance and Self-Renewal using Mobile Number.
- **Owner Dashboard**: Live attendance tracking, member management, and expiry alerts.
- **Automated Logic**: Prevents OUT if not IN, checks membership validity before IN.
- **Dummy Payment**: GPay simulated payment for quick demo.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, MongoDB.

## How to Run
1. **Backend**:
   - `cd server`
   - `npm install`
   - `nodemon index.js` (Server runs on port 5000)
2. **Frontend**:
   - `cd client`
   - `npm install`
   - `npm run dev` (Runs on port 5173)

## Mobile Number Login
Use the Mobile Number as the unique ID for members.
