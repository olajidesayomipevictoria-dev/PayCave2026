'use strict';

const { setState, getState, clearState } = require('../../utils/states');
const pairgate = require('../../services/pairgate');

const airtimeSessions = {};

function startAirtime(bot, msg, network) {
    clearState(msg.from.id);

    airtimeSessions[msg.from.id] = { network };

    setState(msg.from.id, "awaiting_airtime_phone", {
        network
    });

    bot.sendMessage(
        msg.chat.id,
        "📱 *Airtime Purchase*\n\nPlease enter the recipient phone number.\n\nExample:\n08031234567",
        {
            parse_mode: "Markdown"
        }
    );
}

async function handleMessage(bot, msg) {
    const state = getState(msg.from.id);

    if (!state) return false;

    // PHONE
    if (state.state === "awaiting_airtime_phone") {

        if (msg.text === "🔙 Back" || msg.text === "🏠 Home") {
            clearState(msg.from.id);
            return false;
        }

        console.log("BUTTON PRESSED:", JSON.stringify(msg.text));

        if (!/^0\d{10}$/.test(msg.text)) {
            await bot.sendMessage(
                msg.chat.id,
                "❌ Invalid phone number.\n\nPlease enter a valid Nigerian phone number."
            );
            return true;
        }

        setState(msg.from.id, "awaiting_airtime_amount", {
            network: state.data.network,
            phone: msg.text
        });

        await bot.sendMessage(
            msg.chat.id,
            "💰 Enter airtime amount:"
        );

        return true;
    }

    // AMOUNT & IMMEDIATE PURCHASE
    if (state.state === "awaiting_airtime_amount") {

        // Check for Back or Home navigation buttons
        if (msg.text && (msg.text.includes("Back") || msg.text.includes("Home") || msg.text === "/start")) {
            clearState(msg.from.id);
            return false;
        }

        const amount = Number(msg.text);

        if (isNaN(amount) || amount < 50) {
            await bot.sendMessage(
                msg.chat.id,
                "❌ Minimum airtime amount is ₦50."
            );
            return true;
        }

        const network = state.data.network;
        const phone = state.data.phone;

        // Clear state first so the user isn't trapped if something fails
        clearState(msg.from.id);

        await bot.sendMessage(
            msg.chat.id,
            "⏳ Processing your airtime purchase..."
        );

        // Execute purchase directly
        const result = await buyAirtime(msg, network, phone, amount);

        if (result && result.success) {
            await bot.sendMessage(
                msg.chat.id,
                `✅ *Airtime Purchase Successful!*\n\n📱 Phone: ${phone}\n💵 Amount: ₦${amount}\n💬 Message: ${result.message || "Completed"}`,
                { parse_mode: "Markdown" }
            );
        } else {
            await bot.sendMessage(
                msg.chat.id,
                `❌ Purchase failed: ${result?.message || "Please try again later."}`
            );
        }

        return true;
    }

    return false;
}

async function buyAirtime(msg, network, phone, amount) {
    return await pairgate.buyAirtime(
        network,
        phone,
        amount
    );
}

module.exports = {
    startAirtime,
    handleMessage,
    buyAirtime,
    airtimeSessions
};
