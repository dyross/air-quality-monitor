const checkAir = require("./checkAir");

const dotenv = require("dotenv");
dotenv.config();

// const redisClient = require("redis").createClient(process.env.REDIS_URL);
const Redis = require("ioredis");
const redisClient = new Redis(process.env.REDIS_URL);

checkAir.run(redisClient).then(() => redisClient.disconnect());
