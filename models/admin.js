const jwt = require("jsonwebtoken");
const Joi = require("joi");
const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
    surname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 250
    },
    firstname: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 250
    },
    email: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        unique: true
    },
    gender: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 20,
    },
    location: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        unique: true
    },
    lga: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255,
        unique: true
    },
    address: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 500,
    },
    password: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 1024
    },
    phone: {
        type: String,
        required: true
    },
    isoCode: {
        type: String,
        required: true
    },
    photo: {
        type: String,
        default: "https://res.cloudinary.com/jossyjoe/image/upload/v1606258324/UserIcon_tmu1v6.jpg"
    },

    adminType: {
        type: String,
        required: true,
        enum: ["Super-Admin", "Admin"]
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    resetPassword: { type: Boolean, default: false },
    resendOTP: {
        resend: {

            type: Boolean, default: false
        },
        numberSent: {
            type: Number
        },
        lastSent: {
            type: Date,
        }
    }
},
    {
        timestamps: true,
    });

adminSchema.methods.generateAdminToken = function () {
    const token = jwt.sign(
        {
            _id: this._id,
            firstname: this.firstname,
            surname: this.surname,
            email: this.email,
            phone: this.phone

        },
        process.env.JWT,
        {
            expiresIn: "1d",
        }
    );
    return token;
};

const Admin = mongoose.model("Admin", adminSchema);

function validateAdmin(admin) {

    const schema = Joi.object({
        firstname: Joi.string()
            .min(2)
            .max(250)
            .required(),
        surname: Joi.string()
            .min(2)
            .max(250)
            .required(),
        phone: Joi.string()
            .pattern(new RegExp(/[1-9]\d{1,14}$/))
            .message('Please enter a valid phone number in international format')
            .required(),
        isoCode: Joi.string()
            .pattern(new RegExp(/^\+[1-9]\d{1,14}$/))
            .message('Please enter a valid iso-code')
            .required(),
        email: Joi.string()
            .min(5)
            .max(255)
            .required()
            .email(),
        gender: Joi.string()
            .min(3)
            .max(20)
            .required(),
        location: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
            .message('Please enter a valid State ID')
            .required(),
        lga: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
            .message('Please enter a valid LGA ID')
            .required(),
        password: Joi.string()
            .min(5)
            .max(255)
            .required(),
        membershipType: Joi.string()
            .min(5)
            .max(255)
            .required(),
        address: Joi.string()
            .min(5)
            .max(10)
            .required()

    })
    return schema.validate(admin);
}


exports.Admin = Admin;
exports.validateAdmin = validateAdmin;

