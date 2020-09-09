const express = require("express");
const app = express();
const port = 3000;

const checkAir = require("./checkAir");

const dotenv = require("dotenv");
dotenv.config();

// const redisClient = require("redis").createClient(process.env.REDIS_URL);
const Redis = require("ioredis");
const redisClient = new Redis(process.env.REDIS_URL);

// checkAir.run(redisClient).then(() => redisClient.disconnect());

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

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
