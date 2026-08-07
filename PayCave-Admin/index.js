'use strict';
require('dotenv').config({ path: __dirname + '/.env' });

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const { HOME_MENU } = require('./keyboard');

const prices = require('./handlers/prices');
const data = require('./handlers/data');
const session = require('./session');

// 👇 1. ADDED REFUND SESSION TRACKER VARIABLE HERE
const refundSession = {};

const syncDataPlans = require('./services/syncDataPlans')
const { handleUsersMenu, handleBanUserPrompt, handleBroadcastPrompt } = require('./src/admin/handlers/users');
const { handleTransactionsMenu,handleSearchPrompt } = require('./src/admin/handlers/transactions');


// Note: Ensure your database instance is required or imported here if it is in a separate file (e.g., const db = require('./database');)

const db = require('./database/database.js');

const token = process.env.ADMIN_BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});

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

    // 👇 2. ADDED REFUND SESSION INTERCEPTOR BLOCK HERE
    if (refundSession[chatId]) {
        const rSession = refundSession[chatId];

        if (rSession.step === 'awaiting_telegram_id') {
            rSession.telegramId = text.trim();
            rSession.step = 'awaiting_amount';
            await bot.sendMessage(chatId, `✅ Target User ID: \`${rSession.telegramId}\`\n\n💰 Now, enter the **amount** to refund (e.g., 500):`, { parse_mode: 'Markdown' });
            return;
        }

                        if (rSession.step === 'awaiting_amount') {
                                        const amount = parseFloat(text.trim());

                                                    if (isNaN(amount) || amount <= 0) {
                                                                    await bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., 1000):");
                                                                                    return;
                                                                                                }

                                                                                                            const targetUserTelegramId = rSession.telegramId;
                                                                                                                        delete refundSession[chatId]; // Clear session

                                                                                                                                    try {
                                                                                                                                                    // Directly update the user's balance safely using native sqlite3 run method
                                                                                                                                                                    await new Promise((resolve, reject) => {
                                                                                                                                                                                        db.run(
                                                                                                                                                                                                                `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                                                                                                                                                                                                                                        [amount, targetUserTelegramId],
                                                                                                                                                                                                                                                                function (err) {
                                                                                                                                                                                                                                                                                            if (err) reject(err);
                                                                                                                                                                                                                                                                                                                        else resolve(this.changes);
                                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                                                    );
                                                                                                                                                                                                                                                                                                                                                                                    });

                                                                                                                                                                                                                                                                                                                                                                                                    await bot.sendMessage(chatId, `✅ Successfully refunded *₦${amount}* to user \`${targetUserTelegramId}\`!`, { parse_mode: 'Markdown' });

                                                                                                                                                                                                                                                                                                                                                                                                                    // Optional admin log entry
                                                                                                                                                                                                                                                                                                                                                                                                                                    db.run(
                                                                                                                                                                                                                                                                                                                                                                                                                                                        `INSERT INTO admin_logs (admin_id, action, description) VALUES (?, ?, ?)`,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            [ADMIN_ID, 'MANUAL_REFUND', `Refunded ₦${amount} to user ${targetUserTelegramId}`]
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        } catch (error) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        await bot.sendMessage(chatId, `❌ Error processing refund: ${error.message}`);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                return;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
                        }
    // 👆 ========================================== 👆

    console.log("BUTTON:", msg.text);

    const current = session.get(chatId);

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
        
        case "⚙️ Settings":
        const { SETTINGS_MENU } = require('./keyboard');
        return await bot.sendMessage(msg.chat.id, "⚙️ **Admin Settings Panel**", {
            parse_mode: 'Markdown',
            ...SETTINGS_MENU
        });


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
    } 
    // 👇 3. ADDED MANUAL REFUND CALLBACK ACTION HERE
    else if (action === 'start_manual_refund') {
        const adminId = query.message.chat.id;
        refundSession[adminId] = { step: 'awaiting_telegram_id' };
        
        await bot.sendMessage(adminId, "👤 Please type or paste the customer's **Telegram ID** for this refund:", { parse_mode: 'Markdown' });
    }
    // 👆 ========================================== 👆
    else if (action === 'admin_back') {
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
    }

});
