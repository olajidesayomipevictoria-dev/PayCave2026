'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database Error:', err.message);
    } else {
        console.log('✅ SQLite Connected');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS data_prices (
                plan_id TEXT PRIMARY KEY,
                provider_name TEXT,
                plan_type TEXT,
                plan_name TEXT,
                buying_price REAL,
                selling_price REAL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                balance REAL DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT,
                reference TEXT UNIQUE,
                amount REAL,
                type TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS service_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT,
                reference TEXT UNIQUE,
                service TEXT,
                provider TEXT,
                recipient TEXT,
                amount REAL,
                profit REAL,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS education_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT,
                reference TEXT UNIQUE,
                exam TEXT,
                amount REAL,
                pin TEXT,
                serial TEXT,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS cable_sessions (
                telegram_id TEXT PRIMARY KEY,
                provider TEXT,
                step TEXT,
                iuc_number TEXT,
                customer_name TEXT,
                bouquet_code TEXT,
                bouquet_name TEXT,
                amount REAL,
                current_page INTEGER,
                tx_ref TEXT
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id TEXT,
                action TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference TEXT UNIQUE,
                bank_name TEXT,
                account_number TEXT,
                account_name TEXT,
                amount REAL,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });
}

// ================= USERS =================

db.getUser = function (telegramId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM users WHERE telegram_id=?`,
            [telegramId],
            (err, row) => {
                if (err) return reject(err);
                resolve(row);
            }
        );
    });
};

db.createUser = function (user) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR IGNORE INTO users
            (telegram_id,username,first_name,last_name)
            VALUES(?,?,?,?)`,
            [
                user.telegramId,
                user.username,
                user.first_name,
                user.last_name
            ],
            function(err){
                if(err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
};

// ================= BALANCE =================

db.getBalance = function (telegramId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT balance FROM users WHERE telegram_id=?`,
            [telegramId],
            (err,row)=>{
                if(err) return reject(err);
                resolve(row ? row.balance : 0);
            }
        );
    });
};

db.updateBalance = function (telegramId, amount) {
    return new Promise((resolve,reject)=>{
        db.run(
            `UPDATE users
             SET balance = balance + ?
             WHERE telegram_id=?`,
            [
                amount,
                telegramId
            ],
            function (err) {
                if (err) {
                    console.error("Update Balance Error:", err);
                    return reject(err);
                }
                console.log("Rows updated:", this.changes);
                if (this.changes === 0) {
                    return reject(new Error("No user found with telegram_id: " + telegramId));
                }
                resolve();
            }
        );
    });
};

// ================= WALLET =================

db.saveWalletTransaction = function(data){
    return new Promise((resolve,reject)=>{
        db.run(
            `INSERT INTO wallet_transactions
            (telegram_id,reference,amount,type,status)
            VALUES(?,?,?,?,?)`,
            [
                data.telegramId,
                data.reference,
                data.amount,
                data.type,
                data.status
            ],
            function(err){
                if(err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
};

db.getWalletHistory = function(telegramId){
    return new Promise((resolve,reject)=>{
        db.all(
            `SELECT *
             FROM wallet_transactions
             WHERE telegram_id=?
             ORDER BY id DESC
             LIMIT 10`,
            [telegramId],
            (err,rows)=>{
                if(err) return reject(err);
                resolve(rows);
            }
        );
    });
};

// ================= SERVICES =================

db.saveServiceTransaction = function(data){
    return new Promise((resolve,reject)=>{
        db.run(
            `INSERT INTO service_transactions
            (telegram_id,reference,service,provider,recipient,amount,profit,status)
            VALUES(?,?,?,?,?,?,?,?)`,
            [
                data.telegramId,
                data.reference,
                data.service,
                data.provider,
                data.recipient,
                data.amount,
                data.profit,
                data.status
            ],
            function(err){
                if(err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
};

db.updateWalletTransactionStatus = function(reference, status) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE wallet_transactions
             SET status = ?
             WHERE reference = ?`,
            [status, reference],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            }
        );
    });
};

// ================= DEDUCT WALLET =================

db.deductBalance = function (telegramId, amount) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users
             SET balance = balance - ?
             WHERE telegram_id = ?
             AND balance >= ?`,
            [
                amount,
                telegramId,
                amount
            ],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes);
            }
        );
    });
};

// ================= PRICES =================

db.getCustomPrice = function (planId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT selling_price FROM data_prices WHERE plan_id = ?`,
            [planId],
            (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.selling_price : null);
            }
        );
    });
};

module.exports = db;
