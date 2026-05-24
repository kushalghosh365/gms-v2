const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isCloud = process.env.MYSQL_HOST && process.env.MYSQL_HOST !== 'localhost';

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || 'gms_v2',
    process.env.MYSQL_USER || 'root',
    process.env.MYSQL_PASSWORD || '',
    {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 60000,
            idle: 10000
        },
        // SSL required for TiDB Cloud
        ...(isCloud && {
            dialectOptions: {
                ssl: {
                    rejectUnauthorized: true
                },
                connectTimeout: 60000
            }
        })
    }
);

module.exports = sequelize;
