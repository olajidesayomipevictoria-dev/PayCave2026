"use strict";

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");

const db = require("../database/database");

const keyboards = require("./keyboards");

const wallet = require("./handlers/wallet");

const flutterwave = require("./../services/flutterwave");

const dataHandler = require("./handlers/data");
const airtimeHandler = require("./handlers/airtime");

const electricityHandler = require("./handlers/electricity");
const cableHandler = require("./handlers/cable");
const educationHandler = require("./handlers/education");
const transactionHandler = require("./handlers/transactions");
const adminHandler = require("./handlers/admin");

const { setState, getState, clearState } = require("../utils/states");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

console.log("🤖 PayCave Bot Started");
// ================= Register User =================

async function registerUser(msg) {
  const telegramId = String(msg.from.id);

  try {
    const user = await db.getUser(telegramId);

    if (!user) {
      await db.createUser({
        telegramId,
        username: msg.from.username || "",
        first_name: msg.from.first_name || "",
        last_name: msg.from.last_name || "",
      });

      console.log("✅ New User:", telegramId);
    }
  } catch (err) {
    console.log(err);
  }
}

// ================= Home =================

async function sendHome(chatId) {
  await bot.sendMessage(
    chatId,
    `🎉 *Welcome to PayCave* Your reliable VTU platform. Choose a service below.`,
    {
      parse_mode: "Markdown",
      ...keyboards.HOME_MENU,
    }
  );
}

// ================= Start Command =================

bot.onText(/\/start/, async (msg) => {
  await registerUser(msg);

  clearState(msg.from.id);
  clearState(msg.from.id);

  await sendHome(msg.chat.id);
});
// ================= Main Message Handler =================

bot.on("message", async (msg) => {
  if (!msg.text) return;

  if (msg.text.startsWith("/")) return;

  await registerUser(msg);

  const text = msg.text;

  const state = getState(msg.from.id);
  // =======================
  // AIRTIME FLOW
  // =======================

  if (state?.state === "awaiting_airtime_phone") {
    
    if (!/^0\d{10}$/.test(text)) {
      return bot.sendMessage(
        msg.chat.id,
        "❌ Please enter a valid Nigerian phone number."
      );
    }

    setState(msg.from.id, "awaiting_airtime_amount", {
      network: state.data.network,
      phone: text,
    });

    return bot.sendMessage(msg.chat.id, "💵 Enter Airtime Amount:");
  }
// =========================
// AIRTIME AMOUNT
// =========================

if (state?.state === "awaiting_airtime_amount") {

    const amount = Number(text);

    if (isNaN(amount) || amount < 50) {

        return bot.sendMessage(
            msg.chat.id,
            "❌ Minimum airtime amount is ₦50."
        );

    }

    const telegramId = String(msg.from.id);

const balance = await db.getBalance(telegramId);

console.log("Telegram ID:", telegramId);
console.log("Wallet Balance:", balance);

    if (balance < amount) {

        clearState(msg.from.id);

        return bot.sendMessage(
            msg.chat.id,
            "❌ Insufficient wallet balance."
        );

    }

    const phone = state.data.phone;
    const network = state.data.network;

    await db.deductBalance(telegramId, amount);

    const purchase = await airtimeHandler.buyAirtime(
        msg,
        network,
        phone,
        amount
    );
    console.log("PairGate Response:", purchase);

    if (!purchase.success) {

        await db.updateBalance(msg.from.id, amount);

        clearState(msg.from.id);

        return bot.sendMessage(
            msg.chat.id,
            "❌ Airtime purchase failed.\n\nYour wallet has been refunded."
        );

    }

    await db.saveServiceTransaction({

        telegramId: msg.from.id,

        reference: purchase.requestId,

        service: "AIRTIME",

        provider: network,

        recipient: phone,

        amount,

        profit: 0,

        status: "SUCCESS"

    });

    clearState(msg.from.id);

    return bot.sendMessage(

        msg.chat.id,

        `✅ Airtime Purchase Successful

📱 ${phone}
📡 ${network}
💵 ₦${amount}

Reference:
${purchase.requestId}`

    );

}

  if (state?.state === "awaiting_airtime_amount") {
    const amount = Number(text);

    if (isNaN(amount) || amount < 50) {
      return bot.sendMessage(msg.chat.id, "❌ Minimum airtime amount is ₦50.");
    }

    const result = await airtimeHandler.buyAirtime(
      msg,
      state.data.network,
      state.data.phone,
      amount
    );

    clearState(msg.from.id);

    return;
  }

  if (state && state.state === "awaiting_funding_amount") {
    const amount = Number(text);

    if (isNaN(amount) || amount < 100) {
      return bot.sendMessage(
        msg.chat.id,
        "❌ Please enter a valid amount (minimum ₦100)."
      );
    }

    clearState(msg.from.id);

    return await wallet.fundWalletAmount(bot, msg, amount);
  }

  switch (text) {
    case "💰 Wallet":
      clearState(msg.from.id);
      clearState(msg.from.id);

      await wallet.openWallet(bot, msg);

      break;

    case "➕ Fund Wallet":
      clearState(msg.from.id);

      await wallet.fundWallet(bot, msg);

      break;

    case "📜 Wallet History":
      clearState(msg.from.id);
      clearState(msg.from.id);

      await wallet.walletHistory(bot, msg);

      break;

    case "🏠 Home":

    case "🔙 Back":
      clearState(msg.from.id);
      clearState(msg.from.id);

      await sendHome(msg.chat.id);

      break;
    case "📱 Buy Data":
          setState(msg.from.id, {
                  state: "data_network"
                      });

                          bot.sendMessage(
                                  msg.chat.id,
                                          "📶 Select Network",
                                                  keyboards.DATA_NETWORKS
                                                      );

                                                          break;

    case "📞 Airtime":
          setState(msg.from.id, {
                  state: "airtime_network"
                      });

                          bot.sendMessage(
                                  msg.chat.id,
                                          "📞 Select Network",
                                                  keyboards.AIRTIME_NETWORKS
                                                      );

                                                          break;

    case "⚡ Electricity":
      clearState(msg.from.id);
      clearState(msg.from.id);

      bot.sendMessage(
        msg.chat.id,
        "⚡ Select Electricity Distribution Company",
        keyboards.ELECTRICITY_MENU
      );

      break;

    case "📺 Cable TV":
      clearState(msg.from.id);
      clearState(msg.from.id);

      bot.sendMessage(
        msg.chat.id,
        "📺 Select Cable Provider",
        keyboards.CABLE_MENU
      );

      break;

    case "🎓 Education":
      clearState(msg.from.id);
      clearState(msg.from.id);

      bot.sendMessage(
        msg.chat.id,
        "🎓 Select Examination",
        keyboards.EDUCATION_MENU
      );

      break;

    case "📊 Transactions":
      clearState(msg.from.id);
      clearState(msg.from.id);

      bot.sendMessage(msg.chat.id, "📊 Transaction history will appear here.");

      break;

    case "💬 Contact Support":
      clearState(msg.from.id);
      clearState(msg.from.id);

      bot.sendMessage(
        msg.chat.id,
        `💬 Need help? Username: @${process.env.SUPPORT_USERNAME}`
      );

      break;
 
  case "MTN":
        if (state?.state === "data_network") {
                await dataHandler.startData(bot, msg, "mtn");
                    } else {
                            await airtimeHandler.startAirtime(bot, msg, "mtn");
                                }
                                break;
                                  

                                

                                   case "Airtel":
                                        if (state?.state === "data_network") {
                                                await dataHandler.startData(bot, msg, "airtel");
                                                    } else {
                                                            await airtimeHandler.startAirtime(bot, msg, "airtel");
                                                                }
                                                                    break;                     

                                                                                  

                                                                                                            

                                                                                                            case "Glo":
                                                                                                                  if (state?.state === "data_network") {
                                                                                                                          await dataHandler.startData(bot, msg, "glo");
                                                                                                                              } else {
                                                                                                                                      await airtimeHandler.startAirtime(bot, msg, "glo");
                                                                                                                                          }
                                                                                                                                              break;

                                                                                                                                    

                                                                                                                                                                

case "🏢 Corporate Gifting":
      await dataHandler.startPlans(bot, msg, "CG");
          break;

          case "💼 SME":
              await dataHandler.startPlans(bot, msg, "SME");
                  break;

                  case "🎁 Gifting":
                      await dataHandler.startPlans(bot, msg, "GIFTING");
                          break;

                          case "🔥 Awoof":
                              await dataHandler.startPlans(bot, msg, "AWOOF");
                                  break;
    case "WAEC":
      bot.sendMessage(
        msg.chat.id,
        "🎓 WAEC Checker PIN purchase will be enabled by Admin."
      );

      break;

    case "NECO":
      bot.sendMessage(
        msg.chat.id,
        "🎓 NECO Token purchase will be enabled by Admin."
      );

      break;

    case "DSTV":

    case "GOTV":

    case "Startimes":
      bot.sendMessage(
        msg.chat.id,
        `${text} subscription module coming next phase.`
      );

      break;
    default:
      if (state?.state === "awaiting_funding_amount") {}
        bot.sendMessage(
          msg.chat.id,
          "🏦 Flutterwave funding flow will be connected in the next step."
        );

        clearState(msg.from.id);

        break;
      }

      if (state) {
        clearState(msg.from.id);
      }

      
  }
);
bot.on("callback_query", async (query) => {
  if (!query.data.startsWith("verify_")) return;

  const chatId = query.message.chat.id;
  const telegramId = String(query.from.id);
  const reference = query.data.replace("verify_", "");

  await bot.answerCallbackQuery(query.id, {
    text: "Checking payment...",
  });

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
console.log("Number(amount):", Number(result.data.amount));
  await db.updateBalance(telegramId, Number(result.data.amount));
  console.log("Balance update completed");
  await db.updateWalletTransactionStatus(reference, "SUCCESS");

  bot.sendMessage(
    chatId,
    `✅ Payment confirmed!\n\n₦${Number( result.data.amount ).toLocaleString()} has been added to your wallet.`
  );
});
module.exports = bot;