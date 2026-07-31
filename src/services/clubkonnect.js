'use strict';

const axios = require('axios');

const BASE_URL = 'https://www.nellobytesystems.com';

const USER_ID = process.env.CLUBKONNECT_USERID;
const API_KEY = process.env.CLUBKONNECT_API_KEY;

// Generate unique request ID
function generateRequestId() {
    return `PCV${Date.now()}`;
}

// Buy Airtime
async function buyAirtime(network, phone, amount) {

    const requestId = generateRequestId();

    const url =
`${BASE_URL}/APIAirtimeV1.asp?UserID=${USER_ID}&APIKey=${API_KEY}&MobileNetwork=${network}&Amount=${amount}&MobileNumber=${phone}&RequestID=${requestId}`;

    try {

        const response = await axios.get(url);

        console.log("ClubKonnect Response:", response.data);

        const result = String(response.data).toUpperCase();

        if (
            result.includes("SUCCESS") ||
            result.includes("TRANSACTION SUCCESSFUL")
        ) {

            return {
                success: true,
                requestId,
                data: response.data
            };

        }

        return {
            success: false,
            requestId,
            error: response.data
        };

    } catch (error) {

        console.error("ClubKonnect Airtime Error:", error.message);

        return {
            success: false,
            requestId,
            error: error.message
        };

    }

}

module.exports = {
    generateRequestId,
    buyAirtime
};