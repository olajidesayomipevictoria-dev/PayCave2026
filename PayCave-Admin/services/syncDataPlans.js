'use strict';

const pairgate = require('./pairgate');
const config = require('../config');
const priceModel = require('../models/priceModel');

// ===============================
// SYNC ONE NETWORK
// ===============================

async function syncNetwork(networkName) {

    const providerId = config.NETWORKS[networkName];

    if (!providerId) {

        console.log(`❌ Unknown network: ${networkName}`);

        return;

    }

    console.log(`\n==============================`);
    console.log(`📡 Syncing ${networkName}`);
    console.log(`==============================`);

    const categories = await pairgate.getDataCategories();

    if (!categories.length) {

        console.log("❌ No categories received.");

        return;

    }

    const networkCategories = categories.filter(category => {

            const pid = String(
                    category.provider_id ??
                            category.network_id ??
                                    category.provider ??
                                            ""
                                                );

                                                    return pid === String(providerId);

                                                    });
    

    console.log(`✅ ${networkCategories.length} categories found.`);

    for (const category of networkCategories) {

        console.log(`\n➡ Category: ${category.plan_type}`);

        const plans = await pairgate.getDataPlans(
                String(providerId),
                    category.plan_type
                    );
        

        if (!plans.length) {

            console.log("⚠ No plans.");

            continue;

        }

        console.log(`📦 ${plans.length} plans received.`);

        for (const plan of plans) {

            const buyingPrice = Number(

                plan.price ??
                plan.amount ??
                0

            );

            await priceModel.savePrice(

                String(plan.plan_id || plan.id),

                networkName,

                category.plan_type,

                plan.name ||

                plan.plan_name ||

                "Unnamed Plan",

                buyingPrice,

                buyingPrice

            );

        }

        console.log(`✅ ${category.plan_type} synced.`);

    }

    console.log(`🎉 ${networkName} completed.`);

}

// ===============================
// SYNC ALL NETWORKS
// ===============================

async function syncAllNetworks() {

    console.log("\n==============================");
    console.log("🚀 PairGate Full Synchronization");
    console.log("==============================");

    await syncNetwork("🟡 MTN");

    await syncNetwork("🔴 Airtel");

    await syncNetwork("🟢 Glo");

    console.log("\n==============================");
    console.log("✅ ALL NETWORKS SYNCED");
    console.log("==============================");

}

module.exports = {

    syncNetwork,

    syncAllNetworks

};