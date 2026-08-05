const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Points to database.sqlite in the root directory
const dbPath = path.resolve(__dirname, '../../../database.sqlite');

async function handleTransactionsMenu(bot, msg) {
    const chatId = msg.message?.chat?.id || msg.chat?.id;

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
        }
    });

    db.get(`SELECT COUNT(*) as count, SUM(amount) as volume FROM transactions WHERE status = 'success'`, [], (err, row) => {
        db.close();

        const count = row?.count || 0;
        const volume = row?.volume || 0;
        const profit = 0; 
        const pairgateBalance = 68.5; 

        const message = `📊 **Transactions & Business Performance**

✅ **Successful Transactions:** ${count}
💰 **Total Volume:** ₦${volume.toLocaleString()}
📈 **Total Profits:** ₦${profit.toLocaleString()}

💳 **Pairgate Wallet Balance:** ₦${pairgateBalance}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: "🔍 Search Airtime/Data", callback_data: "search_vtu_tx" },
                    { text: "🔍 Search Wallet Funding", callback_data: "search_wallet_tx" }
                ],
                [
                    { text: "🔙 Back to Admin Menu", callback_data: "admin_back" }
                ]
            ]
        };

        bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
    });
}

async function handleSearchPrompt(bot, query, type) {
    const chatId = query.message.chat.id;
    
    await bot.sendMessage(chatId, `Please enter the **Transaction Reference** or **Phone Number** to search for (${type === 'vtu' ? 'Airtime/Data' : 'Wallet Funding'}):`, { parse_mode: 'Markdown' });

    bot.once('message', (responseMsg) => {
        if (responseMsg.chat.id !== chatId) return;
        const queryText = responseMsg.text.trim();

        const db = new sqlite3.Database(dbPath);
        const sql = `SELECT * FROM transactions WHERE (reference LIKE ? OR phone LIKE ?) AND type ${type === 'vtu' ? "IN ('airtime', 'data')" : "= 'wallet_funding'"} LIMIT 5`;
        
        db.all(sql, [`%${queryText}%`, `%${queryText}%`], (err, rows) => {
            db.close();

            if (err) {
                return bot.sendMessage(chatId, "⚠️ Error searching the database.");
            }

            if (!rows || rows.length === 0) {
                return bot.sendMessage(chatId, `❌ No matching transactions found for "${queryText}".`);
            }

            let resultText = `🔍 **Search Results for "${queryText}":**\n\n`;
            rows.forEach((tx, index) => {
                resultText += `*${index + 1}. Ref:* ${tx.reference}\n` +
                    `📱 *Phone:* ${tx.phone || 'N/A'}\n` +
                    `📦 *Type:* ${tx.type}\n` +
                    `💵 *Amount:* ₦${tx.amount}\n` +
                    `📌 *Status:* ${tx.status}\n` +
                    `📅 *Date:* ${tx.created_at || 'N/A'}\n\n`;
            });

            bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
        });
    });
}

module.exports = { handleTransactionsMenu, handleSearchPrompt };
