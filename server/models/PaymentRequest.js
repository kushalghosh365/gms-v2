const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentRequest = sequelize.define('PaymentRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    memberId: { type: DataTypes.INTEGER, allowNull: false },
    packageType: { type: DataTypes.STRING, allowNull: false },
    durationDays: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    transactionId: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM('Pending', 'Confirmed', 'Rejected'), defaultValue: 'Pending' },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'payment_requests',
    timestamps: false
});

module.exports = PaymentRequest;
