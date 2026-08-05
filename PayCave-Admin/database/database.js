'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
    path.resolve(__dirname, '../../database.sqlite'),
    (err) => {
        if (err) {
            console.error('❌ Admin Database Error:', err.message);
        } else {
            console.log("✅ Admin Database Connected to Main SQLite File");
        }
    }
);

// ============================
// CREATE TABLES
// ============================

db.serialize(() => {
    // General service prices
    db.run(`
        CREATE TABLE IF NOT EXISTS price_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT UNIQUE,
            price REAL
        )
    `);

    // Individual data plan prices
    db.run(`
        CREATE TABLE IF NOT EXISTS prices (
            plan_id TEXT PRIMARY KEY,
            provider_id TEXT,
            network TEXT,
            category TEXT,
            plan_name TEXT,
            buying_price REAL,
            selling_price REAL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// ============================
// SAVE GENERAL PRICE
// ============================

function setPrice(service, price) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO price_settings(service, price)
            VALUES(?, ?)
            ON CONFLICT(service)
            DO UPDATE SET price = excluded.price
            `,
            [service, price],
            function(err) {
                if (err) return reject(err);
                resolve(true);
            }
        );
    });
}

// ============================
// GET GENERAL PRICE
// ============================

function getPrice(service) {
    return new Promise((resolve, reject) => {
        db.get(
            `
            SELECT price
            FROM price_settings
            WHERE service = ?
            `,
            [service],
            (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.price : null);
            }
        );
    });
}

// ============================
// GET ALL GENERAL PRICES
// ============================

function getAllPrices() {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT *
            FROM price_settings
            ORDER BY service ASC
            `,
            [],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            }
        );
    });
}

// ============================
// SET / UPDATE DATA PLAN PRICE
// ============================

function setCustomPrice(planId, providerId, network, category, planName, buyingPrice, sellingPrice) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO prices (plan_id, provider_id, network, category, plan_name, buying_price, selling_price, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(plan_id) DO UPDATE SET
                provider_id = excluded.provider_id,
                network = excluded.network,
                category = excluded.category,
                plan_name = excluded.plan_name,
                buying_price = excluded.buying_price,
                selling_price = excluded.selling_price,
                updated_at = CURRENT_TIMESTAMP
            `,
            [planId, providerId, network, category, planName, buyingPrice, sellingPrice],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes);
            }
        );
    });
}

module.exports = {
    db,
    setPrice,
    getPrice,
    getAllPrices,
    setCustomPrice
};
