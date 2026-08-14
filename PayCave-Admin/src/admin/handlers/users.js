'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../../../database.sqlite');

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
                            [{ text: '📋 View All Users', callback_data: 'admin_users_list_0' }],
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
// VIEW ALL USERS (PAGINATED)
// =======================================

const USERS_PER_PAGE = 10;

async function handleUsersListPage(bot, chatId, page = 0, messageId = null) {
    const db = new sqlite3.Database(dbPath);

    db.get(`SELECT COUNT(*) as total FROM users`, (countErr, countRow) => {
        if (countErr) {
            db.close();
            return bot.sendMessage(chatId, "❌ Failed to fetch users.");
        }

        const total = countRow ? countRow.total : 0;

        if (total === 0) {
            db.close();
            return bot.sendMessage(chatId, "No users found yet.");
        }

        const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
        const safePage = Math.min(Math.max(page, 0), totalPages - 1);
        const offset = safePage * USERS_PER_PAGE;

        db.all(
            `SELECT telegram_id, username, first_name, balance, status
             FROM users
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            [USERS_PER_PAGE, offset],
            async (err, rows) => {
                db.close();

                if (err || !rows || rows.length === 0) {
                    return bot.sendMessage(chatId, "❌ Failed to fetch users.");
                }

                let text = `👥 All Users (Page ${safePage + 1}/${totalPages}, Total: ${total})\n\n`;

                rows.forEach((u, i) => {
                    const name = u.first_name || u.username || "Unknown";
                    const statusIcon = u.status === 'BANNED' ? '🚫 BANNED' : '✅ ACTIVE';
                    text += `${offset + i + 1}. ${name} — ${statusIcon}\n` +
                            `    ID: ${u.telegram_id}\n` +
                            `    Balance: ₦${Number(u.balance).toLocaleString()}\n\n`;
                });

                const navRow = [];
                if (safePage > 0) {
                    navRow.push({ text: '⬅ Previous', callback_data: `admin_users_list_${safePage - 1}` });
                }
                if (safePage < totalPages - 1) {
                    navRow.push({ text: 'Next ➡', callback_data: `admin_users_list_${safePage + 1}` });
                }

                const keyboard = {
                    inline_keyboard: [
                        ...(navRow.length ? [navRow] : []),
                        [{ text: '🔙 Back', callback_data: 'admin_users' }]
                    ]
                };

                if (messageId) {
                    try {
                        return await bot.editMessageText(text, {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: keyboard
                        });
                    } catch (e) {
                        // Fall through to send a fresh message if edit fails
                    }
                }

                return bot.sendMessage(chatId, text, { reply_markup: keyboard });
            }
        );
    });
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
// BROADCAST (Using session action handler)
// =======================================

async function handleBroadcastPrompt(bot, msg, notifyBot, session) {
    const chatId = msg.chat.id;

    if (!notifyBot) {
        console.warn("⚠️ handleBroadcastPrompt called without notifyBot — broadcast will fail for all users.");
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
    handleUsersListPage,
    handleBanUserPrompt,
    handleBroadcastPrompt
};
