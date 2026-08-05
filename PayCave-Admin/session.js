'use strict';

const sessions = new Map();

// ===============================
// CREATE / UPDATE SESSION
// ===============================

function set(userId, data) {

    const current = sessions.get(userId) || {};

    sessions.set(userId, {
        ...current,
        ...data
    });

}

// ===============================
// GET SESSION
// ===============================

function get(userId) {

    return sessions.get(userId) || {};

}

// ===============================
// SAVE NETWORK
// ===============================

function setNetwork(userId, network) {

    set(userId, {
        network
    });

}

// ===============================
// SAVE CATEGORIES
// ===============================

function setCategories(userId, categories) {

    set(userId, {
        categories
    });

}

// ===============================
// SAVE CURRENT CATEGORY
// ===============================

function setCategory(userId, category) {

    set(userId, {
        category
    });

}

// ===============================
// SAVE CURRENT PLANS
// ===============================

function setPlans(userId, plans) {

    set(userId, {
        plans
    });

}

// ===============================
// CLEAR SESSION
// ===============================

function clear(userId) {

    sessions.delete(userId);

}

module.exports = {

    set,
    get,

    setNetwork,
    setCategories,
    setCategory,
    setPlans,

    clear

};