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


exports.registerAdmin = async (req, res) => {

    let admin = await Admin.findOne({ email: req.body.email });

    if (admin && admin.isVerified) return res.status(StatusCodes.BAD_REQUEST).send("Admin with this email is already registered.");;
    if (!admin) {


        admin = new Admin(_.pick(req.body, ["surname", "firstname", "email", "phone", "isoCode", "gender", "location", "lga", "address", "password", "membershipType"]));
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
        admin = await admin.save();
    }

    const token = admin.generateAuthToken();
    const code = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
    });

    const otp = new OTP({
        user: admin._id,
        checkModel: "Admin",
        code: code,
        type: "RegisterAdmin",
        expiresIn: Date.now() + 3600000,
    });

    await otp.save();

    await Otp_VerifyAccount(admin.email, admin.firstname, code)

    res
        .header("afcs-auth-token", token)
        .status(StatusCodes.OK).json({
            status: "success",
            message: `Enter the verification code sent to ${admin.email} in order to verify your account`,
            afcsToken: token

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

exports.getBorrowers = async (req, res) => {
    const users = await Loan.find({ repaymentStatus: { $ne: 'Completed' }, status: 'Confirmed' })
        .populate("user", "-password -isVerified -resetPassword -resendOTP")
        .sort({ createdAt: -1 })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.getLoanRequest = async (req, res) => {
    const users = await Loan.find({ status: 'Pending' })
        .populate("user", "-password -isVerified -resetPassword -resendOTP")
        .sort({ createdAt: -1 })
        .exec();
    res.status(StatusCodes.OK).json(users);
}

exports.getWithdrawalRequest = async (req, res) => {
    const users = await SavingsWithdrawal.find({ status: 'Pending' })
        .populate("user", "-password -isVerified -resetPassword -resendOTP")
        .sort({ createdAt: -1 })
        .exec();
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
    const userLoans = await SavingsWithdrawal.find({ user: req.params.id })
        .sort({ createdAt: -1 })
        .exec()

    res.status(StatusCodes.OK).json({ message: `Success`, userLoans })
}

exports.handleLoanRejection = async (req, res) => {
    const { rejectionReason } = req.body
    if (!rejectionReason) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "Please give a reason for rejecting this apllication.",
    });
    //Loan request was declined
    const loan = await Loan.findByIdAndUpdate(rq.params.id, {
        $set: {
            status: "Rejected",
            adminActionBy: req.user._id,
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
            user: loan.user,
            transferRecipient: data,
            type: "Loan",
            item: loan._id,
            checkModel: "Loan"
        })

        loan.adminActionBy = req.user._id
        loan.status = "Confirmed"

        await Promise.all([transferRecipient.save({ session }), loan.save({ session })]);

        await session.commitTransaction();
        session.endSession();
        res.status(StatusCodes.OK).json({ message: 'Loan approval successful.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
    }
}

exports.transferRequests = async (req, res) => {
    const requests = await TransferRecipient.find({ status: "Pending" })
    res.status(StatusCodes.OK).json({ message: `Successful`, requests })
}

exports.handlePaymentTransfer = async (req, res) => {
    const transferRecipient = await TransferRecipient.findOne({ item: req.params.id, status: "Pending" })
        .populate("item")
        .exec()
    if (!transferRecipient) return res.status(StatusCodes.BAD_REQUEST).json({
        status: "failed",
        error: "No Pending transfer for this Loan found.",
    });

    const data = initiateTransfer(transferRecipient.item.amount,transferRecipient.transferRecipient.recipient_code,transferRecipient.item.reference,"Loan Disbursement")

    res.status(StatusCodes.OK).json({ message: `Transfer initiated successfully.`,data })
}

exports.createSavingsCategory = async (req, res) => {
    const { name } = req.body;
    const savingsCategory = new SavingsCategory({
        name
    })
    await savingsCategory.save()

    res.status(StatusCodes.OK).json({ message: `Savings Category Added Successfully` })

}