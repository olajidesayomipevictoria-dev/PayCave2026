'use strict';

const db = require('../../database/database');
const flutterwave = require('../../services/flutterwave');
const { setState } = require('../../utils/states');

// ================= Open Wallet =================

async function openWallet(bot, msg) {

    const telegramId = String(msg.from.id);

    const balance = await db.getBalance(telegramId);

    console.log("Wallet Screen Telegram ID:", telegramId);
    console.log("Wallet Screen Balance:", balance);

    bot.sendMessage(
        msg.chat.id,
        `💰 *PayCave Wallet*

Current Balance

*₦${Number(balance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})}*

Choose an option below.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                resize_keyboard: true,
                keyboard: [
                    ['➕ Fund Wallet'],
                    ['📜 Wallet History'],
                    ['🏠 Home']
                ]
            }
        }
    );

}

// ================= Wallet History =================

async function walletHistory(bot, msg) {

    const telegramId = String(msg.from.id);

    const history = await db.getWalletHistory(telegramId);

    if (history.length === 0) {

        return bot.sendMessage(
            msg.chat.id,
            "📭 No wallet transactions yet."
        );

    }

    let text = "📜 *Wallet History*\n\n";

    history.forEach(item => {

        text +=
`• ₦${Number(item.amount).toLocaleString()}

Type: ${item.type}

Status: ${item.status}

Reference: ${item.reference}

`;

    });

    bot.sendMessage(
        msg.chat.id,
        text,
        {
            parse_mode: "Markdown"
        }
    );

}

// ================= Fund Wallet =================
async function fundWallet(bot, msg) {

    setState(msg.from.id, "awaiting_funding_amount");

    bot.sendMessage(
        msg.chat.id,
        `🏦 *Fund Wallet*

Please enter the amount you want to fund.

Minimum amount: *₦100*

Example

500
1000
2500`,
        {
            parse_mode: "Markdown",
            force_reply: true
        }
    );

}

// ================= Generate Virtual Account =================

async function fundWalletAmount(bot, msg, amount) {

    const telegramId = String(msg.from.id);

    const user = await db.getUser(telegramId);

    const result = await flutterwave.createVirtualAccount(amount, user);

    if (!result.success) {

        console.log(result.error);

        return bot.sendMessage(
            msg.chat.id,
            "❌ Unable to generate a payment account.\nPlease try again."
        );

    }

    const account = result.data;

    await db.saveWalletTransaction({
        telegramId,
        reference: result.tx_ref,
        amount,
        type: "FUNDING",
        status: "PENDING"
    });

    return bot.sendMessage(
    msg.chat.id,
`🏦 *Wallet Funding*

Transfer exactly:

*₦${Number(amount).toLocaleString()}*

To:

*Bank*
${account.bank_name}

*Account Number*
\`${account.account_number}\`

*Reference*
\`${result.tx_ref}\`

⏳ This account expires on:

${account.expiry_date}

After making payment, tap the button below to verify your payment.`,
    {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "✅ I Have Paid",
                        callback_data: `verify_${result.tx_ref}`
                    }
                ]
            ]
        }
    }
);

}

// ================= Exports =================

module.exports = {
    openWallet,
    walletHistory,
    fundWallet,
    fundWalletAmount
}