const knexFactory = require("knex");
const config = require("./knexfile");

const environment = process.env.NODE_ENV === "production" ? "production" : "development";
const db = knexFactory(config[environment]);

module.exports = db;
