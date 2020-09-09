const fetch = require("node-fetch");

const dotenv = require("dotenv");
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

const ids = process.env.PURPLE_AIR_IDS.split(" ");
const toNumbers = process.env.TO_NUMBERS.split(" ");
const fromNumber = process.env.FROM_NUMBER;
const shouldSendText = JSON.parse(process.env.SHOULD_SEND_TEXT);

// const { promisfy, waitFor } = require("promisify");
const util = require("util");
const aqiKey = "current_aqi";

const goodAirThreshold = parseFloat(process.env.GOOD_AIR_THRESHOLD);
const badAirThreshold = parseFloat(process.env.BAD_AIR_THRESHOLD);

function linearInterpolate(aqiHigh, aqiLow, concHigh, concLow, concentration) {
  const conc = parseFloat(concentration);
  const a =
    ((conc - concLow) / (concHigh - concLow)) * (aqiHigh - aqiLow) + aqiLow;
  return Math.round(a);
}

function pm25ToAqi(concentration) {
  const conc = parseFloat(concentration);
  const c = Math.floor(10 * conc) / 10;

  if (c >= 0 && c < 12.1) {
    return linearInterpolate(50, 0, 12, 0, c);
  } else if (c >= 12.1 && c < 35.5) {
    return linearInterpolate(100, 51, 35.4, 12.1, c);
  } else if (c >= 35.5 && c < 55.5) {
    return linearInterpolate(150, 101, 55.4, 35.5, c);
  } else if (c >= 55.5 && c < 150.5) {
    return linearInterpolate(200, 151, 150.4, 55.5, c);
  } else if (c >= 150.5 && c < 250.5) {
    return linearInterpolate(300, 201, 250.4, 150.5, c);
  } else if (c >= 250.5 && c < 350.5) {
    return linearInterpolate(400, 301, 350.4, 250.5, c);
  } else if (c >= 350.5 && c < 500.5) {
    return linearInterpolate(500, 401, 500.4, 350.5, c);
  }
}

async function getApiInfo(id) {
  console.log(`Running for Purple Air ID ${id}`);
  return fetch(`https://www.purpleair.com/json?show=${id}`)
    .then((response) => response.json())
    .then((data) => {
      const id = data.results[0].THINGSPEAK_PRIMARY_ID;
      const key = data.results[0].THINGSPEAK_PRIMARY_ID_READ_KEY;
      return {
        id: id,
        key: key,
      };
    });
}

async function callThinkspeak(id, key, start, n) {
  return fetch(
    `https://api.thingspeak.com/channels/${id}/fields/8.json?start=${start}&offset=0&round=2&average=10&api_key=${key}`
  )
    .then((response) => response.json())
    .then((data) => {
      const values = [...Array(n).keys()].map(
        (i) => data.feeds[data.feeds.length - 1 - i].field8
      );

      var sum = 0;
      var count = 0;
      for (var i = 0; i < values.length; i++) {
        const value = pm25ToAqi(values[i]);
        if (value) {
          sum += value;
          count += 1;
        }
      }

      const result = (sum * 1.0) / count;
      console.log(`Result is ${result}`);
      return result;
    });
}

async function getAqi(id) {
  const api_info = await getApiInfo(id);
  const day = new Date();
  day.setDate(day.getDate() - 1);
  const yesterday = day.toISOString().slice(0, 10);

  return callThinkspeak(api_info.id, api_info.key, yesterday, 3);
}

async function getCurrentState(redisClient) {
  return await redisClient.get(aqiKey);
}

async function run(redisClient) {
  var accum = 0;
  var count = 0;
  for (var i = 0; i < ids.length; i++) {
    const aqi = await getAqi(ids[i]);
    if (aqi) {
      accum += aqi;
      count += 1;
    }
  }

  const result = Math.ceil(accum / count);

  console.log(`Averaged result is ${result}`);

  var status = "ok";
  if (result <= goodAirThreshold) {
    status = "good";
  } else if (result >= badAirThreshold) {
    status = "bad";
  }

  const previous = await getCurrentState(redisClient);
  await redisClient.set(aqiKey, status);

  var message;
  if (previous != status) {
    console.log(
      `Status change. Previous was ${previous}, current is ${status}`
    );
    message = `Status change! Was ${previous} but is now ${status}. AQI is ${result}`;
  } else {
    console.log(`Status is still ${status}`);
  }

  if (message) {
    console.log(`Sending message "${message}" to configured numbers`);
    if (shouldSendText) {
      toNumbers.forEach((toNumber) =>
        client.messages
          .create({
            to: toNumber,
            from: fromNumber,
            body: message,
          })
          .then((message) => console.log(message.sid))
      );
    }
  } else {
    console.log("Air quality not interesting enough to send message!");
  }

  return status;
}

exports.run = run;
exports.getCurrentState = getCurrentState;
