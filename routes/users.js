const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const userController = require("../controller/userController")
const { loginValidator, validate } = require("../middleware/validation");
const { validateUser, validateFarm, validateGuarantor } = require("../models/user");
const auth = require("../middleware/auth")
const upload = require("../utils/multer");

router.get('/', async (req, res) => {
    res.json('Hello! welcome to Active Farmers User');
})

router.post('/', validate(validateUser), userController.registerUser);

// Verify OTP
router.put('/', auth, userController.verify_token);
//resend phone verification code
router.post('/resend-verification', auth, userController.resend_otp)

router.put('/farm_details', auth,validate(validateFarm), userController.farm_details);

router.put('/guarantor_details', auth,validate(validateGuarantor), userController.guarantor_details);

router.post('/login', validate(loginValidator), userController.loginUser);

router.post('/forgot-pw', userController.forgot_password);

//Verify Email token Entered by User after forgot password
router.post('/verify-token',auth,userController.verify_email_token);

router.put('/reset-pw', auth, userController.reset_password);

router.put('/change-pw', auth, userController.change_password);

// Update users profile photo
router.post('/update-user-photo',auth,upload.single('uploaded_file'),userController.update_user_profile_pic)





module.exports = router; 
