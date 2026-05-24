const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Staff = sequelize.define('Staff', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    whatsapp: { type: DataTypes.STRING },
    photo: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING, allowNull: false },
    joiningDate: { type: DataTypes.STRING },
    attendance: { type: DataTypes.JSON, defaultValue: [] },
    registrationDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'staffs',
    timestamps: true
});

module.exports = Staff;
