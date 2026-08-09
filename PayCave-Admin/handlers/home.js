'use strict';

const { HOME_MENU } = require('../keyboard');

async function openHome(bot, chatId) {

    await bot.sendMessage(

        chatId,

        "👑 *PayCave Admin Panel*\n\nWelcome back, Admin.",

        {

            parse_mode: "Markdown",

            ...HOME_MENU

        }

    );

}

module.exports = {

    openHome

};