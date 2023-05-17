const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const userController = require("../controller/userController")
const adminController = require("../controller/adminController")
const { loginValidator, validate } = require("../middleware/validation");
const { validateUser, validateFarm, validateGuarantor } = require("../models/user");
const auth = require("../middleware/auth")
const upload = require("../utils/multer");

router.get('/', async (req, res) => {
    res.json('Hello! welcome to Active Farmers Admins');
})


router.post('/savings-category', adminController.createSavingsCategory)

module.exports = router; 
