const morgan = require('morgan');
const winston = require("winston");
const express = require("express");
const app = express();
require('dotenv').config();
const cron = require('node-cron');
const loanDeduction = require('./utils/cronJobs/loanDeduction');
const resetCron = require('./utils/cronJobs/resetCron');
const scheduledSavingsDeduction = require('./utils/cronJobs/scheduledSavings');
const { test_Cron } = require('./utils/sendMail.js');

require("./startup/logging")();
app.use(morgan('tiny'));
require("./startup/cors.js")(app);
require("./startup/db")();


cron.schedule('5 0 * * *', () => {
  console.log("Running at 12:05 AM every day");
  test_Cron();
  scheduledSavingsDeduction();
});

cron.schedule('0 * * * *', () => {
  console.log("Running at the start of every hour");
  // Add any function calls you want to execute every hour here
  test_Cron();
});

cron.schedule('5 2 * * *', () => {
  console.log("Running at 2 AM every day");
  loanDeduction();
});

// reset ongoing loan to initiated so deduction can be made for the current mth.
cron.schedule('5 1 1 * *', () => {
  console.log("Running at 1 AM on the 1st day of the month");
  resetCron();
});

require("./startup/routes")(app);

// require("./startup/validation")();


const port = process.env.PORT;
const server = app.listen(port, () =>
  winston.info(`Listening on port ${port}...`)
);

module.exports = server;
