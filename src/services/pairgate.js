'use strict';

const axios = require('axios');
const db = require('../database/database');


const PAIRGATE_API_KEY = process.env.PAIRGATE_API_KEY || "PG_live_vZM88yae2t2B1PnvA8C551ghMRYH10r1QpfiebtAYWlUZ";

const headers = {
    Authorization: `Bearer ${PAIRGATE_API_KEY}`,
    'Content-Type': 'application/json'
};

// ==========================
// URLS
// ==========================

const AIRTIME_URL = 'https://pairgate.com/api/v1/airtime/purchase';

const DATA_CATEGORIES_URL =
'https://pairgate.com/api/v1/data-plans/categories';

const DATA_PLANS_URL =
'https://pairgate.com/api/v1/data-plans';

const DATA_PURCHASE_URL =
'https://pairgate.com/api/v1/data/purchase';

const ELECTRICITY_PROVIDERS_URL =
'https://pairgate.com/api/v1/providers/electricity';

const ELECTRICITY_VERIFY_URL =
'https://pairgate.com/api/v1/electricity/verify';

const ELECTRICITY_PURCHASE_URL =
'https://pairgate.com/api/v1/electricity/purchase';

// --- CABLE TV URLS ---
const CABLE_PLANS_URL = 'https://pairgate.com/api/v1/cable-plans';
const CABLE_VERIFY_URL = 'https://pairgate.com/api/v1/cable/verify';
const CABLE_PURCHASE_URL = 'https://pairgate.com/api/v1/cable/purchase';


// =====================================
// BUY AIRTIME
// =====================================

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
            result.status === "success" &&
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
            message: result.message || "Airtime purchase failed."
        };

    } catch (err) {

        if (err.response?.data) {

            return {
                success: false,
                message:
                    err.response.data.message ||
                    "PairGate API Error"
            };

        }

        return {
            success: false,
            message: err.message
        };

    }

}


// =====================================
// GET DATA CATEGORIES
// =====================================

async function getDataCategories() {

    const response = await axios.get(
        DATA_CATEGORIES_URL,
        { headers }
    );

    return response.data.data;

}


// =====================================
// GET DATA PLANS
// =====================================

async function getDataPlans(provider, planType) {

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

                                                                                                        const dataObj = response.data.data;
                                                                                                            const key = Object.keys(dataObj)[0];
                                                                                                                const plans = dataObj[key];

                                                                                                                    if (!plans || !Array.isArray(plans)) {
                                                                                                                            return dataObj;
                                                                                                                                }

                                                                                                                                    // Loop through plans and check if admin set a custom selling price
                                                                                                                                        for (let plan of plans) {
                                                                                                                                                const planId = plan.id || plan.plan_id || plan.code || plan.plan_code;
                                                                                                                                                        if (planId) {
                                                                                                                                                                    const customPrice = await db.getCustomPrice(String(planId));
                                                                                                                                                                                if (customPrice !== null && customPrice !== undefined) {
                                                                                                                                                                                                plan.price = customPrice; // Override with admin price
                                                                                                                                                                                                            }
                                                                                                                                                                                                                    }
                                                                                                                                                                                                                        }

                                                                                                                                                                                                                            return dataObj;

                                                                                                                                                                                                                            }
                                                                                                                                                                                                                            


// =====================================
// BUY DATA
// =====================================

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

        const result = response.data;

        if (
            result.code === 200 &&
            result.status === "success"
        ) {

            return {
                success: true,
                data: result.data
            };

        }

        return {
            success: false,
            message: result.message || "Data purchase failed."
        };

    } catch (err) {

        if (err.response?.data) {

            return {
                success: false,
                message:
                    err.response.data.message ||
                    "PairGate API Error"
            };

        }

        return {
            success: false,
            message: err.message
        };

    }

}


// =====================================
// GET ELECTRICITY PROVIDERS
// =====================================

async function getProviders() {

    try {

        const response = await axios.get(
            ELECTRICITY_PROVIDERS_URL,
            { headers }
        );

        return response.data.data;

    } catch (err) {

        throw err;

    }

}


// =====================================
// VERIFY METER
// =====================================

async function verifyMeter(
    provider,
    meterNumber,
    meterType
) {

    try {
        console.log("VERIFY REQUEST:", {
            provider_id: provider,
            meter_number: meterNumber,
            meter_type: meterType
        });

        const response = await axios.post(

            ELECTRICITY_VERIFY_URL,

            {
                provider_id: provider,
                meter_number: meterNumber,
                meter_type: meterType
            },

            { headers }

        );

        return response.data.data;

    } catch (err) {

        if (err.response?.data) {

            return {
                success: false,
                message:
                    err.response.data.message ||
                    "Meter verification failed."
            };

        }

        return {
            success: false,
            message: err.message
        };

    }

}


// =====================================
// PURCHASE ELECTRICITY
// =====================================

async function purchaseElectricity(
    provider,
    amount,
    meterNumber,
    meterType,
    recipient
) {

    try {

        const response = await axios.post(

            ELECTRICITY_PURCHASE_URL,

            {
                provider_id: provider,
                amount: Number(amount),
                meter_number: meterNumber,
                meter_type: meterType,
                recipient_name: recipient,
                reference: `ELEC-${Date.now()}`
            },

            { headers }

        );

        const result = response.data;

        if (
            result.code === 200 &&
            result.status === "success"
        ) {

            return {
                success: true,
                data: result.data
            };

        }

        return {
            success: false,
            message:
                result.message ||
                "Electricity purchase failed."
        };

    } catch (err) {

        if (err.response?.data) {

            return {
                success: false,
                message:
                    err.response.data.message ||
                    "PairGate API Error"
            };

        }

        return {
            success: false,
            message: err.message
        };

    }

}


// =====================================
// CABLE TV SERVICES
// =====================================

async function getCablePlans(providerId) {
    try {
        const response = await axios.get(CABLE_PLANS_URL, {
            params: { provider_id: providerId },
            headers
        });
        return response.data;
    } catch (err) {
        if (err.response?.data) {
            return {
                success: false,
                message: err.response.data.message || "Failed to fetch cable plans."
            };
        }
        return { success: false, message: err.message };
    }
}

async function verifyCableCustomer(providerId, smartcard) {
    try {
        const response = await axios.post(
            CABLE_VERIFY_URL,
            {
                provider_id: providerId,
                smartcard: smartcard
            },
            { headers }
        );
        return response.data;
    } catch (err) {
        if (err.response?.data) {
            return err.response.data;
        }
        return { success: false, message: err.message };
    }
}

// =====================================
// PURCHASE CABLE
// =====================================

async function purchaseCable(provider, planCode, smartcard, customerName, reference) {
    try {
            const response = await axios.post(
                        CABLE_PURCHASE_URL,
                                    {
                                                    provider_id: provider,
                                                                    plan_code: planCode,
                                                                                    smartcard: smartcard,
                                                                                                    customer_name: customerName,
                                                                                                                    reference: reference
                                                                                                                                },
                                                                                                                                            { headers }
                                                                                                                                                    );

                                                                                                                                                            const result = response.data;

                                                                                                                                                                    if (result.code === 200 && result.status === "success") {
                                                                                                                                                                                return {
                                                                                                                                                                                                success: true,
                                                                                                                                                                                                                data: result.data
                                                                                                                                                                                                                            };
                                                                                                                                                                                                                                    }

                                                                                                                                                                                                                                            return {
                                                                                                                                                                                                                                                        success: false,
                                                                                                                                                                                                                                                                    message: result.message || "Cable purchase failed."
                                                                                                                                                                                                                                                                            };

                                                                                                                                                                                                                                                                                } catch (err) {
                                                                                                                                                                                                                                                                                        if (err.response?.data) {
                                                                                                                                                                                                                                                                                                    return {
                                                                                                                                                                                                                                                                                                                    success: false,
                                                                                                                                                                                                                                                                                                                                    message: err.response.data.message || "PairGate API Error"
                                                                                                                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                return { success: false, message: err.message };
                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                    


module.exports = {  // Airtime
    buyAirtime,

    // Data
    getDataCategories,
    getDataPlans,
    buyData,

    // Electricity
    getProviders,
    verifyMeter,
    purchaseElectricity,

    // Cable TV
    getCablePlans,
    verifyCableCustomer,
    purchaseCable
};
