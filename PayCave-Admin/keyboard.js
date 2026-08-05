'use strict';

// ===============================
// HOME
// ===============================

const HOME_MENU = {

    reply_markup: {

        resize_keyboard: true,

        keyboard: [

            ["💳 Prices"],

            ["📚 Education"],

            ["👥 Users"],

            ["📊 Transactions"],

            ["⚙️ Settings"]

        ]

    }

};


// ===============================
// PRICE MENU (Data Only)
// ===============================

const PRICES_MENU = {

    reply_markup: {

            resize_keyboard: true,

                    keyboard: [

                                ["📶 Data Prices"],

                                            ["🔄 Sync PairGate"],

                                                        ["🔙 Back", "🏠 Home"]

                                                                ]

                                                                    }

                                                                    };
                                                                    



    

        

        

            

        

            

        

        

            

        

    


// ===============================
// DATA NETWORKS
// ===============================

const DATA_NETWORKS = {

    reply_markup: {

        resize_keyboard: true,

        keyboard: [

            ["🟡 MTN"],

            ["🔴 Airtel"],

            ["🟢 Glo"],

            ["🔙 Back", "🏠 Home"]

        ]

    }

};

// ===============================
// BACK ONLY
// ===============================

const BACK_MENU = {

    reply_markup: {

        resize_keyboard: true,

        keyboard: [

            ["🔙 Back", "🏠 Home"]

        ]

    }

};

module.exports = {

    HOME_MENU,

    PRICES_MENU,

    DATA_NETWORKS,

    BACK_MENU

};