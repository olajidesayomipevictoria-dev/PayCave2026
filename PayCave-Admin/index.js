'use strict';
require('dotenv').config({ path: __dirname + '/.env' });

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const { HOME_MENU } = require('./keyboard');

const prices = require('./handlers/prices');
const data = require('./handlers/data');

const session = require('./session');

const syncDataPlans = require('./services/syncDataPlans')
const { handleUsersMenu, handleBanUserPrompt, handleBroadcastPrompt } = require('./src/admin/handlers/users');
const { handleTransactionsMenu,handleSearchPrompt } = require('./src/admin/handlers/transactions');


// Note: Ensure your database instance is required or imported here if it is in a separate file (e.g., const db = require('./database');)

const db = require('../src/database/database.js');

const token = process.env.ADMIN_BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});


// A second, non-polling bot client used ONLY to message customers on the
// main customer-facing bot. BOT_TOKEN must be set in PayCave-Admin/.env
// and must match the MAIN bot's token (the one customers actually chat
// with) — NOT the admin bot token (ADMIN_BOT_TOKEN).
const notifyBot = process.env.BOT_TOKEN
    ? new TelegramBot(process.env.BOT_TOKEN, { polling: false })
    : null;

if (!notifyBot) {
    console.warn("⚠️ BOT_TOKEN not set — manual credits will NOT notify customers automatically.");
}


const ADMIN_ID = Number(process.env.ADMIN_ID);

console.log("✅ PayCave Admin Bot Started");

// ===============================
// START
// ===============================

bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== ADMIN_ID) {
        return bot.sendMessage(
            msg.chat.id,
            "⛔ Access denied."
        );
    }

    bot.sendMessage(
        msg.chat.id,
        "👑 *PayCave Admin Panel*\n\nWelcome back, Admin.",
        {
            parse_mode: "Markdown",
            ...HOME_MENU
        }
    );
});

// ===============================
// BUTTON & MESSAGE HANDLER
// ===============================

bot.on("message", async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    console.log("BUTTON:", msg.text);

    const current = session.get(chatId);


    // Safeguard for multi-step flows if session clears or restarts
    if (current && current.action && current.action.startsWith("await_credit_")) {
        if (text === "🏠 Home" || text === "🔙 Back") {
            session.clear(chatId);
            // route back home...
        }
    }


    // 1. Handle Navigation & Static Menu Switches first
    switch (text) {
        case "🏠 Home":
        case "🔙 Back":
            session.clear(chatId);
            return bot.sendMessage(
                chatId,
                "👑 *PayCave Admin Panel*\n\nWelcome back, Admin.",
                {
                    parse_mode: "Markdown",
                    ...HOME_MENU
                }
            );

        case "💳 Prices":
            return await prices.openPrices(bot, chatId);

        case "📶 Data Prices":
            return await data.openDataMenu(bot, chatId);

        case "🟡 MTN":
            return await data.openNetwork(bot, chatId, "🟡 MTN");

        case "🔴 Airtel":
            return await data.openNetwork(bot, chatId, "🔴 Airtel");

        case "🟢 Glo":
            return await data.openNetwork(bot, chatId, "🟢 Glo");

        case "⬅ Previous":
            if (current) {
                await data.openPlanType(
                    bot,
                    chatId,
                    current.network,
                    current.category,
                    current.page - 1
                );
            }
            return;

        case "Next ➡":
            if (current) {
                await data.openPlanType(
                    bot,
                    chatId,
                    current.network,
                    current.category,
                    current.page + 1
                );
            }
            return;

        case "🔄 Sync PairGate":
            await bot.sendMessage(
                chatId,
                "🔄 Starting PairGate synchronization...\n\nPlease wait..."
            );
            try {
                await data.syncPairGate(bot, chatId);
                await bot.sendMessage(
                    chatId,
                    "✅ PairGate synchronization completed successfully."
                );
            } catch (err) {
                console.log(err);
                await bot.sendMessage(
                    chatId,
                    "❌ PairGate synchronization failed."
                );
            }
            return;

        case "📱 Airtime Prices":
            return bot.sendMessage(chatId, "📱 Airtime Price Management\n\nComing next...");
        case "📺 Cable Prices":
            return bot.sendMessage(chatId, "📺 Cable Price Management\n\nComing next...");
        case "⚡ Electricity Prices":
            return bot.sendMessage(chatId, "⚡ Electricity Price Management\n\nComing next...");
        case "📚 Education":
            return bot.sendMessage(chatId, "📚 Education Module\n\nComing next...");
        case "👥 Users":
            return await handleUsersMenu(bot, msg, db);
        case "📊 Transactions":
        return await handleTransactionsMenu(bot, msg);


        case "💰 Credit Wallet":
            session.set(chatId, { action: "await_credit_telegram_id" });
            return bot.sendMessage(
                chatId,
                "Enter the customer's Telegram ID to credit their wallet:"
            );


        case "💸 Refund Wallet Tx":
            session.set(chatId, { action: "await_refund_reference" });
            return bot.sendMessage(
                chatId,
                "Send wallet transaction reference to refund.\nExample: FLW-123456789"
            );

        case "⚙️ Settings":
        const { SETTINGS_MENU } = require('./keyboard');
        return await bot.sendMessage(msg.chat.id, "⚙️ **Admin Settings Panel**", {
            parse_mode: 'Markdown',
            ...SETTINGS_MENU
        });


    }

    if (current?.action === "await_refund_reference") {
        const reference = text.trim();

        try {
            const result = await db.refundWalletByReference(reference, ADMIN_ID);

            if (!result.ok) {
                if (result.reason === "NOT_FOUND") {
                    return bot.sendMessage(chatId, "❌ Transaction not found.");
                }
                if (result.reason === "ALREADY_REFUNDED") {
                    session.clear(chatId);
                    return bot.sendMessage(chatId, "⚠️ This transaction has already been refunded.");
                }
                if (result.reason === "NOT_SUCCESS") {
                    return bot.sendMessage(chatId, "❌ Only SUCCESS transactions can be refunded.");
                }
                if (result.reason === "INSUFFICIENT_BALANCE") {
                    return bot.sendMessage(chatId, "❌ User wallet balance is lower than refund amount.");
                }
                return bot.sendMessage(chatId, "❌ Refund could not be processed.");
            }

            session.clear(chatId);

            const tx = result.tx;
            return bot.sendMessage(
                chatId,
                `✅ Refund successful\n\nRef: ${reference}\nUser: ${tx.telegram_id}\nAmount: ₦${Number(tx.amount).toLocaleString()}`
            );
        } catch (err) {
            console.error("Refund error:", err);
            return bot.sendMessage(chatId, "❌ Refund failed due to a system error.");
        }
    }


    // ===============================
    // MANUAL CREDIT WALLET FLOW
    // ===============================

    // STEP 1: telegram id entered
    if (current?.action === "await_credit_telegram_id") {
        const telegramId = text.trim();
        const user = await db.getUser(telegramId);

        if (!user) {
            return bot.sendMessage(
                chatId,
                "❌ No user found with that Telegram ID. Try again, or tap 🏠 Home to cancel."
            );
        }

        const userName = user.first_name || user.username || telegramId;

        session.set(chatId, {
            action: "await_credit_amount",
            telegramId,
            userName
        });

        return bot.sendMessage(
            chatId,
            `Found: ${userName}\nCurrent balance: ₦${Number(user.balance).toLocaleString()}\n\nEnter the amount to credit:`
        );
    }

    // STEP 2: amount entered
    if (current?.action === "await_credit_amount") {
        const amount = Number(text.trim());

        if (!amount || amount <= 0 || isNaN(amount)) {
            return bot.sendMessage(chatId, "❌ Enter a valid amount (numbers only).");
        }

        session.set(chatId, { ...current, action: "await_credit_reason", amount });

        return bot.sendMessage(
            chatId,
            `Enter a short reason for this credit (e.g. "Failed MTN 1GB data - VTU declined").\nType "skip" to leave it blank.`
        );
    }

    // STEP 3: reason entered -> confirm
    if (current?.action === "await_credit_reason") {
        const reason = text.trim().toLowerCase() === "skip" ? null : text.trim();

        session.set(chatId, { ...current, action: "await_credit_confirm", reason });

        return bot.sendMessage(
            chatId,
            `⚠️ *Confirm Wallet Credit*\n\n` +
            `User: ${current.userName} (${current.telegramId})\n` +
            `Amount: ₦${current.amount.toLocaleString()}\n` +
            `Reason: ${reason || "N/A"}\n\n` +
            `Proceed?`,
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Confirm", callback_data: "confirm_manual_credit" },
                            { text: "❌ Cancel", callback_data: "cancel_manual_credit" }
                        ]
                    ]
                }
            }
        );
    }



    // 2. Handle Edit Plan selection trigger (starts with ✏ )
    if (text.startsWith("✏ ")) {
        await data.openPlan(
            bot,
            chatId,
            text.replace("✏ ", "")
        );
        return;
    }

    // 3. Handle Active Price Modification Input
    if (current && current.editingPlan) {
        const updated = await data.updatePrice(
            bot,
            chatId,
            text
        );
        if (updated) {
            return;
        }
    }

    // 4. Handle Category Selection Flow
    if (
        current &&
        current.network &&
        !text.startsWith("✏") &&
        text !== "⬅ Previous" &&
        text !== "Next ➡"
    ) {
        const plans = await data.getPlansByCategory(
            current.network,
            text
        );

        if (plans && plans.length > 0) {
            await data.openPlanType(
                bot,
                chatId,
                current.network,
                text,
                0
            );
            return;
        }
    }
});

// ===============================
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// ===============================

bot.on("callback_query", async (query) => {
    if (query.from.id !== ADMIN_ID) return;

    const action = query.data;
    const msg = query.message;

    try {
        await bot.answerCallbackQuery(query.id);
    } catch (err) {
        console.error("Error answering callback query:", err);
    }

    if (action === 'admin_users') {
        await handleUsersMenu(bot, msg);
    } else if (action === 'admin_ban_user') {
        await handleBanUserPrompt(bot, msg);
    } else if (action === 'admin_broadcast') {
        await handleBroadcastPrompt(bot, msg);
    } else if (action === 'admin_transactions') {
        await handleTransactionsMenu(bot, msg);
    } else if (action === 'search_vtu_tx') {
        await handleSearchPrompt(bot, query, 'vtu');
    } else if (action === 'search_wallet_tx') {
        await handleSearchPrompt(bot, query, 'wallet');
    } else if (action === 'admin_back') {
        // Return to home menu or previous view
        bot.deleteMessage(query.message.chat.id, query.message.message_id);
        bot.sendMessage(query.message.chat.id, "🏠 **Admin Home Menu**", { ...HOME_MENU });
    } else if (action === 'toggle_maintenance') {
        const currentState = process.env.MAINTENANCE_MODE === 'true';
        process.env.MAINTENANCE_MODE = currentState ? 'false' : 'true';
        const newState = process.env.MAINTENANCE_MODE === 'true';

        const updatedKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: newState ? "🛠️ Maintenance: ON" : "🟢 Maintenance: OFF",
                        callback_data: "toggle_maintenance"
                    }
                ],
                [
                    { text: "🔙 Back", callback_data: "admin_back" }
                ]
            ]
        };

        bot.editMessageText(`⚙️ **Admin Settings Panel**\n\nMaintenance mode is currently **${newState ? 'ACTIVE (Locked)' : 'OFF (Normal)'}**`, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: updatedKeyboard
        });

        bot.answerCallbackQuery(query.id, { text: newState ? "Maintenance Enabled 🛠️" : "Maintenance Disabled 🟢" });

    } else if (action === 'confirm_manual_credit') {
        const chatId = query.message.chat.id;
        const current = session.get(chatId);

        if (!current || current.action !== "await_credit_confirm") {
            return bot.sendMessage(chatId, "⚠️ Session expired. Please start again.");
        }

        try {
            const result = await db.manualCreditUser(
                current.telegramId,
                current.amount,
                ADMIN_ID,
                current.reason
            );

            session.clear(chatId);

            if (!result.ok) {
                return bot.sendMessage(chatId, "❌ Credit failed: user not found.");
            }

            const newBalance = await db.getBalance(current.telegramId);

            await bot.sendMessage(
                chatId,
                `✅ Wallet credited successfully.\n\nUser: ${current.userName}\nAmount: ₦${current.amount.toLocaleString()}\nNew Balance: ₦${Number(newBalance).toLocaleString()}\nRef: ${result.reference}`
            );

            if (notifyBot) {
                try {
                    await notifyBot.sendMessage(
                        current.telegramId,
                        `✅ *Wallet Credited*\n\n` +
                        `Your wallet has been credited with ₦${current.amount.toLocaleString()}.\n\n` +
                        (current.reason ? `Reason: ${current.reason}\n\n` : "") +
                        `New Balance: ₦${Number(newBalance).toLocaleString()}\n\n` +
                        `Thank you for your patience 🙏`,
                        { parse_mode: "Markdown" }
                    );
                } catch (notifyErr) {
                    console.error("Failed to notify customer:", notifyErr.message);
                    await bot.sendMessage(
                        chatId,
                        "⚠️ Credit succeeded but I couldn't message the customer directly (they may not have started the main bot)."
                    );
                }
            }
        } catch (err) {
            console.error("Manual credit error:", err);
            session.clear(chatId);
            return bot.sendMessage(chatId, "❌ Credit failed due to a system error.");
        }
    } else if (action === 'cancel_manual_credit') {
        const chatId = query.message.chat.id;
        session.clear(chatId);
        return bot.sendMessage(chatId, "❌ Credit cancelled.");
    }

});
