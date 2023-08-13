const express = require('express');
const router = express.Router();
const paymentController = require("../controller/paymentController")

//GET index page. 
router.get('/', function (req, res) {
    res.json('Hello! welcome to KAELO');
});

router.post('/', paymentController.validatePaymentByWebhook);

module.exports = router;