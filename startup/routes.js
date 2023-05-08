const express = require('express');
const locationRoutes = require('../routes/location');
const users = require('../routes/users');
const indexRouter = require("../routes/index")
const error = require("../middleware/error");

module.exports = function (app) {
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use('/api/location', locationRoutes);
    app.use('/api/users', users);
    app.use("/", indexRouter)
    app.use(error);
}