"use strict";
require('dotenv').config({ path: __dirname + '/../.env' }); // Adjust relative path to where your src/.env is located

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");

const db = require("../database/database");

const keyboards = require("./keyboards");

const wallet = require("./handlers/wallet");
const flutterwave = require("../services/flutterwave");

const airtimeHandler = require("./handlers/airtime");
const dataHandler = require("./handlers/data");
const educationHandler = require("./handlers/education");
const transactionHandler = require("./handlers/transactions");
const adminHandler = require("./handlers/admin");

const {
    setState,
    getState,
    clearState
} = require("../utils/states");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true
});

console.log("🤖 PayCave Bot Started");

// =======================================
// REGISTER USER
// =======================================

async function registerUser(msg) {

    const telegramId = String(msg.from.id);

    try {

        const user = await db.getUser(telegramId);

        if (!user) {

            await db.createUser({

                telegramId,

                username: msg.from.username || "",

                first_name: msg.from.first_name || "",

                last_name: msg.from.last_name || ""

            });

            console.log("✅ New User:", telegramId);

        }

    } catch (err) {

        console.error(err);

    }

}

// =======================================
// HOME
// =======================================

async function sendHome(chatId) {

    return bot.sendMessage(

        chatId,

        `🎉 *Welcome to PayCave*

Your reliable VTU platform.

Choose a service below.`,

        {

            parse_mode: "Markdown",

            ...keyboards.HOME_MENU

        }

    );

}

// =======================================
// /START
// =======================================

bot.onText(/\/start/, async (msg) => {

    await registerUser(msg);

    clearState(msg.from.id);

    return sendHome(msg.chat.id);

});

// =======================================
// GREETINGS
// =======================================

bot.on("message", async (msg) => {

    if (!msg.text) return;

    if (msg.text.startsWith("/")) return;

    const greetings = [

        "hi",

        "hello",

        "hey",

        "yo",

        "start",

        "good morning",

        "good afternoon",

        "good evening"

    ];

    if (greetings.includes(msg.text.trim().toLowerCase())) {

        clearState(msg.from.id);

        return sendHome(msg.chat.id);

    }

});

bot.on("message", async (msg) => {

    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    await registerUser(msg);

    const text = msg.text.trim();
    const telegramId = String(msg.from.id);
    const state = getState(msg.from.id);

    // ==================================
    // LET HANDLERS PROCESS THEIR STATES FIRST
    // ==================================

    const airtimeHandled = await airtimeHandler.handleMessage(bot, msg);
    if (airtimeHandled) return;

    const dataHandled = await dataHandler.handleMessage(bot, msg);
    if (dataHandled) return;

    // ==================================
    // WALLET FUNDING
    // ==================================

    if (state?.state === "awaiting_funding_amount") {
        const amount = Number(text);

        if (isNaN(amount) || amount < 100) {
            return bot.sendMessage(
                msg.chat.id,
                "❌ Minimum funding amount is ₦100."
            );
        }

        clearState(msg.from.id);
        return wallet.fundWalletAmount(
            bot,
            msg,
            amount
        );
    }

    // ==================================
    // SWITCH
    // ==================================

    switch (text) {

        // =========================
        // WALLET
        // =========================

        case "💰 Wallet":
            clearState(msg.from.id);
            return await wallet.openWallet(bot, msg);

        case "➕ Fund Wallet":
            clearState(msg.from.id);
            return await wallet.fundWallet(bot, msg);

        case "📜 Wallet History":
            clearState(msg.from.id);
            return await wallet.walletHistory(bot, msg);

        // =========================
        // HOME
        // =========================

        case "🏠 Home":
        case "🔙 Back":

            clearState(msg.from.id);

            return await sendHome(msg.chat.id);

        // =========================
        // DATA
        // =========================

        case "📱 Buy Data":

            clearState(msg.from.id);

            setState(
                msg.from.id,
                "data_network"
            );

            return bot.sendMessage(
                msg.chat.id,
                "📶 Select Network",
                keyboards.DATA_NETWORKS
            );

        // =========================
        // AIRTIME
        // =========================

        case "📞 Airtime":

            clearState(msg.from.id);

            setState(
                msg.from.id,
                "airtime_network"
            );

            return bot.sendMessage(
                msg.chat.id,
                "📞 Select Network",
                keyboards.AIRTIME_NETWORKS
            );

        // =========================
        // NETWORKS
        // =========================

        case "MTN":

            if (state?.state === "data_network") {

                setState(msg.from.id, "data_category", {
                    provider: "mtn"
                });

                return dataHandler.startData(bot, msg, "mtn");

            }

            return airtimeHandler.startAirtime(bot, msg, "mtn");


        case "Airtel":

            if (state?.state === "data_network") {

                setState(msg.from.id, "data_category", {
                    provider: "airtel"
                });

                return dataHandler.startData(bot, msg, "airtel");

            }

            return airtimeHandler.startAirtime(bot, msg, "airtel");


        case "Glo":

            if (state?.state === "data_network") {

                setState(msg.from.id, "data_category", {
                    provider: "glo"
                });

                return dataHandler.startData(bot, msg, "glo");

            }

            return airtimeHandler.startAirtime(bot, msg, "glo");

        case "9mobile":

            if (state?.state === "data_network") {

                setState(msg.from.id, "data_category", {
                    provider: "9mobile"
                });

                return dataHandler.startData(bot, msg, "9mobile");

            }

            return airtimeHandler.startAirtime(bot, msg, "9mobile");

        // =========================
        // DATA CATEGORIES
        // =========================

        case "🏢 Corporate Gifting":

            if (state?.state !== "data_category") return;

            state.data.planType = "CG";
            state.data.page = 1;

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                "CG",
                1
            );


        case "💼 SME":

            if (state?.state !== "data_category") return;

            state.data.planType = "SME";
            state.data.page = 1;

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                "SME",
                1
            );


        case "🎁 Gifting":

            if (state?.state !== "data_category") return;

            state.data.planType = "GIFTING";
            state.data.page = 1;

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                "GIFTING",
                1
            );


        case "🔥 Awoof":

            if (state?.state !== "data_category") return;

            state.data.planType = "AWOOF";
            state.data.page = 1;

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                "AWOOF",
                1
            );

        // =========================
        // PAGINATION
        // =========================

        case "Next ➡️":

            if (state?.state !== "data_category") return;

            state.data.page++;

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                state.data.planType,
                state.data.page
            );


        case "⬅️ Previous":

            if (state?.state !== "data_category") return;

            state.data.page = Math.max(
                state.data.page - 1,
                1
            );

            return dataHandler.startPlans(
                bot,
                msg,
                state,
                state.data.provider,
                state.data.planType,
                state.data.page
            );

        // =========================
        // OTHER SERVICES
        // =========================

        case "🎓 Education":

            clearState(msg.from.id);

            return educationHandler.startEducation(
                bot,
                msg.chat.id
            );


        case "📚 WAEC Pin":
        case "📚 NECO Pin": {
            const examType = text.includes("WAEC") ? "WAEC" : "NECO";
            setState(msg.from.id, "exam_qty", { examType });
            return educationHandler.selectQuantity(bot, msg.chat.id, examType);
        }

        case "1 WAEC":
        case "2 WAEC":
        case "3 WAEC":
        case "4 WAEC":
        case "5 WAEC":
        case "1 NECO":
        case "2 NECO":
        case "3 NECO":
        case "4 NECO":
        case "5 NECO": {
            if (state?.state !== "exam_qty") return;
            const parts = text.split(" ");
            const qty = Number(parts[0]);
            const examType = parts[1];

            setState(msg.from.id, "exam_payment", { examType, qty });
            return educationHandler.showPaymentInstructions(bot, msg.chat.id, examType, qty);
        }


        case "📊 Transactions":

            clearState(msg.from.id);

            return transactionHandler.openTransactions(
                bot,
                msg
            );


        case "💬 Contact Support":

            clearState(msg.from.id);

            return bot.sendMessage(

                msg.chat.id,

                `💬 Need help?

Contact @${process.env.SUPPORT_USERNAME}`

            );


        // =========================
        // EDUCATION SHORTCUTS
        // =========================

        case "WAEC":

            return bot.sendMessage(
                msg.chat.id,
                "🎓 WAEC Checker PIN purchase will be enabled by Admin."
            );


        case "NECO":

            return bot.sendMessage(
                msg.chat.id,
                "🎓 NECO Token purchase will be enabled by Admin."
            );


        // =========================
        // DEFAULT
        // =========================

        default:

            if (text.startsWith("✅ I Have Paid")) {
                if (state?.state === "exam_payment") {
                    const orderData = state.data;
                    clearState(msg.from.id);
                    return educationHandler.handlePaymentConfirmation(bot, msg.chat.id, orderData);
                }
            }
                                                                                                                    
            if (state) {
                clearState(msg.from.id);
            }

            return bot.sendMessage(
                msg.chat.id,
                "❓ I didn't understand that.\n\nChoose an option below.",
                keyboards.HOME_MENU
            );
    }
});

// ============================
// FLUTTERWAVE PAYMENT & CALLBACK VERIFICATION
// ============================

bot.on("callback_query", async (query) => {

    // Answer callback query immediately to stop loading spinner
    try {
        await bot.answerCallbackQuery(query.id);
    } catch (e) {}

    const data = query.data;
    const chatId = query.message.chat.id;

    if (data === 'cancel_transaction') {
        try {
            await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {}
        return bot.sendMessage(chatId, "❌ Transaction cancelled.", keyboards.HOME_MENU);
    }

    if (!data.startsWith("verify_")) return;

    const telegramId = String(query.from.id);
    const reference = data.replace("verify_", "");

    let result;

    try {

        result = await flutterwave.verifyPayment(reference);

    } catch (err) {

        console.error("Verification Error:", err);

        return bot.sendMessage(
            chatId,
            `❌ Payment verification failed.\n\n${err.message}`
        );

    }

    if (!result.success) {

        return bot.sendMessage(
            chatId,
            "❌ Payment not found yet.\n\nIf you just paid, wait a few seconds and try again."
        );

    }

    console.log("Telegram ID:", telegramId);
    console.log("Amount from Flutterwave:", result.data.amount);

    await db.updateBalance(
        telegramId,
        Number(result.data.amount)
    );

    await db.updateWalletTransactionStatus(
        reference,
        "SUCCESS"
    );

    await bot.sendMessage(
        chatId,
        `✅ Payment confirmed!

₦${Number(result.data.amount).toLocaleString()} has been added to your wallet.`
    );

});

module.exports = bot;
