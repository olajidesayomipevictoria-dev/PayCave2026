bot.on("message", async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    // 👇 2. FIXED REFUND SESSION INTERCEPTOR BLOCK
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
                const response = await axios.post('http://localhost:10000/api/admin/refund', {
                    secretKey: process.env.ADMIN_SECRET_KEY,
                    telegramId: targetUserTelegramId,
                    amount: amount
                });

                if (response.data.success) {
                    await bot.sendMessage(chatId, `✅ Successfully refunded *₦${amount}* to user \`${targetUserTelegramId}\`!`, { parse_mode: 'Markdown' });

                    // Optional admin log entry
                    db.run(
                        `INSERT INTO admin_logs (admin_id, action, description) VALUES (?, ?, ?)`,
                        [ADMIN_ID, 'MANUAL_REFUND', `Refunded ₦${amount} to user ${targetUserTelegramId}`]
                    );
                } else {
                    await bot.sendMessage(chatId, `❌ Failed to refund: ${response.data.message}`);
                }

            } catch (error) {
                await bot.sendMessage(chatId, `❌ Error connecting to server: ${error.message}`);
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
