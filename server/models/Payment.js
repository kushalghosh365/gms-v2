const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    memberId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    method: { type: DataTypes.STRING, defaultValue: 'Manual' },
    packageType: { type: DataTypes.STRING },
    durationDays: { type: DataTypes.INTEGER },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'payments',
    timestamps: false
});

module.exports = Payment;
