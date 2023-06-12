const express = require('express');
const locationRoutes = require('../routes/location');
const adminRoutes = require('../routes/admins');
const users = require('../routes/users');
const indexRouter = require("../routes/index")
const error = require("../middleware/error");
const paymentRoutes = require("../routes/paymentConfirmation");

module.exports = function (app) {
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use('/api/payments', paymentRoutes);
    app.use('/api/location', locationRoutes);
    app.use('/api/admins', adminRoutes);
    app.use('/api/users', users);
    app.use("/", indexRouter)
    app.use(error);
}