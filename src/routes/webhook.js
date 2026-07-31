'use strict';

const express = require('express');

const router = express.Router();

const db = require('../database/database');
const bot = require('../bot/bot');

router.post('/', async (req, res) => {

    try {

        console.log("📩 Flutterwave Webhook Received");

        console.log(req.body);

        return res.sendStatus(200);

    } catch (err) {

        console.error(err);

        return res.sendStatus(500);

    }

});

module.exports = router;