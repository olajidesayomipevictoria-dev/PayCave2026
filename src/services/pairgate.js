'use strict';

const axios = require('axios');

const API_KEY = process.env.PAIRGATE_API_KEY;

const AIRTIME_URL = 'https://pairgate.com/api/v1/airtime/purchase';
const DATA_CATEGORIES_URL = 'https://pairgate.com/api/v1/data-plans/categories';
const DATA_PLANS_URL = 'https://pairgate.com/api/v1/data-plans';
const DATA_PURCHASE_URL = 'https://pairgate.com/api/v1/data/purchase';

const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

// ==========================
// BUY AIRTIME
// ==========================

async function buyAirtime(network, phone, amount) {
    try {

        const response = await axios.post(
            AIRTIME_URL,
            {
                provider_id: network,
                amount: Number(amount),
                recipient: phone,
                reference: `AIR-${Date.now()}`
            },
            { headers }
        );

        const result = response.data;

        if (
            result.code === 200 &&
            result.status === 'success' &&
            result.data &&
            result.data.status === true
        ) {
            return {
                success: true,
                requestId: result.data.reference_code,
                message: result.data.message,
                amount: result.data.amount,
                recipient: result.data.recipient,
                balanceBefore: result.data.balance_before,
                balanceAfter: result.data.balance_after
            };
        }

        return {
            success: false,
            message: result.message || 'Airtime purchase failed.'
        };

    } catch (err) {

        if (err.response && err.response.data) {
            return {
                success: false,
                message:
                    err.response.data.message ||
                    err.response.data.code ||
                    'PairGate API Error'
            };
        }

        return {
            success: false,
            message: err.message
        };
    }
}

// ==========================
// GET DATA CATEGORIES
// ==========================

async function getDataCategories() {
    try {

        const response = await axios.get(
            DATA_CATEGORIES_URL,
            { headers }
        );

        return response.data.data;

    } catch (err) {

        throw err;

    }
}

// ==========================
// GET DATA PLANS
// ==========================

async function getDataPlans(provider, planType) {

    try {

        const response = await axios.get(
            DATA_PLANS_URL,
            {
                headers,
                params: {
                    provider_id: provider,
                    plan_type: planType
                }
            }
        );

        return response.data.data;

    } catch (err) {

        throw err;

    }

}

// ==========================
// BUY DATA
// ==========================

async function buyData(provider, planId, phone) {

    try {

        const response = await axios.post(
            DATA_PURCHASE_URL,
            {
                provider_id: provider,
                plan_id: planId,
                recipient: phone,
                reference: `DATA-${Date.now()}`
            },
            { headers }
        );

        return response.data;

    } catch (err) {

        if (err.response && err.response.data) {
            return err.response.data;
        }

        throw err;

    }

}

module.exports = {
    buyAirtime,
    getDataCategories,
    getDataPlans,
    buyData
};
