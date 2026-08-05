'use strict';

const priceModel = require('../models/priceModel');
const session = require('../session');
const syncDataPlans = require('../services/syncDataPlans');

const PAGE_SIZE = 10;

// ==========================================
// DATA MENU
// ==========================================

async function openDataMenu(bot, chatId) {

    return bot.sendMessage(

        chatId,

        "📶 *Data Price Management*\n\nChoose a network:",

        {

            parse_mode: "Markdown",

            reply_markup: {

                resize_keyboard: true,

                keyboard: [

                    ["🟡 MTN"],

                    ["🔴 Airtel"],

                    ["🟢 Glo"],

                    ["🔄 Sync PairGate"],

                    ["🏠 Home"]

                ]

            }

        }

    );

}

// ==========================================
// NETWORK
// ==========================================

async function openNetwork(bot, chatId, networkName) {

    const plans = await priceModel.getPlansByNetwork(networkName);

    if (!plans || plans.length === 0) {

        return bot.sendMessage(

            chatId,

            "❌ No plans found.\n\nPlease run *🔄 Sync PairGate* first.",

            {

                parse_mode: "Markdown"

            }

        );

    }

    const categories = [

        ...new Set(

            plans.map(plan => plan.category)

        )

    ];

    const keyboard = categories.map(category => [

        category

    ]);

    keyboard.push([

        "🔙 Back",

        "🏠 Home"

    ]);

    session.set(chatId, {

        network: networkName,

        page: 0

    });

    return bot.sendMessage(

        chatId,

        `📶 *${networkName} Categories*`,

        {

            parse_mode: "Markdown",

            reply_markup: {

                resize_keyboard: true,

                keyboard

            }

        }

    );

}

// ==========================================
// OPEN CATEGORY (DATABASE + PAGINATION)
// ==========================================

async function openPlanType(bot, chatId, networkName, category, page = 0) {

    const plans = await priceModel.getPlans(networkName, category);

    if (!plans || plans.length === 0) {

        return bot.sendMessage(

            chatId,

            "❌ No plans found."

        );

    }

    const totalPages = Math.ceil(plans.length / PAGE_SIZE);

    if (page < 0) page = 0;

    if (page >= totalPages) page = totalPages - 1;

    const start = page * PAGE_SIZE;

    const end = start + PAGE_SIZE;

    const currentPlans = plans.slice(start, end);

    const keyboard = [];

    for (const plan of currentPlans) {

        keyboard.push([

            `✏ ${plan.plan_name}`

        ]);

    }

    const nav = [];

    if (page > 0) {

        nav.push("⬅ Previous");

    }

    if (page < totalPages - 1) {

        nav.push("Next ➡");

    }

    if (nav.length) {

        keyboard.push(nav);

    }

    keyboard.push([

        "🔙 Back",

        "🏠 Home"

    ]);

    session.set(chatId, {
    network: networkName,
    category,
    page,
    editingPlan: null
});

    return bot.sendMessage(

        chatId,

        `📦 *${networkName}*\n` +
        `📂 ${category}\n\n` +
        `Page ${page + 1} of ${totalPages}`,

        {

            parse_mode: "Markdown",

            reply_markup: {

                resize_keyboard: true,

                keyboard

            }

        }

    );

}

// ==========================================
// OPEN PLAN
// ==========================================

async function openPlan(bot, chatId, planName) {

    const current = session.get(chatId);

    if (!current) {

        return bot.sendMessage(
            chatId,
            "❌ Session expired."
        );

    }

    const plans = await priceModel.getPlans(

        current.network,

        current.category

    );

    const plan = plans.find(

        p => p.plan_name === planName

    );

    if (!plan) {

        return bot.sendMessage(
            chatId,
            "❌ Plan not found."
        );

    }

    session.set(chatId, {

    network: current.network,

    category: current.category,

    page: current.page,

    editingPlan: plan.plan_id

});

    return bot.sendMessage(

        chatId,

        `📦 *${plan.plan_name}*\n\n` +

        `💰 Buying Price: ₦${plan.buying_price}\n` +

        `💵 Selling Price: ₦${plan.selling_price}\n\n` +

        `✍ Send the NEW selling price.`,

        {

            parse_mode: "Markdown"

        }

    );

}


// ==========================================
// UPDATE PRICE
// ==========================================

async function updatePrice(bot, chatId, newPrice) {

    const current = session.get(chatId);

        if (!current || !current.editingPlan) {
                return false;
                    }

                        const price = Number(newPrice);

                            if (isNaN(price) || price <= 0) {

                                    await bot.sendMessage(
                                                chatId,
                                                            "❌ Invalid price."
                                                                    );

                                                                            return true;
                                                                                }

                                                                                    await priceModel.updateSellingPrice(
                                                                                            current.editingPlan,
                                                                                                    price
                                                                                                        );

                                                                                                            // Leave edit mode completely and reset editingPlan
                                                                                                                session.set(chatId, {
                                                                                                                        network: current.network,
                                                                                                                                category: current.category,
                                                                                                                                        page: current.page,
                                                                                                                                                editingPlan: null
                                                                                                                                                    });

                                                                                                                                                        await bot.sendMessage(
                                                                                                                                                                chatId,
                                                                                                                                                                        `✅ Selling price updated to ₦${price}`
                                                                                                                                                                            );

                                                                                                                                                                                return openPlanType(
                                                                                                                                                                                        bot,
                                                                                                                                                                                                chatId,
                                                                                                                                                                                                        current.network,
                                                                                                                                                                                                                current.category,
                                                                                                                                                                                                                        current.page
                                                                                                                                                                                                                            );
                                                                                                                                                                                                                            }
                                                                                                                                                                                                                            


    

    




    

        
            
            
        

        
    

    
        
        
    

    
    

        
    
        



    
        
        


    
        
        
        
        
        
    




// ==========================================
// GET PLANS BY CATEGORY
// ==========================================

async function getPlansByCategory(network, category) {

    return await priceModel.getPlans(

            network,

                    category

                        );

                        }

                        // ==========================================
                        // NEXT PAGE
                        // ==========================================

                        async function nextPage(bot, chatId) {

                            const state = session.get(chatId);

                                if (!state) return;

                                    return openPlanType(

                                            bot,

                                                    chatId,

                                                            state.network,

                                                                    state.category,

                                                                            state.page + 1

                                                                                );

                                                                                }

                                                                                // ==========================================
                                                                                // PREVIOUS PAGE
                                                                                // ==========================================

                                                                                async function previousPage(bot, chatId) {

                                                                                    const state = session.get(chatId);

                                                                                        if (!state) return;

                                                                                            return openPlanType(

                                                                                                    bot,

                                                                                                            chatId,

                                                                                                                    state.network,

                                                                                                                            state.category,

                                                                                                                                    state.page - 1

                                                                                                                                        );

                                                                                                                                        }

                                                                                                                                        // ==========================================
                                                                                                                                        // BACK TO CATEGORY
                                                                                                                                        // ==========================================

                                                                                                                                        async function backToCategories(bot, chatId) {

                                                                                                                                            const state = session.get(chatId);

                                                                                                                                                if (!state) {

                                                                                                                                                        return openDataMenu(

                                                                                                                                                                    bot,

                                                                                                                                                                                chatId

                                                                                                                                                                                        );

                                                                                                                                                                                            }

                                                                                                                                                                                                return openNetwork(

                                                                                                                                                                                                        bot,

                                                                                                                                                                                                                chatId,

                                                                                                                                                                                                                        state.network

                                                                                                                                                                                                                            );

                                                                                                                                                                                                                            }

// ==========================================
// SYNC PAIRGATE
// ==========================================

async function syncPairGate(bot, chatId) {

    await bot.sendMessage(

            chatId,

                    "🔄 Syncing PairGate...\nPlease wait..."

                        );

                            try {

                                    await syncDataPlans.syncAllNetworks();

                                            await bot.sendMessage(

                                                        chatId,

                                                                    "✅ PairGate Sync Completed."

                                                                            );

                                                                                } catch (err) {

                                                                                        console.log(err);

                                                                                                await bot.sendMessage(

                                                                                                            chatId,

                                                                                                                        "❌ PairGate Sync Failed."

                                                                                                                                );

                                                                                                                                    }

                                                                                                                                    }

        
                                                                                                                                                                                                                       module.exports = {

                                                                                                                                                                                                                           openDataMenu,

                                                                                                                                                                                                                               openNetwork,

                                                                                                                                                                                                                                   openPlanType,

                                                                                                                                                                                                                                       openPlan,

                                                                                                                                                                                                                                           updatePrice,

                                                                                                                                                                                                                                               getPlansByCategory,

                                                                                                                                                                                                                                                   nextPage,

                                                                                                                                                                                                                                                       previousPage,

                                                                                                                                                                                                                                                           backToCategories,

                                                                                                                                                                                                                                                               syncPairGate

                                                                                                                                                                                                                                                               };