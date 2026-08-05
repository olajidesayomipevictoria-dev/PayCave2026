'use strict';

const priceModel = require('../models/priceModel');
const session = require('../session');

// =====================================
// START PRICE EDIT
// =====================================

async function startPriceEdit(bot, chatId, plan) {

    const currentPrice = await priceModel.getPrice(plan.plan_id);

    const buyingPrice = plan.amount || plan.buying_price || 0;

    // Save the current editing session
    session.set(chatId, {
        action: 'EDIT_DATA_PRICE',
        plan
    });

    await bot.sendMessage(

        chatId,

        `💳 *Edit Data Plan Price*

📦 Plan:
${plan.name || plan.plan_name}

💰 Buying Price:
₦${buyingPrice}

💵 Current Selling Price:
₦${currentPrice || buyingPrice}

━━━━━━━━━━━━━━

✍️ Send the NEW selling price:`,

        {
            parse_mode: "Markdown"
        }

    );

}

// =====================================
// SAVE PRICE
// =====================================

async function savePrice(chatId, sellingPrice) {

    const state = session.get(chatId);

    if (!state || state.action !== 'EDIT_DATA_PRICE') {

        return false;

    }

    const plan = state.plan;

    await priceModel.savePrice(

            plan.plan_id,

                plan.provider_name,

                    plan.plan_type,

                        plan.name || plan.plan_name,

                            plan.amount,

                                Number(sellingPrice)

                                );
    

    session.clear(chatId);

    return plan;

}

module.exports = {

    startPriceEdit,

    savePrice

};