const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const userController = require("../controller/userController")
const { loginValidator, validate, scheduledSavingsValidator } = require("../middleware/validation");
const { validateUser, validateUserUpdate, validateFarm, validateGuarantor, validateUserOccupation, validateNextOfKin } = require("../models/user");
const auth = require("../middleware/auth")
const upload = require("../utils/multer");
const { validateAccount } = require('../models/accountDetails');

router.get('/', async (req, res) => {
    res.json('Hello! welcome to Active Farmers User');
})

//  Get the current user.
router.get('/me', auth, userController.getUser)

//  Get the current user Transactions.
router.get('/transactions', auth, userController.getTransactions)

//  Get the user bank details.
router.get('/bank-details', auth, userController.get_bank_details)

//  Get the user guarantor details.
router.get('/guarantor-details', auth, userController.get_guarantor_details)

router.post('/', validate(validateUser), userController.registerUser);

// Verify OTP
router.put('/', auth, userController.verify_token);

//resend phone verification code
router.post('/resend-verification', auth, userController.resend_otp)

router.get('/token', auth, userController.confirmAFCSToken);

router.put('/personal_details', auth, validate(validateUserUpdate), userController.personal_details);

router.put('/farm_details', auth, validate(validateFarm), userController.farm_details);

router.put('/guarantor_details', auth, validate(validateGuarantor), userController.guarantor_details);

router.put('/occupation_details', auth, validate(validateUserOccupation), userController.occupation_details);

router.put('/nextOfKin_details', auth, validate(validateNextOfKin), userController.nextOfKin_details);

router.get('/bank_list', auth, userController.bank_list);

router.put('/bank-details', auth, validate(validateAccount), userController.bank_details);

router.post('/login', validate(loginValidator), userController.loginUser);

router.post('/forgot-pw', userController.forgot_password);

//Verify Email token Entered by User after forgot password
router.post('/verify-token', auth, userController.verify_email_token);

router.put('/reset-pw', auth, userController.reset_password);

router.put('/change-pw', auth, userController.change_password);

// Update users profile photo
router.post('/update-user-photo', auth, upload.single('uploaded_file'), userController.update_user_profile_pic)

router.get('/savings-category', auth, userController.get_savings_category);

//My Savings Wallet 
router.get('/savings-wallet', auth, userController.get_my_savings_wallet);

router.get('/scheduled-savings', auth, userController.get_my_scheduled_savings);

router.post('/savings', auth, userController.add_savings);

router.post('/savings/withdrawal', auth, userController.savings_withdrawal);

router.post('/scheduled-savings', auth,validate(scheduledSavingsValidator), userController.add_scheduled_savings);

router.put('/scheduled-savings/:id/card', auth, userController.add_scheduled_savings_card);

router.get('/myLoan', auth, userController.my_loan);

router.post('/loan', auth, userController.loan_request);

router.post('/loan/card', auth, userController.validate_user_card);

// Charge card saved by user  for loan.
router.put('/loan/card', auth, userController.validate_saved_card);

router.put('/loan', auth, userController.cancel_loan_request);


module.exports = router; 
