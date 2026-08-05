'use strict';

const pairgate = require('../../services/pairgate');
const keyboards = require("../keyboards");
const db = require('../../database/database');

const { getState, setState, clearState } = require("../../utils/states");

const CATEGORY_NAMES = {
    CG: "🏢 Corporate Gifting",
    CG_LITE: "📦 Lite Data",
    SME: "💼 SME",
    GIFTING: "🎁 Gifting",
    AWOOF: "🔥 Awoof"
};

async function startData(bot, msg, provider) {

    try {

        const categories = await pairgate.getDataCategories();

        const providerCategories = categories.filter(
            c => c.provider_name.toLowerCase() === provider.toLowerCase()
        );

        if (!providerCategories.length) {

            return bot.sendMessage(
                msg.chat.id,
                "❌ No data categories found."
            );

        }

        const keyboard = providerCategories.map(category => [
            CATEGORY_NAMES[category.plan_type] || category.plan_type
        ]);

        keyboard.push(["🔙 Back", "🏠 Home"]);

        return bot.sendMessage(
            msg.chat.id,
            `📦 ${provider.toUpperCase()} Data\n\nChoose a data category.`,
            {
                reply_markup: {
                    keyboard,
                    resize_keyboard: true
                }
            }
        );

    } catch (err) {

        console.error(err);

        return bot.sendMessage(
            msg.chat.id,
            "❌ Unable to fetch data categories."
        );

    }

}

async function startPlans(bot, msg, state, provider, planType, page = 1) {

    try {

        if (!state.data) state.data = {};

        // Cache plans
        if (
            !state.data.plans ||
            state.data.provider !== provider ||
            state.data.planType !== planType
        ) {

            const response = await pairgate.getDataPlans(provider, planType);

            const rawPlans = response[Object.keys(response)[0]];

            if (!rawPlans || rawPlans.length === 0) {

                return bot.sendMessage(
                    msg.chat.id,
                    "❌ No plans found for this category."
                );

            }

            // OVERRIDE WITH ADMIN PRICES FROM DATABASE
            const plans = [];
            for (const plan of rawPlans) {
                const planId = plan.id || plan.plan_id || plan.code || plan.plan_code;
                
                // Query database for custom selling price
                const customPrice = await new Promise((resolve) => {
                    db.get(`SELECT selling_price FROM prices WHERE plan_id = ?`, [planId], (err, row) => {
                        resolve(row ? row.selling_price : null);
                    });
                });

                plans.push({
                    ...plan,
                    price: customPrice !== null ? customPrice : plan.price // Use custom price if available
                });
            }

            state.data.plans = plans;
            state.data.provider = provider;
            state.data.planType = planType;

        }

        const plans = state.data.plans;

        const PAGE_SIZE = 10;

        const totalPages = Math.ceil(plans.length / PAGE_SIZE);

        if (page < 1) page = 1;

        if (page > totalPages) page = totalPages;

        state.data.page = page;

        const start = (page - 1) * PAGE_SIZE;

        const currentPlans = plans.slice(start, start + PAGE_SIZE);

        const keyboard = currentPlans.map(plan => [
            `${plan.name} - ₦${plan.price}`
        ]);

        const navigation = [];

        if (page > 1) {

            navigation.push("⬅️ Previous");

        }

        if (page < totalPages) {

            navigation.push("Next ➡️");

        }

        if (navigation.length) {

            keyboard.push(navigation);

        }

        keyboard.push(["🔙 Back", "🏠 Home"]);

        // Set state to await plan selection
        setState(msg.from.id, "data_select_plan", state.data);

        return bot.sendMessage(

            msg.chat.id,

            `📦 Choose a Data Plan\n\nPage ${page} of ${totalPages}`,

            {

                reply_markup: {

                    keyboard,

                    resize_keyboard: true

                }

            }

        );

    } catch (err) {

        console.error(err);

        return bot.sendMessage(

            msg.chat.id,

            "❌ Unable to fetch data plans."

        );

    }

}

async function handleMessage(bot, msg) {
    const text = msg.text.trim();
    const state = getState(msg.from.id);

    if (!state) return false;

    // Catch Home and Back immediately so they never trigger phone number prompts
    if (text === "🏠 Home" || text === "🔙 Back") {
        clearState(msg.from.id);
        return false; // Let bot.js handle sending you home
    }
    // Handle pagination
    if (text === "Next ➡️" || text === "⬅️ Previous") {
        if (state.state === "data_select_plan" && state.data) {
            const currentPage = state.data.page || 1;
            const newPage = text === "Next ➡️" ? currentPage + 1 : currentPage - 1;
            await startPlans(bot, msg, state, state.data.provider, state.data.planType, newPage);
            return true;
        }
    }

    if (text === "📱 Buy Data" || text === "📞 Airtime" || text === "MTN" || text === "Airtel" || text === "Glo" || text === "9mobile") {
        return false;
    }

    // Handle plan selection (e.g., matching `${plan.name} - ₦${plan.price}`)
    if (state.state === "data_select_plan") {
        if (text.includes("₦")) {
            const planName = text.split(" - ₦")[0];
            const selectedPlan = state.data.plans?.find(p => p.name === planName);

            if (!selectedPlan) {
                return false;
            }

            // Save selected plan and prompt for recipient phone number
            setState(msg.from.id, "data_recipient", {
                ...state.data,
                selectedPlan
            });

            await bot.sendMessage(
                msg.chat.id,
                `📱 Selected: *${selectedPlan.name}* (₦${selectedPlan.price})\n\nPlease enter the recipient's phone number:`,
                { parse_mode: "Markdown", reply_markup: { keyboard: [["🔙 Back", "🏠 Home"]], resize_keyboard: true } }
            );
            return true;
        }
    }

    // Handle recipient phone number input and execute purchase
    if (state.state === "data_recipient") {
        const phone = text;
        if (!/^\d{11}$/.test(phone)) {
            await bot.sendMessage(msg.chat.id, "❌ Please enter a valid 11-digit phone number.");
            return true;
        }

        const orderData = state.data;
        const telegramId = String(msg.from.id);
        const plan = orderData.selectedPlan;

        clearState(msg.from.id);

        try {
            // 1. Check user wallet balance
            const balance = await db.getBalance(telegramId);
            const price = Number(plan.price);

            if (balance < price) {
                await bot.sendMessage(
                    msg.chat.id,
                    `❌ Insufficient balance.\n\nYour balance is ₦${Number(balance).toLocaleString()}, but this plan costs ₦${Number(price).toLocaleString()}. Please fund your wallet.`,
                    keyboards.HOME_MENU
                );
                return true;
            }

            // 2. Send processing message
            await bot.sendMessage(
                msg.chat.id,
                `🚀 Processing data purchase for *${phone}*...\nPlan: *${plan.name}*`,
                { parse_mode: "Markdown" }
            );

            // 3. Call Pairgate API to buy data
            const planIdToUse = plan.id || plan.plan_id || plan.code || plan.plan_code;

            console.log("SENDING DATA PAYLOAD:", {
                provider: orderData.provider,
                planId: planIdToUse,
                phone: phone
            });

            const response = await pairgate.buyData(
                orderData.provider,
                planIdToUse,
                phone
            );

            if (!response || !response.success) {
                throw new Error(response?.message || "VTU API purchase failed.");
            }

            // 4. Deduct balance and log transaction in database
            await db.deductBalance(telegramId, price);
            const newBalance = balance - price;

            await db.saveServiceTransaction({
                telegramId: telegramId,
                reference: `DATA-${Date.now()}`,
                service: "DATA",
                provider: orderData.provider,
                recipient: phone,
                amount: price,
                profit: 0,
                status: "SUCCESS"
            });

            // 5. Success confirmation
            await bot.sendMessage(
                msg.chat.id,
                `✅ *Data Purchase Successful!*\n\n` +
                `📱 Recipient: ${phone}\n` +
                `📦 Plan: ${plan.name}\n` +
                `💰 Amount: ₦${Number(price).toLocaleString()}\n` +
                `📉 New Balance: ₦${Number(newBalance).toLocaleString()}`,
                { parse_mode: "Markdown", ...keyboards.HOME_MENU }
            );

        } catch (err) {
            console.error("Data Purchase Error:", err);
            await bot.sendMessage(
                msg.chat.id,
                `❌ Data purchase failed: ${err.message}\n\nPlease try again later.`,
                keyboards.HOME_MENU
            );
        }

        return true;
    }

    return false;
}

module.exports = {
    startData,
    startPlans,
    handleMessage
};
