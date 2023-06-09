const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const userController = require("../controller/userController")
const adminController = require("../controller/adminController")
const { loginValidator, validate, adminLoginValidator } = require("../middleware/validation");
const { validateAdmin } = require("../models/admin");
const auth = require("../middleware/auth")
const upload = require("../utils/multer");

router.get('/', async (req, res) => {
    res.json('Hello! welcome to Active Farmers Admins');
})

router.post('/', validate(validateAdmin), adminController.registerAdmin);

// Verify OTP
router.put('/', auth, adminController.verify_token);

//resend phone verification code
router.post('/resend-verification', auth, adminController.resend_otp)

router.post('/login', validate(adminLoginValidator), adminController.loginAdmin);

router.post('/forgot-pw', adminController.forgot_password);

//Verify Email token Entered by Admin after forgot password
router.post('/verify-token', auth, adminController.verify_email_token);

router.put('/reset-pw', auth, adminController.reset_password);

router.put('/change-pw', auth, adminController.change_password);

router.get('/total-savings', auth, adminController.getTotalSavings);

router.get('/total-loans', auth, adminController.getTotalLoans);//Unpaid Loans

router.get('/token', auth, adminController.confirmAFCSToken);

router.get('/members', auth, adminController.getMembers);

router.get('/members-count', auth, adminController.getMembersCount);

// Get savings-balance for a single member
router.get('/member-savings/:id', auth, adminController.getMembersSavings);

// Get Loan for a single member
router.get('/member-loan/:id', auth, adminController.getMembersLoan);

router.get('/borrowers', auth, adminController.getBorrowers);

router.get('/borrowers-count', auth, adminController.getBorrowersCount);

router.get('/loan-request', auth, adminController.getLoanRequest);

router.get('/withdrawal-request', auth, adminController.getWithdrawalRequest);

//id her is user id
router.get('/wallet/:id', auth, adminController.getUserWallet);

//id her is user id
router.get('/loan/:id', auth, adminController.getUserLoan);

//id her is user id
router.get('/loans/:id', auth, adminController.getUserLoanHistory);

//id her is user id
router.get('/withdrawal/:id', auth, adminController.getUserWithdrawalHistory);

router.post('/savings-category', auth, adminController.createSavingsCategory)

//id her is loan id
router.put('/loan/:id/rejection', auth, adminController.handleLoanRejection)

router.put('/loan/:id/approval', auth, adminController.handleLoanApproval)

router.get('/transfer-requests', auth, adminController.transferRequests)

router.put('/loan/:id/payment', auth, adminController.handlePaymentTransfer)

module.exports = router; 
