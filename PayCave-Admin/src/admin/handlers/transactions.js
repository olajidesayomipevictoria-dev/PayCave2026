const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

const dbPath = path.join(process.cwd(), 'database.sqlite');

// Helper to ensure tables exist so queries never fail
function ensureTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS service_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        reference TEXT UNIQUE,
        service TEXT,
        provider TEXT,
        recipient TEXT,
        amount REAL,
        profit REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        reference TEXT UNIQUE,
        amount REAL,
        type TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// Fetch live balance from Pairgate API
async function getPairgateBalance() {
    try {
        const apiKey = process.env.PAIRGATE_API_KEY || process.env.PAIRGATE_TOKEN || '';
        const response = await axios.get('https://pairgate.com/api/v1/wallet/balance', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Cache-Control': 'no-cache'
            }
        });
        return response.data?.data?.balance ?? 0;
    } catch (error) {
        console.error('Pairgate Balance Fetch Error:', error.response?.data || error.message);
        return null; // Return null if it fails so we can show an error state
    }
}

async function handleTransactionsMenu(bot, msg) {
    const chatId = msg.message?.chat?.id || msg.chat?.id;

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Database connection error:', err.message);
    });

    ensureTables(db);

    // Query stats and profits from database tables
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM service_transactions WHERE status = 'success') + 
            (SELECT COUNT(*) FROM wallet_transactions WHERE status = 'success') as count,
            
            (SELECT COALESCE(SUM(amount), 0) FROM service_transactions WHERE status = 'success') + 
            (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE status = 'success') as volume,

            (SELECT COALESCE(SUM(profit), 0) FROM service_transactions WHERE status = 'success') as total_profit
    `, [], async (err, row) => {
        db.close();

        const count = row?.count || 0;
        const volume = row?.volume || 0;
        const profit = row?.total_profit || 0; 
        
        // Fetch live pairgate balance
        const liveBalance = await getPairgateBalance();
        let balanceText = liveBalance !== null ? `₦${liveBalance.toLocaleString()}` : `⚠️ Failed to fetch`;

        // Low balance warning alert condition (e.g., below ₦2,000)
        let warningAlert = '';
        if (liveBalance !== null && liveBalance < 2000) {
            warningAlert = `\n\n🚨 **WARNING: Pairgate balance is critically low! Fund your wallet.**`;
        }

        const message = `📊 **Transactions & Business Performance**

✅ **Successful Transactions:** ${count}
💰 **Total Volume:** ₦${volume.toLocaleString()}
📈 **Total Profits:** ₦${profit.toLocaleString()}

💳 **Pairgate Wallet Balance:** ${balanceText}${warningAlert}`;

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
    const searchType = type === 'vtu' ? 'Airtime/Data (Service)' : 'Wallet Funding';
    
    await bot.sendMessage(chatId, `Please enter the **Transaction Reference** or **Phone/Recipient** to search for (${searchType}):`, { parse_mode: 'Markdown' });

    bot.once('message', (responseMsg) => {
        if (responseMsg.chat.id !== chatId) return;
        const queryText = responseMsg.text.trim();

        const db = new sqlite3.Database(dbPath);
        ensureTables(db);
        
        let sql = '';
        let queryParams = [];

        if (type === 'vtu') {
            sql = `SELECT * FROM service_transactions WHERE reference LIKE ? OR recipient LIKE ? LIMIT 5`;
            queryParams = [`%${queryText}%`, `%${queryText}%`];
        } else {
            sql = `SELECT * FROM wallet_transactions WHERE reference LIKE ? OR telegram_id LIKE ? LIMIT 5`;
            queryParams = [`%${queryText}%`, `%${queryText}%`];
        }
        
        db.all(sql, queryParams, (err, rows) => {
            db.close();

            if (err) {
                console.error('Search DB Error:', err.message);
                return bot.sendMessage(chatId, `⚠️ Error searching the database: ${err.message}`);
            }

            if (!rows || rows.length === 0) {
                return bot.sendMessage(chatId, `❌ No matching transactions found for "${queryText}".`);
            }

            let resultText = `🔍 **Search Results for "${queryText}":**\n\n`;
            rows.forEach((tx, index) => {
                if (type === 'vtu') {
                    resultText += `*${index + 1}. Ref:* ${tx.reference}\n` +
                        `📱 *Recipient:* ${tx.recipient}\n` +
                        `⚡ *Service:* ${tx.service} (${tx.provider})\n` +
                        `💵 *Amount:* ₦${tx.amount}\n` +
                        `📈 *Profit:* ₦${tx.profit || 0}\n` +
                        `📌 *Status:* ${tx.status}\n` +
                        `📅 *Date:* ${tx.created_at || 'N/A'}\n\n`;
                } else {
                    resultText += `*${index + 1}. Ref:* ${tx.reference}\n` +
                        `👤 *User ID:* ${tx.telegram_id}\n` +
                        `📦 *Type:* ${tx.type}\n` +
                        `💵 *Amount:* ₦${tx.amount}\n` +
                        `📌 *Status:* ${tx.status}\n` +
                        `📅 *Date:* ${tx.created_at || 'N/A'}\n\n`;
                }
            });

            bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
        });
    });
}

module.exports = { handleTransactionsMenu, handleSearchPrompt };
