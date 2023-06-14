const SavingsCategory = require("../models/savingsCategory");
const StatusCodes = require("../utils/status-codes")
const { Admin } = require("../models/admin");
const { User } = require("../models/user");
const { Otp_VerifyAccount, Otp_ForgotPassword } = require("../utils/sendMail")
const _ = require("lodash");
const bcrypt = require("bcrypt");
const otpGenerator = require("otp-generator");
const OTP = require("../models/OTP");

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

    const result = await Otp_VerifyAccount(admin.email, admin.firstname, code)

    res
        .header("afcs-auth-token", token)
        .status(StatusCodes.OK).json({
            status: "success",
            message: `Enter the verification code sent to ${admin.email} in order to verify your account`,
            afcsToken: token

        });

}

exports.createSavingsCategory = async (req, res) => {
    const { name } = req.body;
    const savingsCategory = new SavingsCategory({
        name
    })
    await savingsCategory.save()

    res.status(StatusCodes.OK).json({ message: `Savings Category Added Successfully` })

}