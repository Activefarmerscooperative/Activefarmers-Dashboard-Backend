const mongoose = require('mongoose');
const SavingsCategory = require("../models/savingsCategory");
const StatusCodes = require("../utils/status-codes")
const { Admin } = require("../models/admin");
const { User } = require("../models/user");
const { BankDetails } = require("../models/accountDetails")
const { Otp_VerifyAccount, Otp_ForgotPassword } = require("../utils/sendMail")
const _ = require("lodash");
const bcrypt = require("bcrypt");
const otpGenerator = require("otp-generator");
const OTP = require("../models/OTP");
const { Loan } = require("../models/loan")
const SavingsWithdrawal = require("../models/savingsWithdrawal")
const SavingsWallet = require("../models/savingsWallet");
const TransferRecipient = require("../models/transfer")
const { verifyAccount, createTransferRecip, initiateTransfer } = require("../utils/paystack");
const session = require('mongoose').startSession;

// Cloudinary config
const cloudinary = require("../utils/cloudinary");
const Payout = require('../models/adminPayout');
const CronJob = require('../models/cronJob');
const AdminNotification = require('../models/adminNotification');

exports.getUser = async (req, res) => {
    const admin = await Admin.findById(req.user._id)
        .select("-password -isVerified -resetPassword -resendOTP")
        .populate("location", "_id name");
    res.status(StatusCodes.OK).json(admin);
}

exports.getNotifications = async (req, res) => {
    const notifications = await AdminNotification.find().sort({ createdAt: -1 }).populate("user", "firstname surname")
    res.status(StatusCodes.OK).json(notifications);
}

exports.registerAdmin = async (req, res) => {

    let admin = await Admin.findOne({ email: req.body.email });

    if (admin && admin.isVerified) return res.status(StatusCodes.BAD_REQUEST).send("Admin with this email is already registered.");;
    if (!admin) {

        admin = new Admin(_.pick(req.body, ["surname", "firstname", "email", "phone", "isoCode", "gender", "location", "lga", "address", "password",]));
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
        admin = await admin.save();
    }


    res.status(StatusCodes.OK).json({
        status: "success",

    });
}

exports.confirmAdminAFCSToken = async (req, res) => {
    const admin = req.user

    if (admin.adminType !== "Super-Admin" && admin.adminType !== "Admin") {
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Un-Authorized" });
    }
    return res.status(StatusCodes.OK).json({
        status: 'success',
        admin: req.user
    });
}

exports.verify_token = async (req, res) => {
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

    await Admin.findByIdAndUpdate(otp.user._id, {
        isVerified: true
    }, {
        new: true
    })
    return res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'OTP verified, You account has been verified.'
    });
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

exports.loginAdmin = async (req, res) => {
    let admin = await Admin.findOne({ email: req.body.email });
    if (!admin) return res.status(400).json({ error: 'Invalid Credentials.' });

    if (!admin.isVerified) return res.status(400).json({ error: 'Please contact AFCS admin to verify your account.' });

    const validPassword = await bcrypt.compare(req.body.password, admin.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = admin.generateAuthToken();

    res.status(StatusCodes.OK).json({
        status: "Success",
        message: "Admin Login Successfull",
        token,
    }

    );

}

exports.forgot_password = async (req, res) => {

    const { email } = req.body;

    const admin = await Admin.findOne({ email, });

    if (admin) {
        const code = otpGenerator.generate(6, {
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });

        const otp = new OTP({
            _id: mongoose.Types.ObjectId(),
            user: admin._id,
            checkModel: "Admin",
            code: code,
            type: "ForgotPassword",
            created_at: new Date(),
        });

        await otp.save();

        await Otp_ForgotPassword(admin.email, code);

        // Generate admin token that must be sent with the verification OTP
        const token = admin.generateAuthToken();
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

    await Admin.findByIdAndUpdate(otp.user._id, {
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
    // Only admins with valid OTP can reset password. hence resetPassword=true
    let admin = await Admin.findOne({ email: req.user.email, resetPassword: true }).exec();

    // This user is not on the app
    if (!admin) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: "failed",
            error: "Invalid credentials",
        });
    }
    // hash the password
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);

    admin.password = hashed_password;
    admin.resetPassword = false;

    await admin.save();
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

    const admin = await Admin.findOne({ email: req.user.email });

    if (!admin) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: "failed",
            error: "Admin not Found on Active Farmers Cooperative Service",
        });
    }
    //**** */   check if old password matches the password in DB
    let password_match = await bcrypt.compare(
        oldPassword,
        admin.password
    );
    if (!password_match) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: "failed",
            error: "Old password is Incorrect",
        });
    }
    //**** */   admin can't use former password
    password_match = await bcrypt.compare(
        password,
        admin.password
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

    // await adminModel.findOneAndUpdate(filter, update);
    admin.password = hashed_password
    await admin.save()
    return res.status(StatusCodes.OK).json({
        status: "success",
        message: "Password Successfully Updated",
    });
}

exports.update_profile = async (req, res) => {
    await Admin.findByIdAndUpdate(req.user._id, {
        $set: {
            surname: req.body.surname,
            firstname: req.body.firstname,
            phone: req.body.phone,
            gender: req.body.gender,
            address: req.body.address

        }
    }, { new: true })


    return res.status(StatusCodes.OK).json({
        status: "success",
        message: "User details updated successfully.",

    });
}

// Update user Profile Photo
exports.update_admin_profile_pic = async (req, res) => {

    const result = await cloudinary.uploader.upload(req.file.path);
    const updatedUser = await Admin.findByIdAndUpdate(req.user._id, {
        $set: { photo: result.secure_url }
    }, { new: true })

    res.status(200).json({ message: "Profile Pic updated Successfully", profilePic: updatedUser.photo })

}

exports.confirmAFCSToken = async (req, res) => {
    return res.status(StatusCodes.OK).json({
        status: 'success',
        user: req.user
    });
}

exports.getMembers = async (req, res) => {
    const users = await User.find({ isVerified: true })
        .select("-password -isVerified -resetPassword -resendOTP")
        .populate("location", "_id name")
        .sort({ createdAt: -1 })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.getUnverifiedMembers = async (req, res) => {
    const users = await User.find({ isVerified: false })
        .select("-password -resetPassword -resendOTP")
        .populate("location", "_id name")
        // .sort({ createdAt: -1 })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.verifyUnverifiedMember = async (req, res) => {
    const { id } = req.params
    const { action } = req.query

    if (action !== "approved") {
        const user = await User.findByIdAndUpdate(id, {
            $set: {
                regCompletePercent: 50,
                isVerified: false,
                verifiedBy: `${req.user.surname} ${req.user.firstname}`
            }
        }, { new: true })

        return res.status(StatusCodes.OK).json({ message: 'User Rejection Successful!' })
    }

    const user = await User.findByIdAndUpdate(id, {
        $set: {
            regCompletePercent: 50,
            isVerified: true,
            verifiedBy: `${req.user.surname} ${req.user.firstname}`
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

    const notifyAdmin = new AdminNotification({
        user: user._id,
        type: "Registration"
    })

    await notifyAdmin.save()
    return res.status(StatusCodes.OK).json({ message: 'User Verification successful!' })
}

exports.getMembersCount = async (req, res) => {
    const users = await User.countDocuments({ isVerified: true })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.getMembersSavings = async (req, res) => {

    const userWallets = await SavingsWallet.findOne({ user: req.params.id })
        .exec()

    const totalSaving = userWallets.categories.reduce((total, category) => total + category.amount, 0);
    res.status(StatusCodes.OK).json(totalSaving);
}
exports.getMembersLoan = async (req, res) => {

    const userLoan = await Loan.findOne({ user: req.params.id, repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .exec()

    return res.status(StatusCodes.OK).json(!userLoan ? 0 : userLoan.amount);

}
exports.getTotalSavings = async (req, res) => {
    // Get user wallet
    const userWallets = await SavingsWallet.find()
        .exec()
    let totalSavings = 0;
    for (let i = 0; i < userWallets.length; i++) {
        const totalSaving = userWallets[i].categories.reduce((total, category) => total + category.amount, 0);

        totalSavings += totalSaving

    }

    res.status(StatusCodes.OK).json(totalSavings)
}

// exports.getTotalSavings = async (req, res) => {
//     // Get user wallet
//     const userWallets = await SavingsWallet.find()
//         .exec()
//     let totalSavings = 0;
//     for (let i = 0; i < userWallets.length; i++) {
//         const totalSaving = userWallets[i].categories.reduce((total, category) => total + category.amount, 0);

//         totalSavings += totalSaving

//     }

//     res.status(StatusCodes.OK).json(totalSavings)
// }

exports.getTotalLoans = async (req, res) => {
    // Get user wallet
    const userLoans = await Loan.find({ repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .exec()

    const loanAmounts = userLoans.map(loan => loan.amount);
    const totalRepaymentAmount = userLoans.reduce((acc, loan) => {
        const repaymentAmount = loan.repayment.reduce((total, { amount }) => total + amount, 0);
        return acc + repaymentAmount;
    }, 0);

    const remainingAmounts = loanAmounts.map(amount => amount - totalRepaymentAmount);

    const reducedRemainingAmount = remainingAmounts.reduce((acc, amount) => acc + amount, 0);


    res.status(StatusCodes.OK).json(reducedRemainingAmount)
}

exports.getBorrowers = async (req, res) => {
    const users = await Loan.find({ repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .populate("user", "-password -isVerified -resetPassword -resendOTP location")
        .populate({
            path: 'user',
            model: 'User',
            populate:
            {
                path: 'location',
                model: 'State',
            },

        })
        .sort({ createdAt: -1 })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.getBorrowersCount = async (req, res) => {
    const users = await Loan.countDocuments({ repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .exec();
    res.status(StatusCodes.OK).json(users);
}
exports.getLoanRequest = async (req, res) => {
    let users = await Loan.find({ status: 'Pending' })
        // .populate("user", "-password -isVerified -resetPassword -resendOTP")
        .populate({
            path: 'user',
            model: 'User',
            select: "-password -isVerified -resetPassword -resendOTP",
            populate:
            {
                path: 'location',
                model: 'State',
            },

        })
        .sort({ createdAt: -1 })
        .exec();

    for (let i = 0; i < users.length; i++) {
        const userWallets = await SavingsWallet.findOne({ user: users[i].user._id })
            .exec()
        const totalSaving = userWallets.categories.reduce((total, category) => total + category.amount, 0);

        users[i].savings = totalSaving

    }


    res.status(StatusCodes.OK).json(users);
}

exports.getWithdrawalRequest = async (req, res) => {
    const users = await SavingsWithdrawal.find({ status: 'Pending' })
        // .populate("user", "-password -isVerified -resetPassword -resendOTP")
        .populate({
            path: 'user',
            model: 'User',
            select: "-password -isVerified -resetPassword -resendOTP",
            populate:
            {
                path: 'location',
                model: 'State',
            },

        })
        .sort({ createdAt: -1 })
        .exec();

    for (let i = 0; i < users.length; i++) {
        const userWallets = await SavingsWallet.findOne({ user: users[i].user?._id })
            .exec()
        const totalSaving = userWallets.categories.reduce((total, category) => total + category.amount, 0);

        users[i].savings = totalSaving

    }
    res.status(StatusCodes.OK).json(users);
}

exports.getUserWallet = async (req, res) => {
    // Get user wallet
    const userWallet = await SavingsWallet.findOne({ user: req.params.id })
        .populate("user", "-password")
        .exec()

    if (!userWallet) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "No wallet for this user.",
    });
    const totalSavings = userWallet.categories.reduce((total, category) => total + category.amount, 0);

    res.status(StatusCodes.OK).json({ message: `Success`, totalSavings })
}

exports.getUserLoan = async (req, res) => {
    // Get user wallet
    const userLoan = await Loan.findOne({ user: req.params.id, repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .exec()

    res.status(StatusCodes.OK).json({ message: `Success`, userLoan })
}

exports.getUserLoanHistory = async (req, res) => {
    // Get user wallet
    const userLoans = await Loan.find({ user: req.params.id })
        .sort({ createdAt: -1 })
        .exec()

    res.status(StatusCodes.OK).json({ message: `Success`, userLoans })
}

exports.getUserWithdrawalHistory = async (req, res) => {
    // Get user wallet
    const userWithdrawals = await SavingsWithdrawal.find({ user: req.params.id })
        .sort({ createdAt: -1 })
        .exec()

    res.status(StatusCodes.OK).json({ message: `Success`, userWithdrawals })
}

exports.handleLoanRejection = async (req, res) => {
    const { rejectionReason } = req.body
    if (!rejectionReason) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Please give a reason for rejecting this apllication.",
    });
    //Loan request was declined
    const loan = await Loan.findByIdAndUpdate(req.params.id, {
        $set: {
            status: "Rejected",
            adminActionBy: req.user._id,
            repaymentStatus:"Canceled",
            rejectionReason: rejectionReason
        }
    }, {
        new: true
    })

    if (!loan) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Loan not found.",
    });

    res.status(StatusCodes.OK).json({ message: `Loan rejected Successfully` })

}

exports.handleLoanApproval = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const loan = await Loan.findById(req.params.id)

        if (!loan) return res.status(StatusCodes.BAD_REQUEST).json({
            status: "failed",
            error: "Loan not found.",
        });

        if (loan.status === "Confirmed") return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: "Loan already approved.",
        });

        const userBankDetails = await BankDetails.findOne({ user: loan.user })
        if (!userBankDetails) return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: "Cannot complete transaction. No user bank account details found.",
        });

        const { data } = await createTransferRecip(userBankDetails.accountName, userBankDetails.accountNumber, userBankDetails.bankCode)

        const transferRecipient = new TransferRecipient({
            _id: new mongoose.Types.ObjectId(),
            user: loan.user,
            transferRecipient: data,
            type: "Loan",
            item: loan._id,
            checkModel: "Loan"
        })

        loan.adminActionBy = req.user._id
        loan.status = "In Progress"

        const response = await initiateTransfer(loan.amount, data.recipient_code, loan._id, "Loan")

        if (response.status === false) {
            return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
                status: "failed",
                error: response.message,
            });
        }

        if (response.data.status !== "success") {
            return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
                status: "failed",
                error: "Cannot complete transaction. Something went wrong.",
            });
        }
        // loan.paymentStatus = response.
        transferRecipient.transferData = response.data

        // initiate admin payout here.
        const payout = new Payout({
            type: "Loan",
            reference: transferRecipient._id,
            amount: loan.amount,
            admin: req.user._id,
            payment_method: "Cash Transfer",
            item: loan._id,
            checkModel: "Loan"
        })

        await transferRecipient.save({ session })
        await loan.save({ session })
        await payout.save({ session })
        // await Promise.all([transferRecipient.save({ session }), loan.save({ session }), payout.save()]);

        await session.commitTransaction();
        session.endSession();
        res.status(StatusCodes.OK).json({ message: 'Loan approval successful.', response });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
    }
}

exports.handleWithdrawalRejection = async (req, res) => {
    const { rejectionReason } = req.body
    if (!rejectionReason) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Please give a reason for rejecting this apllication.",
    });
    //Loan request was declined
    const withdrawal = await SavingsWithdrawal.findByIdAndUpdate(req.params.id, {
        $set: {
            status: "Rejected",
            repaymentStatus: "Canceled",
            adminActionBy: req.user._id,
            rejectionReason
        }
    }, {
        new: true
    })

    if (!withdrawal) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Withdrawal request not found.",
    });

    res.status(StatusCodes.OK).json({ message: `Withdrawal rejected Successfully` })

}

exports.handleWithdrawalApproval = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    //Loan request was declined
    const withdrawal = await SavingsWithdrawal.findById(req.params.id)

    if (!withdrawal) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Withdrawal request not found.",
    });

    const hasLoan = await Loan.findOne({
        user: withdrawal.user,
        status: "Confirmed",
        repaymentStatus: { $ne: "Completed" }
    });

    if (hasLoan) {
        return res.status(StatusCodes.BAD_REQUEST).send("User has pending loan to clear.");
    }

    // Get user wallet
    const userWallet = await SavingsWallet.findOne({ user: withdrawal.user }).exec()
    if (!userWallet) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Invalid Action, user has no savings account",
    });

    //cant withdraw from a category that does not exist.
    const savingsCat = userWallet.categories.filter(item => item.category.toString() === withdrawal.category)

    if (savingsCat.length === 0) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Invalid Transaction. User has no savings in the requested category.",
    });

    if (savingsCat[0].amount < withdrawal.amount) return res.status(StatusCodes.NOT_ACCEPTABLE).json({
        status: "failed",
        error: "User have Insufficient funds in the requested category.",
    });

    const userBankDetails = await BankDetails.findOne({ user: withdrawal.user })
    if (!userBankDetails) return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        status: "failed",
        error: "Cannot complete transaction. No user bank account details found.",
    });

    const { data } = await createTransferRecip(userBankDetails.accountName, userBankDetails.accountNumber, userBankDetails.bankCode)

    const transferRecipient = new TransferRecipient({
        _id: new mongoose.Types.ObjectId(),
        user: withdrawal.user,
        transferRecipient: data,
        type: "SavingsWithdrawal",
        item: withdrawal._id,
        checkModel: "SavingsWithdrawal"
    })

    withdrawal.adminActionBy = req.user._id
    withdrawal.status = "In Progress"

    const response = await initiateTransfer(withdrawal.amount, data.recipient_code, withdrawal._id, "Withdrawal")
    console.log(response)
    if (response.status === false) {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: response.message,
        });
    }

    if (response.data.status !== "success" && response.data.status !== "pending") {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: "Cannot complete transaction. Something went wrong.",
        });
    }
    // loan.paymentStatus = response.
    transferRecipient.transferData = response.data

    // initiate admin payout here.
    const payout = new Payout({
        type: "SavingsWithdrawal",
        amount: withdrawal.amount,
        reference: transferRecipient._id,
        admin: req.user._id,
        payment_method: "Cash Transfer",
        item: withdrawal._id,
        checkModel: "SavingsWithdrawal"
    })

    // Deduct withdrawal amount from user wallet
    userWallet.categories.map(item => {
        if (item.category === withdrawal.category) {
            item.amount -= withdrawal.amount
            return item
        } else {
            return item
        }
    })

    await Promise.all([
        userWallet.save(),
        transferRecipient.save(),
        withdrawal.save(),
        payout.save()
    ]);

    return res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Withdrawal Request approved successfully.',
    });
}

exports.transferRequests = async (req, res) => {
    const requests = await TransferRecipient.find({ status: "Pending" })
    res.status(StatusCodes.OK).json({ message: `Successful`, requests })
}

const handlePaymentTransfer = async (user, transferType, item) => {
    const userBankDetails = await BankDetails.findOne({ user })
    if (!userBankDetails) return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        status: "failed",
        error: "Cannot complete transaction. No user bank account details found.",
    });

    const { data } = await createTransferRecip(userBankDetails.accountName, userBankDetails.accountNumber, userBankDetails.bankCode)

    const transferRecipient = new TransferRecipient({
        user,
        transferRecipient: data,
        type: transferType,
        item: item._id,
        checkModel: transferType
    })

    const response = await initiateTransfer(item.amount, data.recipient_code, item._id, transferType)

    if (response.status === false) {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: response.message,
        });
    }

    if (response.data.status !== "success") {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: "failed",
            error: "Cannot complete transaction. Something went wrong.",
        });
    }
    // loan.paymentStatus = response.
    transferRecipient.transferData = response.data
    return transferRecipient
}

exports.createSavingsCategory = async (req, res) => {
    const { name } = req.body;
    const savingsCategory = new SavingsCategory({
        name
    })
    await savingsCategory.save()

    res.status(StatusCodes.OK).json({ message: `Savings Category Added Successfully` })

}

exports.cronJobs = async (req, res) => {
    const results = await CronJob.find()
        .sort({ createdAt: -1 })
        .populate("user", "firstname surname phone")
        .exec()

    res.status(StatusCodes.OK).json({ status: "success", results })

}