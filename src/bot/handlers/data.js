'use strict';

const pairgate = require('../services/pairgate');

const CATEGORY_NAMES = {
    CG: "🏢 Corporate Gifting",
    SME: "💼 SME",
    GIFTING: "🎁 Gifting",
    AWOOF: "🔥 Awoof"
};

async function startData(bot, msg, provider) {
    try {

        const categories = await pairgate.getDataCategories();

        const providerCategories = categories.filter(
            c => c.provider_id.toLowerCase() === provider.toLowerCase()
        );

        if (!providerCategories.length) {
            return bot.sendMessage(
                msg.chat.id,
                "❌ No data categories found."
            );
        }

        const keyboard = providerCategories.map(category => [
            CATEGORY_NAMES[category.plan_type] || category.plan_type
        ]);

        keyboard.push(["⬅️ Back", "🏠 Home"]);

        bot.sendMessage(
            msg.chat.id,
            `📦 ${provider.toUpperCase()} Data\n\nChoose a data category.`,
            {
                reply_markup: {
                    keyboard,
                    resize_keyboard: true
                }
            }
        );

    } catch (err) {

        console.error(err);

        bot.sendMessage(
            msg.chat.id,
            "❌ Unable to fetch data categories."
        );
    }
}

module.exports = {
    startData
};