'use strict';

const { db } = require('../database/database');

// ==========================================
// CREATE TABLE
// ==========================================

db.serialize(() => {

    db.run(`

        CREATE TABLE IF NOT EXISTS prices (

            plan_id TEXT PRIMARY KEY,

            network TEXT NOT NULL,

            category TEXT NOT NULL,

            plan_name TEXT NOT NULL,

            buying_price REAL NOT NULL,

            selling_price REAL NOT NULL,

            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )

    `);

});

// ==========================================
// SAVE / UPDATE PLAN
// ==========================================

function savePrice(

    planId,

    network,

    category,

    planName,

    buyingPrice,

    sellingPrice

) {

    return new Promise((resolve, reject) => {

        db.run(

            `

            INSERT INTO prices(

                plan_id,

                network,

                category,

                plan_name,

                buying_price,

                selling_price

            )

            VALUES(?,?,?,?,?,?)

            ON CONFLICT(plan_id)

            DO UPDATE SET

                network = excluded.network,

                category = excluded.category,

                plan_name = excluded.plan_name,

                buying_price = excluded.buying_price,

                selling_price = excluded.selling_price,

                updated_at = CURRENT_TIMESTAMP

            `,

            [

                planId,

                network,

                category,

                planName,

                buyingPrice,

                sellingPrice

            ],

            err => {

                if (err)

                    reject(err);

                else

                    resolve();

            }

        );

    });

}

// ==========================================
// GET PLANS
// ==========================================

function getPlans(network, category) {

    return new Promise((resolve, reject) => {

        db.all(

            `

            SELECT *

            FROM prices

            WHERE network = ?

            AND category = ?

            ORDER BY selling_price ASC

            `,

            [

                network,

                category

            ],

            (err, rows) => {

                if (err)

                    reject(err);

                else

                    resolve(rows);

            }

        );

    });

}

// ==========================================
// GET NETWORK
// ==========================================

function getPlansByNetwork(network) {

    return new Promise((resolve, reject) => {

        db.all(

            `

            SELECT *

            FROM prices

            WHERE network = ?

            ORDER BY category, selling_price

            `,

            [

                network

            ],

            (err, rows) => {

                if (err)

                    reject(err);

                else

                    resolve(rows);

            }

        );

    });

}

// ==========================================
// UPDATE PRICE
// ==========================================

function updateSellingPrice(planId, newPrice) {

    return new Promise((resolve, reject) => {

        db.run(

            `

            UPDATE prices

            SET

                selling_price = ?,

                updated_at = CURRENT_TIMESTAMP

            WHERE

                plan_id = ?

            `,

            [

                newPrice,

                planId

            ],

            err => {

                if (err)

                    reject(err);

                else

                    resolve();

            }

        );

    });

}

// ==========================================
// GET SINGLE PLAN
// ==========================================

function getPlan(planId) {

    return new Promise((resolve, reject) => {

        db.get(

            `

            SELECT *

            FROM prices

            WHERE plan_id = ?

            `,

            [

                planId

            ],

            (err, row) => {

                if (err)

                    reject(err);

                else

                    resolve(row);

            }

        );

    });

}

// ==========================================

module.exports = {

    savePrice,

    getPlans,

    getPlansByNetwork,

    updateSellingPrice,

    getPlan

};