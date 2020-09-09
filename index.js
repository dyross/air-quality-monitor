const express = require("express");
const app = express();
const path = require("path");

const checkAir = require("./checkAir");

const dotenv = require("dotenv");
dotenv.config();

const Redis = require("ioredis");
const redisClient = new Redis(process.env.REDIS_URL);

app.get("/", (req, res) => {
  checkAir
    .getCurrentState(redisClient)
    .then((result) => res.send(`Current state is: ${result}`))
    .catch((err) => res.send(`Error is ${err}`));
});

app.get("/run", (req, res) => {
  checkAir
    .run(redisClient)
    .then((result) => res.send(`Result is: ${result}`))
    .catch((err) => res.send(`Error is ${err}`));
});

const PORT = process.env.PORT || 5000;

app
  .use(express.static(path.join(__dirname, "public")))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
