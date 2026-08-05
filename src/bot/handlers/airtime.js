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

    // AMOUNT
    if (state.state === "awaiting_airtime_amount") {

        // Check for Back or Home navigation buttons before parsing number
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

        airtimeSessions[msg.from.id] = {
            network: state.data.network,
            phone: state.data.phone,
            amount
        };

        clearState(msg.from.id);

        await bot.sendMessage(
            msg.chat.id,
            `🧾 *Review Purchase*

📱 Phone: ${state.data.phone}
💵 Amount: ₦${amount}

Reply with:

YES → Confirm
NO → Cancel`,
            {
                parse_mode: "Markdown"
            }
        );

        setState(msg.from.id, "awaiting_airtime_confirmation");

        return true;
    }

    // CONFIRMATION
    if (state.state === "awaiting_airtime_confirmation") {
        const text = msg.text ? msg.text.trim().toLowerCase() : "";
        
        if (text === "yes") {
            // Grab details from state data and execute purchase
            await buyAirtime(msg, state.data.network, state.data.phone, state.data.amount);
            clearState(msg.from.id);
            return true;
        } else if (text === "no") {
            clearState(msg.from.id);
            await bot.sendMessage(msg.chat.id, "❌ Airtime purchase cancelled.");
            return true;
        } else {
            await bot.sendMessage(msg.chat.id, "❌ I didn't understand that. Please reply with YES or NO.");
            return true;
        }
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
