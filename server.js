const express = require("express");
const { fork } = require("child_process");
const db = require("./database"); // Import the main customer database
const app = express();
const PORT = process.env.PORT || 10000;


app.get('/', (req, res) => {
    res.send('PayCave bots are live and running 24/7!');
    });
// Secure Admin Refund Endpoint
app.post('/api/admin/refund', express.json(), async (req, res) => {
    const { secretKey, telegramId, amount } = req.body;

        if (secretKey !== process.env.ADMIN_SECRET_KEY) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
                    }

                        try {
                                db.run(
                                            `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                                                        [amount, telegramId],
                                                                    function (err) {
                                                                                    if (err) {
                                                                                                        return res.status(500).json({ success: false, message: err.message });
                                                                                                                        }
                                                                                                                                        if (this.changes === 0) {
                                                                                                                                                            return res.status(404).json({ success: false, message: 'User not found' });
                                                                                                                                                                            }
                                                                                                                                                                                            res.json({ success: true, message: `Successfully refunded ₦${amount}` });
                                                                                                                                                                                                        }
                                                                                                                                                                                                                );
                                                                                                                                                                                                                    } catch (error) {
                                                                                                                                                                                                                            res.status(500).json({ success: false, message: error.message });
                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                });

    app.listen(PORT, () => {
        console.log(`Keep-alive server listening on port ${PORT}`);
        });

        fork('./PayCave-Admin/index.js');
        fork('./src/bot/bot.js');
        