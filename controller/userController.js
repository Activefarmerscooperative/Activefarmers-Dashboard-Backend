const mongoose = require("mongoose");
const { User } = require("../models/user");
const SavingsCategory = require("../models/savingsCategory");
const Savings = require("../models/savings");
const UserCard = require("../models/cardDetails");
const SavingsWallet = require("../models/savingsWallet");
const SavingsWithdrawal = require("../models/savingsWithdrawal")
const Loan = require("../models/loan")
const {BankDetails} = require("../models/BankDetails");
const Transaction = require("../models/transaction");
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
const { initiatePaystackPayment, validatePaystackPayment, bankList, initiatePaystackCardValidation } = require("../utils/paystack");

const { accountSid, authToken, serviceID, TERMII_API_KEY, TERMII_SENDER_ID, TERMII_CONFIG_ID } = require('../config.js/keys')
//Twilio client for sending phone number verification sms
const client = require('twilio')(accountSid, authToken);

exports.getUser = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password -isVerified -resetPassword -resendOTP")
    .populate("location", "_id name");
  res.status(StatusCodes.OK).json(user);
}


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
    "to": 2348069200188,
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
  // request(options, function (error, response) {
  //   if (error) throw new Error(error);
  //   console.log(response.body)
  //   result = response.body
  // });

  res
    .header("afcs-auth-token", token)
    .status(StatusCodes.OK).json({
      status: "success",
      message: `Enter the verification code sent to ${user.phone} in order to verify your account`,
      result,
      afcsToken: token
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
    const user = await User.findByIdAndUpdate(req.user._id, {
      $set: {
        regCompletePercent: 50,
      }
    }, { new: true })

    // Create a savings wallet for the user.
    const savingsCategories = await SavingsCategory.find().exec()
    let categories = [];
    for (let i = 0; i < savingsCategories.length; i++) {
      categories.push({
        category: savingsCategories[i]._id,
        amount: 0,
      })
      savingsCategories[i]._id

    }

    const userSavingsWallet = new SavingsWallet({
      _id: new mongoose.Types.ObjectId(),
      user: user._id,
      categories
    })
    await userSavingsWallet.save()
    return res.status(StatusCodes.OK).json({ message: 'User Registered successfully' })
  } else {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: "Please enter a valid token" });
  }

}

exports.confirmAFCSToken = async (req, res) => {
  return res.status(StatusCodes.OK).json({
    status: 'success',
    user: req.user
  });
}

exports.loginUser = async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

  if (!user.isVerified) return res.status(400).json({ error: 'Please contact AFCS admin to verify your account.' });

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

  const token = user.generateAuthToken();

  // // Create a savings wallet for the user.
  // const savingsCategories = await SavingsCategory.find().exec()
  // let categories = [];
  // for (let i = 0; i < savingsCategories.length; i++) {
  //   categories.push({
  //     category: savingsCategories[i]._id,
  //     amount: 0,
  //   })
  //   savingsCategories[i]._id

  // }

  // const userSavingsWallet = new SavingsWallet({
  //   _id: new mongoose.Types.ObjectId(),
  //   user: user._id,
  //   categories
  // })
  // await userSavingsWallet.save()

  res.status(StatusCodes.OK).json({
    status: "Success",
    message: "User Login Successfull",
    token,
    user: _.pick(user, ["email", "surname", "firstname"])
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

exports.bank_details = async (req, res) => {

  const {accountNumber,bankCode, accountName, bankName, accountType} = req.body
   await BankDetails.findByIdAndUpdate(req.user._id, {
    $set: {
      user:req.user._id,    
      accountNumber,
      bankCode,
      accountName,
      bankName,
      accountType

    }
  }, { new: true,upsert: true })

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Bank details updated successfully.",

  });
}


exports.get_bank_details = async (req, res) => {
  const bank_details = await BankDetails.findOne({ user: req.user._id }).exec()
  return res.status(StatusCodes.OK).json({
    status: "success",
    bank_details,

  });
}

exports.get_guarantor_details = async (req, res) => {
  const guarantor_details = await User.findOne({ user: req.user._id })
    .select("guarantor")
  return res.status(StatusCodes.OK).json({
    status: "success",
    guarantor_details,

  });
}

exports.bank_list = async (req, res) => {

  const { data } = await bankList();
  return res.status(StatusCodes.OK).json({
    status: "success",
    banks: data

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

exports.get_savings_category = async (req, res) => {

  const savingsCategory = await SavingsCategory.find().exec()
  res.status(StatusCodes.OK).json({ message: "Success", savingsCategory })
}

exports.get_my_savings_wallet = async (req, res) => {

  const savingsWallet = await SavingsWallet.find({
    user: req.user._id
  })
    .populate({
      path: 'categories.category',
      model: 'SavingsCategory'
    })
    .exec()
  res.status(StatusCodes.OK).json({ message: "Success", savingsWallet })
}

exports.add_savings = async (req, res) => {
  const { _id, firstname, surname, email } = req.user
  const { amount, category } = req.body
  let name = `${firstname} ${surname}`

  // Check if this is the first savings
  // First savings cannot be less dan ₦5000
  const isFirstSavings = await Savings.find({ user: _id }).exec()
  if (isFirstSavings.length < 1 && amount < 5000) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Your first saving cannot be less than ₦5000.',
  });

  //generate reference id
  let refID = generateUniqueId({
    length: 15,
    useLetters: false
  });

  //make sure the savings reference id is unique
  let id_check = await Savings.findOne({ reference: refID }).exec();
  while (id_check !== null) {
    refID = generateUniqueId({
      length: 15,
      useLetters: false
    });

    id_check = await Savings.findOne({ reference: refID }).exec();
  }

  const savings = new Savings({
    _id: new mongoose.Types.ObjectId(),
    user: _id,
    amount,
    category,
    reference: refID
  })


  const { data } = await initiatePaystackPayment(amount, email, name, savings._id);

  // If Paystack doesn't initiate payment stop the payment
  if (!data) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Operation Failed',
  });
  await savings.save();

  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Operation successful',
    data

  })
}

exports.validatePayment = async (req, res) => {

  const data = await validatePaystackPayment(req.body.reference);

  if (!data.status) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: data.message });

  if (data.data.status !== 'success') return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Payment not completed' });

  const amount_paid = data.data.amount / 100;

  const savings = await Savings.findById(data.data.metadata.savings)
    .exec();

  // If this payment has already been verified maybe either by callbackUrl or webhook prevent re-run wen page is refreshed
  if (savings.status === "Confirmed") {
    const response = {
      status: 'success',
      message: '',
      data: {}
    };

    if (data.data.metadata?.type === "Validate Card") {
      response.message = 'Your card validation was successful.';
    } else {
      response.message = 'Your savings transaction was successful.';
      response.data.savings = savings;
    }

    return res.status(StatusCodes.OK).json(response);
  }
  //payment was successful, confirm the payment
  //make sure the amount paid and order total amount corresponds
  if (savings.amount !== amount_paid) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Amount paid does not match amount recorded' });

  savings.status = 'Confirmed'
  // Each item in this order may belong to many sellers
  // Update each item with the paymnt confirmation status.

  let updateSavings = await SavingsWallet.findOne({ user: savings.user })

  updateSavings.categories.map(item => {
    if (item.category.toString() === savings.category.toString()) {
      item.amount += savings.amount
      return item
    } else {
      return item
    }
  })

  const transaction = new Transaction({
    _id: new mongoose.Types.ObjectId(),
    type: 'savings',
    user: savings.user,
    amount: savings.amount,
    payment_method: 'paystack',
    reference: req.body.reference,
    item: savings._id,
    checkModel: "Savings"
  })

  await transaction.save();
  await updateSavings.save();
  await savings.save()

  if (data.data.metadata?.type === "Validate Card") {
    // Check if Card is Valid for Loan period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    if (!data.data.authorization.reusable || data.data.authorization.exp_year < currentYear + 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'success',
        message: 'Your Card Does not meet the minimum required criteria please try another card.'
      });
    }
    const card = new UserCard({
      _id: new mongoose.Types.ObjectId(),
      user: savings.user,
      email: data.data.customer.email,
      authorization: data.data.authorization
    })

    await Loan.findOneAndUpdate({ user: savings.user, status: "Pending" }, {
      $set: {
        cardIsValid: true
      }
    }, {
      new: true
    })
    await card.save()
    return res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Your Loan request has been completed successfully.',

    });
  }

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Your Savings transaction was successful.'
  });


}
exports.validatePaymentByWebhook = async (req, res, next) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');

    if (!req.headers['x-paystack-signature']) return res.status(StatusCodes.UNAUTHORIZED).json({ status: 'failed', error: 'Un-authorized operation' });

    if (hash == req.headers['x-paystack-signature']) {
      // Retrieve the request's body
      const event = req.body;
      if (event.event == 'charge.success') {
        const data = await validatePaystackPayment(event.data.reference);

        if (!data.status) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: data.message });

        if (data.data.status !== 'success') return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Payment not completed' });

        // const amount_paid = data.data.amount / 100;
        const order = await Order.findById(data.data.metadata.order)
          .populate({
            path: 'address',
            model: 'Address',
            populate: [
              {
                path: 'state',
                model: 'State',
              },
              {
                path: 'country',
                model: 'Country',
              }]
          })
          .populate({
            path: 'items',
            model: 'OrderItem',
            populate: {
              path: 'product',
              model: 'Product',
              populate: [{
                path: 'unit',
                model: 'Unit',
              },
              {
                path: 'state',
                model: 'State',
              },
              {
                path: 'country',
                model: 'Country',
              }]
            }
          })
          .exec();

        // If this payment has already been verified maybe either by callbackUrl or hook prevent re-run wen page is refreshed
        if (order.completed === true) {
          return res.sendStatus(200);
        }
        //payment was successful, confirm the order



        // Each item in this order may belong to many sellers
        // Update each item with the paymnt confirmation status.
        await OrderItem.updateMany({ _id: { $in: order.items } },
          {
            $push: {
              status: {
                text: "Confirmed",
              }
            }
          });

        order.payment = true;
        order.completed = true;
        order.status = 'In Progress';
        await order.save();

        const transaction = new Transaction({
          _id: new mongoose.Types.ObjectId(),
          type: 'order',
          amount: order.amount,
          payment_method: 'paystack',
          reference: data.data.reference,
          item: order._id
        })

        await transaction.save();
        const buyer = await User.findOne({ email: data.data.customer.email })

        //empty cart
        await Cart.deleteMany({ user: buyer._id }).exec();


        // Send Email message to Buyer
        await orderCompleted(buyer, order)
        return res.sendStatus(200);


      }

    } else {

      return res.status(StatusCodes.UNAUTHORIZED).json({ status: 'failed', error: 'Un-authorized operation' });
    }
    // res.send(200);
  } catch (error) {
    console.log(error)
  }

}

exports.savings_withdrawal = async (req, res) => {
  const { amount, category } = req.body;

  // Get user wallet
  const myWallet = await SavingsWallet.findOne({ user: req.user }).exec()
  if (!myWallet) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Invalid Action",
  });

  const savingsCat = myWallet.categories.filter(item => item.category.toString() === category)

  if (savingsCat.length === 0) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Invalid Transaction",
  });

  if (savingsCat[0].amount < amount) return res.status(StatusCodes.NOT_ACCEPTABLE).json({
    status: "failed",
    error: "You have Insufficient funds in the requested category",
  });


  //generate reference id
  let refID = generateUniqueId({
    length: 15,
    useLetters: false
  });

  //make sure the witdrawal reference id is unique
  let id_check = await SavingsWithdrawal.findOne({ reference: refID }).exec();
  while (id_check !== null) {
    refID = generateUniqueId({
      length: 15,
      useLetters: false
    });

    id_check = await SavingsWithdrawal.findOne({ reference: refID }).exec();
  }
  let newWithdrawal = new SavingsWithdrawal({
    _id: new mongoose.Types.ObjectId(),
    amount,
    category,
    user: req.user._id,
    reference: refID
  })

  const transaction = new Transaction({
    _id: new mongoose.Types.ObjectId(),
    user: req.user._id,
    type: 'withdrawal',
    amount: amount,
    payment_method: 'paystack',
    item: newWithdrawal._id,
    checkModel: "SavingsWithdrawal"
  })
  await newWithdrawal.save()
  await transaction.save();

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Your withdrawal request was successful and awaiting admin approval.'
  });
}

exports.loan_request = async (req, res) => {

  const { amount, repaymentMethod, repaymentPeriod } = req.body;

  // If d user has a pending or unrepaid loan he cant apply for another
  const hasLoan = await Loan.find({
    $or: [
      { status: 'Pending' },
      { repaymentStatus: { $in: ['Ongoing', 'Failed'] } }
    ]
  }).exec()
  if (hasLoan.length > 0) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Sorry you are not eligible for another loan. You either have a pending or an unpaid loan.",
  });

  // Get user wallet
  const myWallet = await SavingsWallet.findOne({ user: req.user })
    .populate("user", "-password")
    .exec()

  if (!myWallet) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Please add funds to your savings account to be eligible for loans.",
  });

  // Check if the user has been a member for less than 2 months
  const createdAtDate = new Date(myWallet.user.createdAt);
  const currentDate = new Date();

  // Calculate the difference in milliseconds between the current date and createdAt date
  const timeDiff = currentDate.getTime() - createdAtDate.getTime();
  // Convert the time difference to months
  const monthsDiff = timeDiff / (1000 * 60 * 60 * 24 * 30); // Assuming 30 days per month

  // Check if the difference is less than two months
  const isLessThanTwoMonths = monthsDiff < 2;

  if (isLessThanTwoMonths) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Transaction Failed. Your account is not eligible for loan yet.",
  });

  // Farmer loan is 3x savings
  // Non-Farmer loan is 5x savings
  const totalSavings = myWallet.categories.reduce((total, category) => total + category.amount, 0);
  if (myWallet.user.membershipType === "Farmer" && amount > totalSavings * 3) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "Transaction Failed. Loan amount cannot be more than 3 times your savings.",
    });
  } else if (amount > totalSavings * 5) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "failed",
      error: "Transaction Failed. Loan amount cannot be more than 5 times your savings.",
    });
  }

  //generate reference id
  let refID = generateUniqueId({
    length: 15,
    useLetters: false
  });

  //make sure the savings reference id is unique
  let id_check = await Loan.findOne({ reference: refID }).exec();
  while (id_check !== null) {
    refID = generateUniqueId({
      length: 15,
      useLetters: false
    });

    id_check = await Loan.findOne({ reference: refID }).exec();
  }

  const newLoan = new Loan({
    _id: new mongoose.Types.ObjectId(),
    user: req.user._id,
    amount,
    repaymentMethod,
    repaymentPeriod,
    reference: refID

  })

  const transaction = new Transaction({
    _id: new mongoose.Types.ObjectId(),
    user: req.user._id,
    type: 'loan',
    amount: amount,
    payment_method: 'paystack',
    item: newLoan._id,
    checkModel: "Loan"
  })

  // if re-payment type is card
  // Check for card validity
  if (repaymentMethod === "Card") {
    const findCard = await UserCard.findOne({ user: req.user._id })
    if (!findCard) {
      await newLoan.save()
      await transaction.save();
      return res.status(StatusCodes.PERMANENT_REDIRECT).json({
        status: 'success',
        message: 'To complete your Loan request please enter a valid Debit card.'
      });
    }

    // Check if Card is Valid for Loan period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    if (!findCard.authorization.reusable || findCard.authorization.exp_year < currentYear + 1) {
      await newLoan.save()
      await transaction.save();
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'success',
        message: 'Your Card Does not meet the minimum required criteria please try another card.'
      });
    }
    newLoan.cardIsValid = true;

  }

  await newLoan.save()
  await transaction.save();
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Your Loan request was successful and awaiting admin approval.'
  });
}

exports.validate_user_card = async (req, res) => {

  // If d user has an unrepaid loan he cant update his card.
  // He can only update card for pending loans.
  const hasLoan = await Loan.find({ status: 'Pending', }).exec()
  if (hasLoan.length < 1) return res.status(StatusCodes.UNAUTHORIZED).json({
    status: "failed",
    error: "Sorry you are not authorized to carry out this action.",
  });

  const { _id, firstname, surname, email } = req.user
  const amount = 50
  let name = `${firstname} ${surname}`


  // Check if this is the first savings
  // First savings cannot be less dan ₦5000
  const isFirstSavings = await Savings.find({ user: _id }).exec()
  if (isFirstSavings.length < 1 && amount < 5000) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Your first saving cannot be less than ₦5000.',
  });

  //generate reference id
  let refID = generateUniqueId({
    length: 15,
    useLetters: false
  });

  //make sure the savings reference id is unique
  let id_check = await Savings.findOne({ reference: refID }).exec();
  while (id_check !== null) {
    refID = generateUniqueId({
      length: 15,
      useLetters: false
    });

    id_check = await Savings.findOne({ reference: refID }).exec();
  }
  const savingsCategory = await SavingsCategory.findOne({ name: "Regular" }).exec()
  const savings = new Savings({
    _id: new mongoose.Types.ObjectId(),
    user: _id,
    amount,
    category: savingsCategory._id,
    reference: refID
  })

  const { data } = await initiatePaystackCardValidation(amount, email, name, savings._id);

  // If Paystack doesn't initiate payment stop the payment
  if (!data) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Operation Failed',
  });
  await savings.save();

  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Operation successful',
    data

  })
}

