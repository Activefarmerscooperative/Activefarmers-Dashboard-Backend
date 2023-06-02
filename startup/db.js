const winston = require("winston");
const mongoose = require('mongoose');
require('dotenv').config();
const db = process.env.MONGODB_URI || process.env.ATLAS_URI

module.exports = function() {
    mongoose.connect(db)
      .then(() => winston.info(`Connected to db...`));
  }