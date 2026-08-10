'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../../../database.sqlite');

// Small helper: pause between sends so we don't hit Telegram's rate limits
// (roughly 1 msg/sec per chat, ~30/sec overall across chats).
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// =======================================
// USERS MENU
// =======================================

async function handleUsersMenu(bot, msg) {
    const chatId = msg.chat.id;
    const db = new sqlite3.Database(dbPath);

    db.run(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            balance REAL DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        () => {
            db.get(`SELECT COUNT(*) as total FROM users`, async (err, row) => {
                db.close();

                if (err) {
                    console.error("Error fetching user stats:", err.message);
                    return bot.sendMessage(chatId, "❌ Failed to fetch user statistics.");
                }

                const totalUsers = row ? row.total : 0;

                const message =
                    `👥 *Users Management*\n\n` +
                    `📊 *Total Registered Users:* ${totalUsers}\n\n` +
                    `Choose an action below:`;

                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚫 Ban / Unban User', callback_data: 'admin_ban_user' }],
                            [{ text: '📢 Send Broadcast', callback_data: 'admin_broadcast' }]
                        ]
                    }
                });
            });
        }
    );
}

// =======================================
// BAN / UNBAN USER
// =======================================

async function handleBanUserPrompt(bot, msg) {
    const chatId = msg.chat.id;

    await bot.sendMessage(
        chatId,
        "🚫 *Ban / Unban User*\n\n" +
        "Please reply with the **Telegram ID** of the user you want to toggle status for:",
        { parse_mode: 'Markdown' }
    );

    bot.once('message', async (responseMsg) => {
        if (responseMsg.chat.id !== chatId) return;

        const targetId = responseMsg.text.trim();
        const db = new sqlite3.Database(dbPath);

        db.get(
            `SELECT telegram_id, status FROM users WHERE telegram_id = ?`,
            [targetId],
            (err, user) => {
                if (err || !user) {
                    db.close();
                    return bot.sendMessage(chatId, `❌ User with ID ${targetId} not found in database.`);
                }

                const newStatus = user.status === 'BANNED' ? 'ACTIVE' : 'BANNED';

                db.run(
                    `UPDATE users SET status = ? WHERE telegram_id = ?`,
                    [newStatus, targetId],
                    (updateErr) => {
                        db.close();

                        if (updateErr) {
                            return bot.sendMessage(chatId, `❌ Failed to update user status.`);
                        }

                        bot.sendMessage(
                            chatId,
                            `✅ Success! User ${targetId} status is now: *${newStatus}*`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                );
            }
        );
    });
}

// =======================================
// BROADCAST
// =======================================
// IMPORTANT: `notifyBot` must be the client authenticated with the MAIN
// customer bot's token (BOT_TOKEN), NOT the admin bot. Customers only have
// a chat open with the main bot, so only that bot identity can message them.

async function handleBroadcastPrompt(bot, msg, notifyBot, session) {
    const chatId = msg.chat.id;

    if (!notifyBot) {
        console.warn("⚠️ handleBroadcastPrompt called without notifyBot — broadcast will fail for all users.");
        return bot.sendMessage(chatId, "❌ Broadcast failed: main bot client is not configured.");
    }

    session.set(chatId, { action: "awaiting_broadcast_text" });

    await bot.sendMessage(
        chatId,
        "📢 *Send Broadcast*\n\n" +
        "Please type the message you want to broadcast to all registered users:",
        { parse_mode: 'Markdown' }
    );
}

module.exports = {
    handleUsersMenu,
    handleBanUserPrompt,
    handleBroadcastPrompt
};
