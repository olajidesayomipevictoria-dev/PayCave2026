'use strict';

const { getCablePlans, verifyCableCustomer, purchaseCable } = require('../../services/pairgate');
const { createVirtualAccount, verifyPayment } = require('../../services/flutterwave');
const db = require('../../database/database');

// 1. Show Cable Providers Menu
async function handleCableMenu(bot, chatId, messageId = null) {
  const text = '📺 **Cable TV Subscription**\n\nPlease select your provider below:';
  const replyMarkup = {
    inline_keyboard: [
      [{ text: 'DSTV', callback_data: 'cable_dstv' }, { text: 'GOtv', callback_data: 'cable_gotv' }],
      [{ text: 'Startimes', callback_data: 'cable_startimes' }],
      [{ text: '🔙 Back to Home', callback_data: 'menu_home' }]
    ]
  };

  if (messageId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: replyMarkup });
      return;
    } catch (e) {}
  }
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
}

// 2. Provider Selected -> Prompt for Smartcard / IUC Number
async function handleProviderSelection(bot, query, provider) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  db.run(`INSERT OR REPLACE INTO cable_sessions (telegram_id, provider, step) VALUES (?, ?, ?)`, 
    [chatId, provider, 'awaiting_iuc'], async () => {
      
      const text = `You selected **${provider.toUpperCase()}**.\n\nPlease type/send your **Smartcard / IUC Number** below:`;
      const replyMarkup = {
        inline_keyboard: [[{ text: '🔙 Back to Providers', callback_data: 'menu_cable' }]]
      };

      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: replyMarkup });
  });
}

// 3. Handle Smartcard Input (Live Verification + Dynamic Plan List)
async function handleSmartcardInput(bot, msg, text) {
  const chatId = msg.chat.id;
  const iucNumber = text.trim();

  db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ? AND step = ?`, [chatId, 'awaiting_iuc'], async (err, session) => {
    if (!session) return;

    const processingMsg = await bot.sendMessage(chatId, `🔍 Verifying smartcard **${iucNumber}** for ${session.provider.toUpperCase()}...`, { parse_mode: 'Markdown' });

    const verification = await verifyCableCustomer(session.provider, iucNumber);

    if (!verification.success) {
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      return bot.sendMessage(chatId, `❌ **Verification Failed:** ${verification.message}\n\nPlease check the number and type it correctly again:`);
    }

    // Safely extract the customer name from the API response object
    const customerName = verification.data?.customer_name || verification.data?.name || "Valued Customer";

    const plans = await getCablePlans(session.provider);
    if (!plans || plans.length === 0) {
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      return bot.sendMessage(chatId, `❌ Could not fetch packages from Pairgate right now. Please try again later.`);
    }

    db.run(`UPDATE cable_sessions SET iuc_number = ?, customer_name = ?, step = ?, current_page = 0 WHERE telegram_id = ?`,
      [iucNumber, customerName, 'selecting_plan', chatId], async () => {
        
        bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});

        const keyboard = buildBouquetKeyboard(plans, 0, session.provider);
        bot.sendMessage(chatId, `✅ **Customer Name:** ${customerName}\n\n📺 **${session.provider.toUpperCase()} Bouquets** (Page 1 of ${Math.ceil(plans.length / 5)}):\nSelect a package below:`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
    });
  });
}

// Helper: Build Paginated Keyboard (5 per page)
function buildBouquetKeyboard(plans, page, provider) {
  const PAGE_SIZE = 5;
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const currentPlans = plans.slice(start, end);

  const keyboard = currentPlans.map(plan => [{
    text: `${plan.name} - ₦${plan.price}`,
    callback_data: `bouquet_${plan.code}`
  }]);

  const paginationRow = [];
  if (page > 0) {
    paginationRow.push({ text: '⬅️ Prev', callback_data: `cable_page_${provider}_${page - 1}` });
  }
  if (end < plans.length) {
    paginationRow.push({ text: 'Next ➡️', callback_data: `cable_page_${provider}_${page + 1}` });
  }
  if (paginationRow.length > 0) keyboard.push(paginationRow);

  keyboard.push([{ text: '🔙 Back to Providers', callback_data: 'menu_cable' }]);
  return keyboard;
}

// 4. Handle Pagination Clicks (Next / Prev)
async function handlePagination(bot, query, provider, targetPage) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const page = parseInt(targetPage);

  const plans = await getCablePlans(provider);
  const keyboard = buildBouquetKeyboard(plans, page, provider);

  db.run(`UPDATE cable_sessions SET current_page = ? WHERE telegram_id = ?`, [page, chatId]);

  try {
    await bot.editMessageText(`📺 **${provider.toUpperCase()} Bouquets** (Page ${page + 1} of ${Math.ceil(plans.length / 5)}):\nSelect a package below:`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (e) {}
}

// 5. Bouquet Selected -> Show Payment Options
async function handleBouquetSelection(bot, query, bouquetCode) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ?`, [chatId], async (err, session) => {
    if (!session) return bot.sendMessage(chatId, 'Session expired. Please start over.');

    const plans = await getCablePlans(session.provider);
    const selectedPlan = plans.find(p => p.code === bouquetCode);
    if (!selectedPlan) return bot.sendMessage(chatId, 'Selected plan configuration error. Please try again.');

    db.run(`UPDATE cable_sessions SET bouquet_code = ?, bouquet_name = ?, amount = ? WHERE telegram_id = ?`,
      [bouquetCode, selectedPlan.name, selectedPlan.price, chatId]);

    const summaryText = `📋 **Transaction Summary**\n\n` +
      `• **Provider:** ${session.provider.toUpperCase()}\n` +
      `• **Customer Name:** ${session.customer_name}\n` +
      `• **Smartcard:** \`${session.iuc_number}\`\n` +
      `• **Package:** ${selectedPlan.name}\n` +
      `• **Amount:** ₦${selectedPlan.price}\n\n` +
      `Choose your payment method below:`;

    const paymentKeyboard = {
      inline_keyboard: [
        [{ text: '💰 Pay from Wallet', callback_data: 'cable_pay_wallet' }],
        [{ text: '🏦 Pay by Bank Transfer', callback_data: 'cable_pay_bank' }],
        [{ text: '🔙 Back to Bouquets', callback_data: `cable_${session.provider}` }]
      ]
    };

    await bot.editMessageText(summaryText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: paymentKeyboard
    });
  });
}

// 6. Execute Payment: Pay from Wallet
async function handleWalletPayment(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ?`, [chatId], async (err, session) => {
    if (!session) return;

    db.get(`SELECT balance FROM users WHERE telegram_id = ?`, [chatId], async (err, user) => {
      const balance = user ? user.balance : 0;

      if (balance < session.amount) {
        return bot.answerCallbackQuery(query.id, { text: `Insufficient Balance! You have ₦${balance}`, show_alert: true });
      }

      await bot.editMessageText(`⏳ Processing ${session.bouquet_name} subscription for ${session.customer_name}... Please wait.`, {
        chat_id: chatId, message_id: messageId, parse_mode: 'Markdown'
      });

      db.run(`UPDATE users SET balance = balance - ? WHERE telegram_id = ?`, [session.amount, chatId]);

      const reference = `TRX_${Date.now()}`;
      const result = await purchaseCable(session.provider, session.bouquet_code, session.iuc_number, session.customer_name, reference);

      if (result.success) {
        await bot.editMessageText(`✅ **Subscription Successful!**\n\n` +
          `• **Plan:** ${result.data.plan}\n` +
          `• **Smartcard:** ${result.data.smartcard}\n` +
          `• **Amount Charged:** ₦${result.data.amount}\n` +
          `• **Reference:** \`${result.data.reference_code}\``, {
          chat_id: chatId, message_id: messageId, parse_mode: 'Markdown'
        });
        db.run(`DELETE FROM cable_sessions WHERE telegram_id = ?`, [chatId]);
      } else {
        db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [session.amount, chatId]);
        await bot.editMessageText(`❌ **Vending Failed:** ${result.message}\nYour wallet has been refunded.`, {
          chat_id: chatId, message_id: messageId, parse_mode: 'Markdown'
        });
      }
    });
  });
}

// 7. Execute Payment: Pay by Bank Transfer (Generates Dynamic Account + "I Have Paid" Button)
async function handleBankTransferPayment(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ?`, [chatId], async (err, session) => {
    if (!session) return bot.answerCallbackQuery(query.id, { text: 'Session expired. Please start over.', show_alert: true });

    await bot.editMessageText(`⏳ Generating your dedicated dynamic virtual account for ₦${session.amount}... Please wait.`, {
      chat_id: chatId, 
      message_id: messageId, 
      parse_mode: 'Markdown'
    });

    const user = { telegram_id: chatId, first_name: 'PayCave', last_name: 'Customer' };
    const vaResult = await createVirtualAccount(session.amount, user);

    if (vaResult.success && vaResult.data) {
      const accountData = vaResult.data;
      
      db.run(`UPDATE cable_sessions SET tx_ref = ? WHERE telegram_id = ?`, [vaResult.tx_ref, chatId]);

      const transferMessage = `🏦 **Bank Transfer Payment Details**\n\n` +
        `Please transfer the exact amount of **₦${session.amount}** to the temporary account below:\n\n` +
        `• **Bank Name:** ${accountData.bank_name}\n` +
        `• **Account Number:** \`${accountData.account_number}\`\n` +
        `• **Account Name:** ${accountData.account_name || 'PayCave Customer'}\n` +
        `• **Amount:** ₦${session.amount}\n\n` +
        `*Note: This account is unique to this transaction. Click the button below once you have completed the transfer.*`;

      const transferKeyboard = {
        inline_keyboard: [
          [{ text: '✅ I Have Paid', callback_data: 'cable_verify_transfer' }],
          [{ text: '🔙 Change Payment Method', callback_data: `bouquet_${session.bouquet_code}` }]
        ]
      };

      await bot.editMessageText(transferMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: transferKeyboard
      });
    } else {
      await bot.editMessageText(`❌ Failed to generate virtual account. Please try again or use your wallet option.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Back', callback_data: `bouquet_${session.bouquet_code}` }]]
        }
      });
    }
  });
}

// 8. Handle "I Have Paid" Button Click (Verifies Transfer & Vends Cable)
async function handleVerifyTransfer(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ?`, [chatId], async (err, session) => {
    if (!session || !session.tx_ref) {
      return bot.answerCallbackQuery(query.id, { text: 'Session expired or reference missing. Please start over.', show_alert: true });
    }

    await bot.answerCallbackQuery(query.id, { text: 'Checking payment status...' });

    await bot.editMessageText(`⏳ Verifying your transfer for **${session.bouquet_name}**...\n\nPlease give us a moment to confirm with Flutterwave.`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const verification = await verifyPayment(session.tx_ref);

    if (verification.success) {
      const purchaseResult = await purchaseCable(
        session.provider, 
        session.bouquet_code, 
        session.iuc_number, 
        session.customer_name, 
        session.tx_ref
      );

      if (purchaseResult.success) {
        await bot.editMessageText(`✅ **Payment Confirmed & Subscription Successful!**\n\n` +
          `• **Plan:** ${purchaseResult.data.plan}\n` +
          `• **Smartcard:** ${purchaseResult.data.smartcard}\n` +
          `• **Amount Paid:** ₦${purchaseResult.data.amount}\n` +
          `• **Reference:** \`${purchaseResult.data.reference_code}\``, {
          chat_id: chatId, 
          message_id: messageId, 
          parse_mode: 'Markdown'
        });
        db.run(`DELETE FROM cable_sessions WHERE telegram_id = ?`, [chatId]);
      } else {
        await bot.editMessageText(`⚠️ **Payment Received, but Vending Failed:** ${purchaseResult.message}\n\nPlease contact support with reference: \`${session.tx_ref}\``, {
          chat_id: chatId, 
          message_id: messageId, 
          parse_mode: 'Markdown'
        });
      }
    } else {
      await bot.editMessageText(`⏳ **Payment not seen yet.**\n\nIf you have already completed the transfer, please wait a few seconds and click below to re-verify.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Re-check Payment', callback_data: 'cable_verify_transfer' }],
            [{ text: '🔙 Back to Menu', callback_data: 'menu_cable' }]
          ]
        }
      });
    }
  });
}

// Handle text messages (such as Smartcard / IUC number input)
async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  return new Promise((resolve) => {
    db.get(`SELECT * FROM cable_sessions WHERE telegram_id = ? AND step = ?`, [chatId, 'awaiting_iuc'], async (err, session) => {
      if (err || !session) return resolve(false);

      if (text === "🔙 Back to Providers" || text === "Back to Providers" || text === "Back") {
        db.run(`DELETE FROM cable_sessions WHERE telegram_id = ?`, [chatId]);
        await handleCableMenu(bot, chatId);
        return resolve(true);
      }

      // Process the entered smartcard/IUC number
      await handleSmartcardInput(bot, msg, text);
      return resolve(true);
    });
  });
}

module.exports = {
  handleCableMenu,
  handleProviderSelection,
  handleSmartcardInput,
  handleMessage,
  handlePagination,
  handleBouquetSelection,
  handleWalletPayment,
  handleBankTransferPayment,
  handleVerifyTransfer
};
