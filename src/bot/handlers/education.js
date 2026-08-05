'use strict';

// Main entry when user clicks "Education"
async function startEducation(bot, chatId) {
    await bot.sendMessage(
        chatId,
        "📚 *Education & Exam Pins*\n\nPlease select your preferred examination board below:",
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: "📚 WAEC Pin" }, { text: "📚 NECO Pin" }],
                    [{ text: "🔙 Back" }, { text: "🏠 Home" }]
                ],
                resize_keyboard: true
            }
        }
    );
}

// When user selects WAEC or NECO, show Quantity options (1 to 5)
async function selectQuantity(bot, chatId, examType) {
    await bot.sendMessage(
        chatId,
        `You have selected *${examType}*.\n\nPlease select the number of pins (Quantity) you wish to purchase:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: `1 ${examType}` }, { text: `2 ${examType}` }, { text: `3 ${examType}` }],
                    [{ text: `4 ${examType}` }, { text: `5 ${examType}` }],
                    [{ text: "🔙 Back to Education" }, { text: "🏠 Home" }]
                ],
                resize_keyboard: true
            }
        }
    );
}

// When user picks a quantity, calculate price and display WEMA Bank payment details
async function showPaymentInstructions(bot, chatId, examType, qty) {
    const pricePerUnit = 6000;
    const totalAmount = pricePerUnit * qty;
    const formattedAmount = totalAmount.toLocaleString();

    const message = `🏛 *Payment Instructions*\n\n` +
        `Dear esteemed customer, you have selected **${qty}x ${examType} Pin(s)**.\n\n` +
        `Total Amount to Pay: **₦${formattedAmount}**\n\n` +
        `Please make a direct bank transfer to our official settlement account details provided below:\n\n` +
        `🏛 *Bank Name:* WEMA Bank\n` +
        `*Account Number:* \`0274375691\`\n` +
        `*Account Name:* Opemipo Samuel Olajide\n\n` +
        `*Kindly ensure you transfer the exact amount stated above. Once the transfer is completed, tap the button below and proceed to upload your payment receipt for prompt verification.*`;

    await bot.sendMessage(
        chatId,
        message,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: `✅ I Have Paid (${qty}x ${examType})` }],
                    [{ text: "🔙 Back to Education" }, { text: "🏠 Home" }]
                ],
                resize_keyboard: true
            }
        }
    );
}

// When user clicks "I Have Paid"
async function handlePaymentConfirmation(bot, chatId, orderDetails) {
    await bot.sendMessage(
        chatId,
        `✅ *Payment Notice Received*\n\nThank you! Your payment notice has been received and will be verified shortly.\n\nPlease **upload your payment receipt / screenshot** right here in the chat so our admin can verify it and dispatch your pin(s) immediately.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: "🔙 Back to Education" }, { text: "🏠 Home" }]
                ],
                resize_keyboard: true
            }
        }
    );

    // Note: Here is where you can also forward a notification to your admin bot chat/channel if needed!
}

module.exports = {
    startEducation,
    selectQuantity,
    showPaymentInstructions,
    handlePaymentConfirmation
};
