const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    upiId: { type: DataTypes.STRING, defaultValue: 'your-upi-id@ybl' },
    pricing: { type: DataTypes.JSON, defaultValue: [] }
}, {
    tableName: 'settings',
    timestamps: false
});

module.exports = Settings;
