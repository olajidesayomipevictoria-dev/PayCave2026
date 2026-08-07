const express = require("express");
const { fork } = require("child_process");
const db = require("./src/database/database.js");

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('PayCave bots are live and running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Keep-alive server listening on port ${PORT}`);
});

fork('./PayCave-Admin/index.js');
fork('./src/bot/bot.js');
