'use strict';

const { setState, getState, clearState } = require('../../utils/states');
const pairgate = require('../../services/datastation');

const airtimeSessions = {};

function startAirtime(bot, msg, network) {

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

    return false;

}

// THIS IS THE MISSING FUNCTION
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