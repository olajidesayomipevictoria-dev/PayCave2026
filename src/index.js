'use strict';

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });


const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load Database
require('./database/database');

// Health Check
app.get('/', (req, res) => {
    res.json({
            success: true,
                    app: 'PayCave v2',
                            status: 'Running 🚀'
                                });
                                });

                                // Webhook Route
                                app.use('/webhook', require('./routes/webhook'));

                                const PORT = process.env.PORT || 3000;

                                app.listen(PORT, () => {
                                    console.log(`🚀 PayCave Server running on port ${PORT}`);
                                    });

                                    // Start Telegram Bot
                                    require('./bot/bot');