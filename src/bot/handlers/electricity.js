'use strict';

const {
    getProviders,
    verifyMeter,
    purchaseElectricity
} = require("../../services/pairgate");

const {
    setState,
    getState,
    clearState
} = require("../../utils/states");

let providersCache = [];

// ==========================================
// START ELECTRICITY
// ==========================================

async function startElectricity(bot, msg, page = 0) {

    const chatId = msg.chat.id;
    

    try {

        // Load providers only once
        if (providersCache.length === 0) {
            providersCache = await getProviders();
        }

        const PER_PAGE = 6;
        const start = page * PER_PAGE;
        const end = start + PER_PAGE;

        const currentProviders = providersCache.slice(start, end);

        const keyboard = [];

        currentProviders.forEach((provider, index) => {

            keyboard.push([
                {
                    text: provider.name,
                    callback_data: `elec_provider_${start + index}`
                }
            ]);

        });

        const navigation = [];

        if (page > 0) {
            navigation.push({
                text: "⬅ Previous",
                callback_data: `elec_page_${page - 1}`
            });
        }

        if (end < providersCache.length) {
            navigation.push({
                text: "Next ➡",
                callback_data: `elec_page_${page + 1}`
            });
        }

        if (navigation.length) {
            keyboard.push(navigation);
        }

        keyboard.push([
            {
                text: "🔄 Retry",
                callback_data: "elec_retry"
            },
            {
                text: "🏠 Home",
                callback_data: "elec_home"
            }
        ]);

        await bot.sendMessage(
            chatId,
            "⚡ *Choose Electricity Provider*",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }
        );

    } catch (err) {

        console.log(err.response?.data || err);

        await bot.sendMessage(
            chatId,
            "❌ Unable to load electricity providers.",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🔄 Retry",
                                callback_data: "elec_retry"
                            }
                        ],
                        [
                            {
                                text: "🏠 Home",
                                callback_data: "elec_home"
                            }
                        ]
                    ]
                }
            }
        );

    }

}
// ==========================================
// HANDLE CALLBACKS
// ==========================================

async function handleCallback(bot, query) {

    if (
        !query.data.startsWith("elec_") &&
        query.data !== "meter_prepaid" &&
        query.data !== "meter_postpaid"
    ) {
        return false;
    }

    const chatId = query.message.chat.id;
    const telegramId = String(query.from.id);

    // ==========================
    // RETRY
    // ==========================

    if (query.data === "elec_retry") {

        await bot.deleteMessage(chatId, query.message.message_id);

        await startElectricity(
            bot,
            { chat: { id: chatId } }
        );

        return true;
    }

    // ==========================
    // HOME
    // ==========================

    if (query.data === "elec_home") {

        clearState(telegramId);

        await bot.deleteMessage(chatId, query.message.message_id);

        return false;
    }

    // ==========================
    // NEXT / PREVIOUS PAGE
    // ==========================

    if (query.data.startsWith("elec_page_")) {

        const page = Number(
            query.data.replace("elec_page_", "")
        );

        await bot.deleteMessage(chatId, query.message.message_id);

        await startElectricity(
            bot,
            { chat: { id: chatId } },
            page
        );

        return true;
    }

    // ==========================
    // PROVIDER SELECTED
    // ==========================

    if (query.data.startsWith("elec_provider_")) {

        const index = Number(
            query.data.replace("elec_provider_", "")
        );

        const provider = providersCache[index];

        setState(
            telegramId,
            "awaiting_electricity_meter",
            { provider }
        );

        await bot.deleteMessage(chatId, query.message.message_id);

        await bot.sendMessage(
            chatId,
            `⚡ *${provider.name}*\n\nPlease enter your meter number.`,
            {
                parse_mode: "Markdown"
            }
        );

        return true;
    }

    // ==========================
    // METER TYPE SELECTED
    // ==========================

    if (
        query.data === "meter_prepaid" ||
        query.data === "meter_postpaid"
    ) {

        const state = getState(telegramId);

        if (
            !state ||
            state.state !== "awaiting_meter_type"
        ) {
            return true;
        }

        const meterType =
            query.data === "meter_prepaid"
                ? 1
                : 2;

        await bot.answerCallbackQuery(query.id, {
            text: "Verifying meter..."
        });

        try {

            const customer = await verifyMeter(
                state.data.provider.slug,
                state.data.meterNumber,
                meterType
            );
            console.log("VERIFY RESPONSE:");
            console.log(JSON.stringify(customer, null, 2));


            if (!customer.success && customer.message) {
                throw new Error(customer.message);
            }

            setState(
                telegramId,
                "awaiting_electricity_amount",
                {
                    provider: state.data.provider,
                    meterNumber: state.data.meterNumber,
                    meterType,
                    customer
                }
            );

            await bot.deleteMessage(
                chatId,
                query.message.message_id
            );

            await bot.sendMessage(
                chatId,
                `✅ *Meter Verified*

👤 Name: ${customer.customer_name}

💳 Meter: ${state.data.meterNumber}

Now enter the amount you want to purchase.`,
                {
                    parse_mode: "Markdown"
                }
            );

        } catch (err) {

            console.log(err.response?.data || err);

            clearState(telegramId);

            await bot.sendMessage(
                chatId,
                `❌ ${err.message || "Meter verification failed."}`
            );

        }

        return true;
    }

    return false;
}
// ==========================================
// HANDLE USER MESSAGE
// ==========================================

async function handleMessage(bot, msg) {

    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;

    const state = getState(telegramId);

    if (!state) return false;

    // ==========================
    // METER NUMBER
    // ==========================

    if (state.state === "awaiting_electricity_meter") {

        const meter = msg.text.trim();

        if (!/^[0-9]{10,13}$/.test(meter)) {

            await bot.sendMessage(
                chatId,
                "❌ Invalid meter number.\n\nPlease enter a valid meter number."
            );

            return true;
        }

        setState(
            telegramId,
            "awaiting_meter_type",
            {
                provider: state.data.provider,
                meterNumber: meter
            }
        );

        await bot.sendMessage(
            chatId,
            "⚡ Choose Meter Type",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "⚡ Prepaid",
                                callback_data: "meter_prepaid"
                            },
                            {
                                text: "🏠 Postpaid",
                                callback_data: "meter_postpaid"
                            }
                        ]
                    ]
                }
            }
        );

        return true;
    }

    // ==========================
    // AMOUNT
    // ==========================

    if (state.state === "awaiting_electricity_amount") {

        const amount = Number(msg.text);

        if (isNaN(amount) || amount < 100) {

            await bot.sendMessage(
                chatId,
                "❌ Minimum purchase amount is ₦100."
            );

            return true;
        }

        try {

            const purchase = await purchaseElectricity(
                state.data.provider.slug,
                amount,
                state.data.meterNumber,
                state.data.meterType,
                state.data.customer.customer_name
            );

            if (!purchase.success) {
                throw new Error(
                    purchase.message ||
                    "Electricity purchase failed."
                );
            }

            clearState(telegramId);

            await bot.sendMessage(
                chatId,
                `✅ *Electricity Purchase Successful*

👤 Customer: ${state.data.customer.customer_name}

💳 Meter: ${state.data.meterNumber}

💰 Amount: ₦${amount}

🔑 Token:
\`${purchase.data.token || "Not returned"}\`

📄 Reference:
${purchase.data.reference || "N/A"}`,
                {
                    parse_mode: "Markdown"
                }
            );

        } catch (err) {

            console.log(err.response?.data || err);

            clearState(telegramId);

            await bot.sendMessage(
                chatId,
                `❌ ${err.message || "Electricity purchase failed."}`
            );

        }

        return true;
    }

    return false;
}
// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    startElectricity,
    handleCallback,
    handleMessage
};