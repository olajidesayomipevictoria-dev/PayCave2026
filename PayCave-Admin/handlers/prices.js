'use strict';

const { PRICES_MENU } = require('../keyboard');

// ===============================
// OPEN PRICE MENU
// ===============================

async function openPrices(bot, chatId) {

    return bot.sendMessage(

        chatId,

        "💳 *Price Management*\n\nChoose a service to manage.",

        {

            parse_mode: "Markdown",

            ...PRICES_MENU

        }

    );

}

module.exports = {

    openPrices

};