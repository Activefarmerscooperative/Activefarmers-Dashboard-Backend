const mongoose = require("mongoose");
const { User } = require("../models/user");
const SavingsCategory = require("../models/savingsCategory");
const Savings = require("../models/savings");
const UserCard = require("../models/cardDetails");
const SavingsWallet = require("../models/savingsWallet");
const SavingsWithdrawal = require("../models/savingsWithdrawal")
const { Loan } = require("../models/loan")
const { BankDetails } = require("../models/accountDetails");
const Transaction = require("../models/transaction");
const StatusCodes = require("../utils/status-codes")
const { Otp_VerifyAccount, Otp_ForgotPassword } = require("../utils/sendMail")
const _ = require("lodash");
const bcrypt = require("bcrypt");
const otpGenerator = require("otp-generator");
const OTP = require("../models/OTP");
var request = require('request');
const generateUniqueId = require('generate-unique-id');
const { initiatePaystackPayment, validatePaystackPayment, charge_authorization, bankList, initiatePaystackCardValidation, verifyAccount } = require("../utils/paystack");
const { Register_OTP, Veriify_OTP } = require("../utils/sendSMS")
const { Card_Is_Valid } = require("../utils/checkValidCard")
// Cloudinary config
const cloudinary = require("../utils/cloudinary");

exports.getUser = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password -isVerified -resetPassword -resendOTP")
    .populate("location", "_id name");
  res.status(StatusCodes.OK).json(user);
}

exports.getTransactions = async (req, res) => {
  let transactions;
  if (req.query.type === "All") {
    transactions = await Transaction.find({ user: req.user._id })
      .populate("item")
      .sort({ createdAt: -1 })
      .exec();
  } else {
    transactions = await Transaction.find({ user: req.user._id })
      .populate("item")
      .limit(10)
      .sort({ createdAt: -1 })
      .exec();
  }

  res.status(StatusCodes.OK).json(transactions);
}

exports.registerUser = async (req, res) => {

  let user = await User.findOne({
    $or: [
      { email: req.body.email },
      { phone: req.body.phone }
    ]
  });

  if (user && user.isVerified) return res.status(StatusCodes.BAD_REQUEST).send("User with this email or Phone number is already registered.");;
  if (!user) {
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
  }

  const token = user.generateAuthToken();

  const result = await Register_OTP(user.phone)


  res
    .header("afcs-auth-token", token)
    .status(StatusCodes.OK).json({
      status: "success",
      message: `Enter the verification code sent to ${user.phone} in order to verify your account`,
      pinId: result?.pinId || null,
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

  const { token, pinId } = req.body
  if (!token || !pinId) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ error: `please enter the token sent to ${req.user.phone}` })
  }

  const result = await Veriify_OTP(token, pinId)

  if (result?.verified === true) {
    const user = await User.findByIdAndUpdate(req.user._id, {
      $set: {
        regCompletePercent: 50,
        isVerified: true
      }
    }, { new: true })

    // Create a savings wallet for the user.
    const savingsCategories = await SavingsCategory.find().exec()
    let categories = [];
    for (let i = 0; i < savingsCategories.length; i++) {
      categories.push({
        category: savingsCategories[i].name,
        amount: 0,
      })
    }

    const userSavingsWallet = new SavingsWallet({
      _id: new mongoose.Types.ObjectId(),
      user: user._id,
      categories
    })
    await userSavingsWallet.save()
    return res.status(StatusCodes.OK).json({ message: 'User Registered successfully' })
  } else if (result?.verified === "Expired") {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: "token Expired." });
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
  let user = await User.findOne({ phone: req.body.phone });
  if (!user) return res.status(400).json({ error: 'Invalid Credentials.' });

  if (!user.isVerified) return res.status(400).json({ error: 'Please contact AFCS admin to verify your account.' });

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

  const token = user.generateAuthToken();

  res.status(StatusCodes.OK).json({
    status: "Success",
    message: "User Login Successfull",
    token,
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

exports.personal_details = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      surname: req.body.surname,
      firstname: req.body.firstname,
      email: req.body.email,
      gender: req.body.gender,
      DOB: req.body.DOB,
      location: req.body.location,
      address: req.body.address

    }
  }, { new: true })

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "User details updated successfully.",

  });
}

exports.farm_details = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      status: "error",
      message: "User not found.",
    });
  }

  const updateFields = {
    "farm.farmingExperience": req.body.farmingExperience,
    "farm.farmSize": req.body.farmSize,
    "farm.cropTypes": req.body.cropTypes,
    "farm.farmAddress": req.body.farmAddress,
  };

  if (user.regCompletePercent < 100 && !user.farm?.farmingExperience) {
    updateFields.regCompletePercent = user.regCompletePercent + 10;
  }

  user.set(updateFields);
  const token = user.generateAuthToken();

  const updatedUser = await user.save();

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Farm details updated successfully.",
    user: updatedUser,
    token,
  });
};
exports.guarantor_details = async (req, res) => {
  const hasLoan = await Loan.findOne({
    user: req.user,
    repaymentStatus: { $ne: "Completed" }
  });

  if (hasLoan) {
    return res.status(StatusCodes.BAD_REQUEST).send("Unauthorized Action. Please clear up your pending loan before you can update your guarantor info.");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      status: "error",
      message: "User not found.",
    });
  }

  const updateFields = {
    "guarantor.full_name": req.body.full_name,
    "guarantor.address": req.body.address,
    "guarantor.email": req.body.email,
    "guarantor.phone": req.body.phone,
    "guarantor.gender": req.body.gender,
    "guarantor.occupation": req.body.occupation,
  };

  if (user.regCompletePercent < 100 && !user.guarantor?.full_name) {
    if (user.membershipType !== "Farmer") {
      updateFields.regCompletePercent = user.regCompletePercent + 20;
    } else {
      updateFields.regCompletePercent = user.regCompletePercent + 10;
    }

  }

  user.set(updateFields);
  const token = user.generateAuthToken();

  const updatedUser = await user.save();

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Guarantor details updated successfully.",
    user: updatedUser,
    token,
  });
};

exports.occupation_details = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      status: "error",
      message: "User not found.",
    });
  }

  const updateFields = {
    occupation: req.body,
  };

  if (user.regCompletePercent < 100 && !user.occupation?.occupation) {
    updateFields.regCompletePercent = user.regCompletePercent + 10;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true });
  const token = updatedUser.generateAuthToken();
  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "User details updated successfully.",
    user: updatedUser,
    token
  });
};

exports.nextOfKin_details = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      status: "error",
      message: "User not found.",
    });
  }

  const updateFields = {
    nextOfKin: req.body,
  };

  if (user.regCompletePercent < 100 && !user.nextOfKin?.full_name) {
    updateFields.regCompletePercent = user.regCompletePercent + 10;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true });
  const token = updatedUser.generateAuthToken();
  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Next of Kin details updated successfully.",
    user: updatedUser,
    token
  });
};


exports.bank_details = async (req, res) => {
  const { accountNumber, bankCode, bankName, accountType } = req.body;

  // Verify bank account number
  const result = await verifyAccount(accountNumber, bankCode);

  // Invalid account number
  if (!result.status) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      status: "failed",
      error: result.message,
    });
  }

  const bankDetails = {
    user: req.user._id,
    accountNumber,
    bankCode,
    accountName: result.data.account_name,
    bankName,
    accountType,
  };
  const hasAccountPromise = BankDetails.findOne({ user: req.user._id });
  const userPromise = User.findById(req.user._id);

  let [hasAccount, user] = await Promise.all([hasAccountPromise, userPromise]);

  const updateFields = {}

  if (user.regCompletePercent < 100 && !hasAccount) {
    updateFields.regCompletePercent = user.regCompletePercent + 10;
  }
  const userUpdate = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true });
  await BankDetails.findOneAndUpdate(
    {
      user: req.user._id
    },
    bankDetails,
    { new: true, upsert: true }
  );

  const token = userUpdate.generateAuthToken();

  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Bank details verified and updated successfully.",
    token
  });
};

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
      checkModel: "User",
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
        token
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
  const token = updatedUser.generateAuthToken();
  res.status(200).json({ message: "Profile Pic updated Successfully", profilePic: updatedUser.photo, token })

}

exports.get_savings_category = async (req, res) => {

  const savingsCategory = await SavingsCategory.find().exec()
  res.status(StatusCodes.OK).json({ message: "Success", savingsCategory })
}

exports.get_my_savings_wallet = async (req, res) => {

  const savingsWallet = await SavingsWallet.findOne({
    user: req.user._id
  })
    .exec()
  res.status(StatusCodes.OK).json({ message: "Success", savingsWallet })
}

exports.add_savings = async (req, res) => {
  const { _id, firstname, surname, email } = req.user
  const { amount, category, newCategory } = req.body

  const capitalizeFirstLetter = string => `${string.charAt(0).toUpperCase()}${string.slice(1)}`;


  let name = `${firstname} ${surname}`

  // Check if this is the first savings
  // First savings cannot be less dan ₦5000
  const isFirstSavings = await Savings.find({ user: _id, status: "Confirmed" }).exec()
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
    category: newCategory ? capitalizeFirstLetter(newCategory) : category,
    reference: refID
  })
  // Add new Savings category
  if (newCategory) {
    //Make first letter of newCategory uppercase
    let addCategory = capitalizeFirstLetter(newCategory)
    const savingsWallet = await SavingsWallet.findOne({ user: req.user._id }).exec()
    const categoryExist = savingsWallet.categories.filter(item => item.category === addCategory)

    // If this category name already exist return error
    if (categoryExist.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'failed',
        message: `Saving category name "${addCategory}" already exist.`,
      });
    } else {
      //Category name does not exist create it.
      savingsWallet.categories.push({
        category: addCategory,
        amount: 0,
      })
      await savingsWallet.save()
    }
  }

  const { data } = await initiatePaystackPayment(amount, email, name, savings._id);

  // If Paystack doesn't initiate payment stop the payment
  if (!data) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Operation Failed',
  });
  await savings.save();

  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Operation successful.',
    data

  })
}

exports.savings_withdrawal = async (req, res) => {
  const { amount, category } = req.body;

  const hasLoan = await Loan.findOne({
    user: req.user,
    repaymentStatus: { $ne: "Completed" }
  });

  if (hasLoan) {
    return res.status(StatusCodes.BAD_REQUEST).send("Unauthorized Action. Please clear up your pending loan before you can make withdrawals.");
  }

  // Get user wallet
  const myWallet = await SavingsWallet.findOne({ user: req.user }).exec()
  if (!myWallet) return res.status(StatusCodes.BAD_REQUEST).json({
    status: "failed",
    error: "Invalid Action",
  });

  //cant withdraw from a category that does not exist.
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
    user: req.user._id,
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
  const myWallet = await SavingsWallet.findOne({ user: req.user._id })
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
  const isLessThanTwoMonths = monthsDiff < 0;

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
    const cardIsValid = Card_Is_Valid(findCard)

    if (!findCard.authorization.reusable || !cardIsValid) {
      await newLoan.save()
      await transaction.save();
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'success',
        message: 'Your Saved Card Does not meet the minimum required criteria please try another card.'
      });
    }

    let last4 = findCard.authorization.last4,
      bank = findCard.authorization.bank,
      brand = findCard.authorization.brand

    // newLoan.cardIsValid = true;
    await newLoan.save()
    await transaction.save();
    return res.status(StatusCodes.TEMPORARY_REDIRECT).json({
      status: 'validate_card',
      message: `To complete your Loan request, please confirm validity of your ${bank} ${brand} card number **** **** ${last4}.`,
    });

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
  const hasLoan = await Loan.find({ user: req.user._id, status: 'Pending', }).exec()
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
    error: 'Your dont have sufficient savings. So you are not qualified for a Loan.',
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
    category: savingsCategory.name,
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

exports.validate_saved_card = async (req, res) => {

  const { _id } = req.user
  const amount = 50

  // Check if this is the first savings
  // First savings cannot be less dan ₦5000
  const isFirstSavings = await Savings.find({ user: _id }).exec()
  if (isFirstSavings.length < 1 && amount < 5000) return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Your first saving cannot be less than ₦5000.',
  });

  // fetch the User card
  const findCard = await UserCard.findOne({ user: req.user._id })
  if (!findCard) {
    return res.status(StatusCodes.PERMANENT_REDIRECT).json({
      status: 'success',
      message: 'To complete your Loan request please enter a valid Debit card.'
    });
  }

  // Charge the user Card
  let authorization_code = findCard.authorization.authorization_code
  let email = findCard.email

  const { data } = await charge_authorization(amount, email, authorization_code);

  // If Paystack doesn't initiate payment stop the payment
  if (!data || data.status !== "success") return res.status(StatusCodes.BAD_REQUEST).json({
    status: 'failed',
    message: 'Operation Failed',
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
    category: savingsCategory.name,
    reference: refID
  })

  // Add amount to user Regular savings wallet.
  let updateSavings = await SavingsWallet.findOne({ user: _id })

  updateSavings.categories.map(item => {
    if (item.category.toString() === savingsCategory._id.toString()) {

      item.amount += amount
      return item
    } else {
      return item
    }
  })

  // Create a transaction.
  const transaction = new Transaction({
    _id: new mongoose.Types.ObjectId(),
    type: 'savings',
    user: _id,
    amount: amount,
    payment_method: 'paystack',
    reference: data.reference,
    item: savings._id,
    checkModel: "Savings"
  })

  await transaction.save();
  await updateSavings.save();
  await savings.save()

  await Loan.findOneAndUpdate({ user: _id, status: "Pending" }, {
    $set: {
      cardIsValid: true
    }
  }, {
    new: true
  })

  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Operation successful',
  })
}

exports.cancel_loan_request = async (req, res) => {

  const hasLoan = await Loan.findOne({ status: 'Pending', }).exec()
  if (!hasLoan) return res.status(StatusCodes.UNAUTHORIZED).json({
    status: "failed",
    error: "Sorry you are not authorized to carry out this action.",
  });

  hasLoan.status = "Cancelled"
  await hasLoan.save()
  return res.status(StatusCodes.OK).json({
    status: "success",
    message: "Loan request cancelled successfully..",
  });

}

exports.my_loan = async (req, res) => {
  const hasLoan = await Loan.findOne({ user: req.user._id, status: 'Pending', }).exec()

  return res.status(StatusCodes.OK).json({
    status: "success",
    myLoan: hasLoan
  });

}
