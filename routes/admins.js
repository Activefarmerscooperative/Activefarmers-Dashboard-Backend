const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const userController = require("../controller/userController")
const adminController = require("../controller/adminController")
const { loginValidator, validate } = require("../middleware/validation");
const { validateAdmin} = require("../models/admin");
const auth = require("../middleware/auth")
const upload = require("../utils/multer");

router.get('/', async (req, res) => {
    res.json('Hello! welcome to Active Farmers Admins');
})

router.post('/', validate(validateAdmin), adminController.registerAdmin);

// Verify OTP
// router.put('/', auth, adminController.verify_token);

//resend phone verification code
// router.post('/resend-verification', auth, adminController.resend_otp)
// router.post('/login', validate(loginValidator), adminController.loginAdmin);

// router.post('/forgot-pw', adminController.forgot_password);

//Verify Email token Entered by Admin after forgot password
// router.post('/verify-token', auth, adminController.verify_email_token);

// router.put('/reset-pw', auth, adminController.reset_password);

// router.put('/change-pw', auth, adminController.change_password);
router.post('/savings-category', adminController.createSavingsCategory)

module.exports = router; 
