const morgan = require('morgan');
const winston = require("winston");
const express = require("express");
const app = express();
require('dotenv').config();
const cron = require('node-cron');
const loanDeduction = require('./utils/cronJobs/loanDeduction');
const resetCron = require('./utils/cronJobs/resetCron');
const scheduledSavingsDeduction = require('./utils/cronJobs/scheduledSavings');

require("./startup/logging")();
app.use(morgan('tiny'));
require("./startup/cors.js")(app);
require("./startup/db")();

// cron.schedule('0 0 * * *', () => {
//   loanDeduction()
// });
// cron.schedule('* * * * *', () => {
//   console.log("running every minute")
//   loanDeduction()

// });
// cron.schedule('* * * * *', () => {
//   console.log("running every now and den")
//   resetCron()
// });
// cron.schedule('* * * * *', () => {
//   console.log("running every minute");
//   scheduledSavingsDeduction()

// });
require("./startup/routes")(app);

// require("./startup/validation")();


const port = process.env.PORT;
const server = app.listen(port, () =>
  winston.info(`Listening on port ${port}...`)
);

module.exports = server;
