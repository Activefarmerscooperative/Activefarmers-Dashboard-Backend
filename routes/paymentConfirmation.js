const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const paymentController = require("../controller/paymentController")

const auth = require("../middleware/auth")

// router.post('/', paymentController.validatePaymentByWebhook);
router.post('/validate', auth, paymentController.validatePayment);
module.exports = router; 
