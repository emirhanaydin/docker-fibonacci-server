const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const redis = require("redis");
const { promisify } = require("util");
const { StatusCodes } = require("http-status-codes");
const keys = require("./keys");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = 6000;

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("error", console.error);

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values(number INT)")
    .catch(console.error);
});

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

const getValues = promisify(redisClient.hgetall.bind(redisClient, "values"));

app.get("/", (req, res) => {
  res.send("index");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * from values");

  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  const values = await getValues();
  const result = values != null ? values : [];

  res.send(result);
});

app.post("/values", async (req, res) => {
  const { index } = req.body;

  if (parseInt(index, 10) > 40) {
    return res
      .status(StatusCodes.UNPROCESSABLE_ENTITY)
      .send("Index is too high.");
  }

  redisClient.hset("values", index, NaN.toString());
  redisPublisher.publish("insert", index);
  await pgClient.query("INSERT INTO values(number) values($1)", [index]);

  res.send({ working: true });
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
