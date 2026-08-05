'use strict';

const db = require("../../database/database");
const keyboards = require("../keyboards");

async function openTransactions(bot, msg) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);

    try {
        // Fetch recent wallet transactions which have the correct telegram_id column
        db.all(
            `SELECT * FROM wallet_transactions WHERE telegram_id = ? ORDER BY id DESC LIMIT 5`,
            [telegramId],
            async (err, rows) => {
                if (err) {
                    console.error("Error fetching transactions:", err);
                    return bot.sendMessage(chatId, "❌ Could not fetch your transactions right now. Try again later.");
                }

                if (!rows || rows.length === 0) {
                    return bot.sendMessage(
                        chatId,
                        "📊 *Transaction History*\n\nYou haven't performed any transactions yet.",
                        { parse_mode: "Markdown", ...keyboards.HOME_MENU }
                    );
                }

                let message = "📊 *Your Recent Transactions*\n\n";
                rows.forEach((tx, index) => {
                    const statusEmoji = tx.status === 'SUCCESS' ? '✅' : tx.status === 'PENDING' ? '⏳' : '❌';
                    message += `${index + 1}. *${tx.type || 'Transaction'}* - ₦${Number(tx.amount || 0).toLocaleString()}\n`;
                    message += `   Status: ${statusEmoji} ${tx.status}\n`;
                    message += `   Date: ${tx.created_at || 'Recent'}\n\n`;
                });

                return bot.sendMessage(chatId, message, {
                    parse_mode: "Markdown",
                    ...keyboards.HOME_MENU
                });
            }
        );
    } catch (e) {
        console.error("Transactions Error:", e);
        return bot.sendMessage(chatId, "❌ An error occurred while loading transactions.");
    }
}

module.exports = {
    openTransactions
};
