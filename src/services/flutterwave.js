'use strict';

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://api.flutterwave.com/v3';

const headers = {
    Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
};

function generateTxRef(telegramId) {
    return `PAYCAVE_${telegramId}_${Date.now()}`;
}

function verifyWebhook(hash) {
    return hash === process.env.FLW_SECRET_HASH;
}

async function createVirtualAccount(amount, user) {

    const tx_ref = generateTxRef(user.telegram_id);

    const payload = {
        email: `${user.telegram_id}@paycave.app`,
        currency: "NGN",
        amount: Number(amount),
        firstname: user.first_name || "PayCave",
        lastname: user.last_name || "User",
        tx_ref,
        is_permanent: false,
        narration: "PayCave Wallet Funding"
    };

    try {

        const response = await axios.post(
            `${BASE_URL}/virtual-account-numbers`,
            payload,
            { headers }
        );

        return {
            success: true,
            tx_ref,
            data: response.data.data
        };

    } catch (error) {

        console.error(
            "Flutterwave Error:",
            error.response?.data || error.message
        );

        return {
            success: false,
            error: error.response?.data || error.message
        };

    }

}

async function verifyPayment(reference) {

    try {

    
        const response = await axios.get(
            `${BASE_URL}/transactions/verify_by_reference?tx_ref=${reference}`,
            { headers }
        );

        if (
            response.data.status === "success" &&
            response.data.data &&
            response.data.data.status === "successful"
        ) {
            return {
                success: true,
                data: response.data.data
            };
        }

        return {
            success: false
        };

    } catch (error) {

        console.error(
            "Verification Error:",
            error.response?.data || error.message
        );

        return {
            success: false
        };

    }

}

                                                                                                                                                                                                                                                                    module.exports = {
                                                                                                                                                                                                                                                                            generateTxRef,
                                                                                                                                                                                                                                                                                verifyWebhook,
                                                                                                                                                                                                                                                                                    createVirtualAccount,
                                                                                                                                                                                                                                                                                        verifyPayment
                                                                                                                                                                                                                                                                                        };
                                                                                                                                                                                                                                                                    
