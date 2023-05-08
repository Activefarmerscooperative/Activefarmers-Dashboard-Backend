const mongoose = require("mongoose");
const { User } = require("../models/user");
const StatusCodes = require("../utils/status-codes")
const { Otp_VerifyAccount, Otp_ForgotPassword } = require("../utils/sendMail")
const _ = require("lodash");
const bcrypt = require("bcrypt");
const winston = require("winston");
const sendMail = require("../utils/sendMail");
const otpGenerator = require("otp-generator");
const OTP = require("../models/OTP");
var request = require('request');
const generateUniqueId = require('generate-unique-id');
const { initiatePaystackPayment, validatePaystackPayment } = require("../utils/paystack");

const { accountSid, authToken, serviceID, TERMII_API_KEY, TERMII_SENDER_ID, TERMII_CONFIG_ID } = require('../config.js/keys')
//Twilio client for sending phone number verification sms
const client = require('twilio')(accountSid, authToken);



exports.registerUser = async (req, res) => {

  let user = await User.findOne({
    email: req.body.email
  });
  if (user) return res.status(StatusCodes.BAD_REQUEST).send("User with this email is already registered.");

  //generate order id
  let userID = generateUniqueId({
    length: 10,
    useLetters: false
  });

  //make sure the order id is unique
  let id_check = await User.findOne({ reference: userID }).exec();
  while (id_check !== null) {
    userID = generateUniqueId({
      length: 10,
      useLetters: false
    });

    id_check = await User.findOne({ reference: userID }).exec();
  }
  req.body.reference = userID

  user = new User(_.pick(req.body, ["surname", "firstname", "reference", "email", "phone", "isoCode", "gender", "location", "lga", "address", "password", "membershipType"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  user = await user.save();

  const token = user.generateAuthToken();

  // //send OTP for Email verification
  // const code = otpGenerator.generate(6, {
  //   lowerCaseAlphabets: false,
  //   upperCaseAlphabets: false,
  //   specialChars: false,
  // });

  // const otp = new OTP({
  //   _id: mongoose.Types.ObjectId(),
  //   user: user._id,
  //   code: code,
  //   type: "Signup",
  //   created_at: new Date(),
  // });
  // await otp.save();
  // await Otp_VerifyAccount(user.email, user.full_name, code);

  //Use Twilio client to send verification sms
  // const phoneVerification = await client.verify
  //   .services(serviceID)
  //   .verifications
  //   .create({
  //     to: user.phone,
  //     channel: 'sms'
  //   })



  var data = {
    "to": user.phone,
    "message_type": "NUMERIC",
    "from": TERMII_SENDER_ID,
    "channel": "generic",
    "pin_attempts": 10,
    "pin_time_to_live": 5,
    "pin_length": 6,
    "pin_placeholder": "< 1234 >",
    "message_text": "Your AFCS Verification pin is < 1234 >",
    "pin_type": "NUMERIC",
    "api_key": TERMII_API_KEY,
  };
  var options = {
    'method': 'POST',
    'url': "https://api.ng.termii.com/api/sms/otp/send",
    'headers': {
      'Content-Type': ['application/json', 'application/json']
    },
    body: JSON.stringify(data)

  };
  let result;
  request(options, function (error, response) {
    if (error) throw new Error(error);
    console.log(response.body)
    result = response.body
  });
  console.log(result)
  res
    .header("afcs-auth-token", token)
    .status(StatusCodes.OK).json({
      status: "success",
      message: `Enter the verification code sent to ${user.phone} in order to verify your account`,
      result
      //Result is the response from the OTP SERVICE. 
      // Sample Data. Note pinId is required to verify OTP
      //  {
      //   "pinId": "29ae67c2-c8e1-4165-8a51-8d3d7c298081",
      //   "to": "2348109077743",
      //   "smsStatus": "Message Sent"
      // }
    });

}

//Verify token entered by user.
exports.verify_token = async (req, res) => {

  const { token, pin_id } = req.body

  if (!token) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ error: `please enter the token sent to ${req.user.phone}` })
  }
  console.log(token, req.user.phone)
  var data = {
    "pin_id": pin_id,
    "pin": token,
    "api_key": TERMII_API_KEY,
  };
  var options = {
    'method': 'POST',
    'url': "https://api.ng.termii.com/api/sms/otp/verify",
    'headers': {
      'Content-Type': ['application/json', 'application/json']
    },
    body: JSON.stringify(data)

  };
  let result;
  request(options, function (error, response) {
    if (error) throw new Error(error);
    console.log(response.body);
    result = response.body
  });

  if (result.verified === "True") {
    return res.status(StatusCodes.OK).json({ message: 'User Registered successfully' })
  } else {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: "Please enter a valid token" });
  }

}

exports.loginUser = async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send('Invalid email or password.');

  if (!user.isVerified) return res.status(400).send('Please contact AFCS admin to verify your account.');

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).send('Invalid email or password.');

  const token = user.generateAuthToken();
  res.status(StatusCodes.OK).json({
    status: "Success",
    message: "User Login Successfull",
    token,
    user: _.pick(user, ["email", "full_name"])
  }

  );

}

exports.resend_otp = async (req, res) => {
  const { type } = req.query
  //delete any existing otp
  await OTP.findOneAndDelete({ user: req.user._id }).exec();

  //send OTP for Email verification
  const code = otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  const otp = new OTP({
    _id: mongoose.Types.ObjectId(),
    user: req.user._id,
    code: code,
    type: type ? type : "Signup",
    created_at: new Date(),
  });
  await otp.save();
  await Otp_VerifyAccount(req.user.email, req.user.full_name, code);
  res.status(StatusCodes.OK).json({ message: `Please Enter Verification code sent to ${req.user.email}` })

}


exports.farm_details = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, {
    $set: {
      regCompletePercent: 75,
      "farm.farmingExperience": req.body.farmingExperience,
      "farm.farmSize": req.body.farmSize,
      "farm.cropTypes": req.body.cropTypes,
      "farm.farmAddress": req.body.farmAddress
    }
  }, { new: true })

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Farm details updated successfully.",

  });
}

exports.guarantor_details = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, {
    $set: {
      regCompletePercent: 100,
      "guarantor.full_name": req.body.full_name,
      "guarantor.address": req.body.address,
      "guarantor.email": req.body.email,
      "guarantor.phone": req.body.phone,
      "guarantor.gender": req.body.gender,
      "guarantor.occupation": req.body.occupation,
    }
  }, { new: true })

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Guarantor details updated successfully.",

  });
}

exports.forgot_password = async (req, res) => {

  const { email } = req.body;

  const user = await User.findOne({ email, });

  if (user) {
    const code = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    const otp = new OTP({
      _id: mongoose.Types.ObjectId(),
      user: user._id,
      code: code,
      type: "ForgotPassword",
      created_at: new Date(),
    });

    await otp.save();

    // Termii Email service. Charges 1naira per email

    // var data =  {
    //   "api_key" : TERMII_API_KEY,
    //   "email_address" : "shola.olu@term.ii",
    //     "code": code,
    //     "email_configuration_id": TERMII_CONFIG_ID

    //  };
    //  var options = {
    //  'method': 'POST',
    //  'url': 'https://api.ng.termii.com/api/email/otp/send',
    //  'headers': {
    //    'Content-Type': ['application/json', 'application/json']
    //  },
    //  body: JSON.stringify(data)

    //  };
    //  request(options, function (error, response) { 
    //  if (error) throw new Error(error);
    //  console.log(response.body);
    //  });

    await Otp_ForgotPassword(user.email, code);

    // Generate user token that must be sent with the verification OTP
    const token = user.generateAuthToken();
    return res
      .header("AFCS-auth-token", token)
      .status(StatusCodes.OK).json({
        status: "success",
        message: "OTP sent to your email. Incase of any delay, check your email spam folder.",
      });
  }

  return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "This Email does not exist on Active Farmers Service.",
  });

}

//Verify Email token entered by user.
exports.verify_email_token = async (req, res) => {


  const { token } = req.body

  if (!token) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ error: `please enter the token sent to ${req.user.email}` })
  }

  //check otp code
  const otp = await OTP.findOne({ code: token })
    .populate("user", "_id email")
    .exec();

  if (!otp) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'failed',
      error: 'Invalid OTP code'
    });
  }
  if (otp.user.email !== req.user.email) {

    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'failed',
      error: 'Invalid Token Credentials'
    });
  }
  //delete otp code
  await OTP.findOneAndDelete({ code: token }).exec();

  await User.findByIdAndUpdate(otp.user._id, {
    resetPassword: true
  }, {
    new: true
  })
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'OTP verified, You can now reset Password'
  });


}

exports.reset_password = async (req, res) => {
  const { password } = req.body
  // Only users with valid OTP can reset password. hence resetPassword=true
  let user = await User.findOne({ email: req.user.email, resetPassword: true }).exec();

  // This user is not on the app
  if (!user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "Invalid credentials",
    });
  }
  // hash the password
  const salt = await bcrypt.genSalt(10);
  const hashed_password = await bcrypt.hash(password, salt);

  user.password = hashed_password;
  user.resetPassword = false;

  await user.save();
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'You have successfully reset your password',

  });


}

exports.change_password = async (req, res) => {
  const { email, password, oldPassword } = req.body;

  // Email entered must match user email
  if (req.user.email !== email || !oldPassword || !password) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      status: "failed",
      error: "Invalid or Incomplete Credentials",
    });
  }

  const user = await User.findOne({ email: req.user.email });

  if (!user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "User not Found on Active Farmers Cooperative Service",
    });
  }
  //**** */   check if old password matches the password in DB
  let password_match = await bcrypt.compare(
    oldPassword,
    user.password
  );
  if (!password_match) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "Old password is Incorrect",
    });
  }
  //**** */   user can't use former password
  password_match = await bcrypt.compare(
    password,
    user.password
  );

  if (password_match) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "Cannot Use Old Password, Please set New Password",
    });
  }

  // hash the password
  const salt = await bcrypt.genSalt(10);
  const hashed_password = await bcrypt.hash(password, salt);

  // await userModel.findOneAndUpdate(filter, update);
  user.password = hashed_password
  await user.save()
  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Password Successfully Updated",
  });
}

// Update user Profile Photo
exports.update_user_profile_pic = async (req, res) => {

  const result = await cloudinary.uploader.upload(req.file.path);
  const updatedUser = await User.findByIdAndUpdate(req.user._id, {
    $set: { photo: result.secure_url }
  }, { new: true })
  res.status(200).json({ message: "Profile Pic updated Successfully", profilePic: updatedUser.photo })

}
