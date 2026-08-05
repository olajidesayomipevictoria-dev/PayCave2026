'use strict';

const axios = require('axios');

const api = axios.create({
    baseURL: 'https://pairgate.com/api/v1',
    headers: {
        Authorization: `Bearer ${process.env.PAIRGATE_API_KEY}`,
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, params = {}, retry = 5) {
        try {
                // Give a slightly longer baseline pause between any API calls
                        await sleep(1500);

                                const { data } = await api.get(url, { params });

                                        if (data.status === "success") {
                                                    return data;
                                                            }

                                                                    if (
                                                                                data.message &&
                                                                                            (
                                                                                                            data.message.toLowerCase().includes("too many") ||
                                                                                                                            data.message.toLowerCase().includes("please wait")
                                                                                                                                        )
                                                                                                                                                ) {
                                                                                                                                                            if (retry <= 0) return null;

                                                                                                                                                                        console.log(`⏳ Rate limited on plan_type [${params.plan_type || 'unknown'}]. Backing off for 6 seconds...`);
                                                                                                                                                                                    
                                                                                                                                                                                                // Progressive backoff: wait longer with each retry attempt (6s, 8s, 10s...)
                                                                                                                                                                                                            await sleep(6000 + (5 - retry) * 2000);

                                                                                                                                                                                                                        return request(url, params, retry - 1);
                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                        console.log("PairGate response error:", data);
                                                                                                                                                                                                                                                return null;

                                                                                                                                                                                                                                                    } catch (err) {
                                                                                                                                                                                                                                                            const error = err.response?.data || err.message;
                                                                                                                                                                                                                                                                    console.log("PairGate request error:", error);

                                                                                                                                                                                                                                                                            if (retry > 0) {
                                                                                                                                                                                                                                                                                        await sleep(6000);
                                                                                                                                                                                                                                                                                                    return request(url, params, retry - 1);
                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                    return null;
                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                        }



async function getDataCategories() {
    const response = await request(
        "/data-plans/categories"
    );

    if (!response) return [];

    return Array.isArray(response.data)
        ? response.data
        : [];
}

async function getDataPlans(providerId, planType) {
    const response = await request(
        "/data-plans",
        {
            provider_id: providerId,
            plan_type: planType
        }
    );

    if (!response) return [];

    const data = response.data;

    // Response is directly an array
    if (Array.isArray(data)) {
        return data;
    }

    // Response contains data object
    if (data && typeof data === "object") {
        if (
            data[providerId] &&
            Array.isArray(data[providerId])
        ) {
            return data[providerId];
        }

        const key = Object.keys(data)
            .find(k =>
                String(k).toLowerCase()
                === String(providerId).toLowerCase()
            );

        if (
            key &&
            Array.isArray(data[key])
        ) {
            return data[key];
        }

        for (const item of Object.values(data)) {
            if (Array.isArray(item)) {
                return item;
            }
        }
    }

    console.log("❌ No plan array returned from PairGate");
    return [];
}

module.exports = {
    getDataCategories,
    getDataPlans
};
