const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Member = sequelize.define('Member', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    whatsapp: { type: DataTypes.STRING },
    photo: { type: DataTypes.STRING },
    membershipStatus: { type: DataTypes.ENUM('Valid', 'Expired'), defaultValue: 'Expired' },
    expiryDate: { type: DataTypes.DATE },
    plan: { type: DataTypes.STRING },
    memberCategory: { type: DataTypes.STRING, defaultValue: 'General' },
    packageType: { type: DataTypes.STRING },
    attendance: { type: DataTypes.JSON, defaultValue: [] },
    paymentNotification: { type: DataTypes.STRING, defaultValue: null },
    registrationDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    gender: { type: DataTypes.STRING, defaultValue: 'Male' }
}, {
    tableName: 'members',
    timestamps: true
});

module.exports = Member;
