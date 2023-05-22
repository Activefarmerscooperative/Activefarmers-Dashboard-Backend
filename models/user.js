const jwt = require("jsonwebtoken");
const Joi = require("joi");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
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
    unique: true,
    match: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  },
  gender: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 20,
  },
  location: {
    type: mongoose.Schema.Types.ObjectId, required: true, ref: 'State'
  },
  lga: {
    type: mongoose.Schema.Types.ObjectId, required: false, ref: 'LGA',
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

  membershipType: {
    type: String,
    required: true,
    enum: ["Farmer", "Non-Farmer"]
  },
  farm: {
    farmingExperience: {
      type: Number,
      minlength: 0,
      maxlength: 150
    },
    farmSize: {
      type: Number,
    },
    cropTypes: {
      type: String,
      minlength: 2,
      maxlength: 1024
    },
    farmAddress: {
      type: String,
    }
  },
  guarantor: {
    full_name: {
      type: String,
      minlength: 2,
      maxlength: 150
    },
    address: {
      type: String,
    },
    email: {
      type: String,
      minlength: 5,
      maxlength: 1024
    },
    phone: {
      type: String,
    },
    gender: {
      type: String,
    },
    occupation: {
      type: String,
    }
  },
  occupation:{
    occupation: {
      type: String,
      minlength: 2,
      maxlength: 150
    },
    salary: {
      type: Number,
    },
    workLevel: {
      type: String,
      minlength: 5,
      maxlength: 1024
    },
    companyName: {
      type: String,
    },

  },
  nextOfKin: {
    full_name: {
      type: String,
      minlength: 2,
      maxlength: 150
    },
    address: {
      type: String,
    },
    email: {
      type: String,
      minlength: 5,
      maxlength: 1024
    },
    phone: {
      type: String,
    },
    relationship: {
      type: String,
    }
  },

  isVerified: {
    type: Boolean,
    default: false
  },
  regCompletePercent: {
    type: Number,
    default: 25,
    enum: [25, 50, 75, 100]//25% before verification, 50% after verification 75% after farm details and 100% after  Gaurantor.
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

userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
      firstname: this.firstname,
      surname: this.surname,
      email: this.email,
      phone: this.phone,
      membershipType:this.membershipType,
      image:this.photo,
      reference:this.reference

    },
    process.env.JWT,
    {
      expiresIn: "1d",
    }
  );
  return token;
};

const User = mongoose.model("User", userSchema);

function validateUser(user) {

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
      .email()
      .min(5)
      .max(255)
      .required(),
    gender: Joi.string()
      .min(3)
      .max(20)
      .required(),
    location: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .message('Please enter a valid State ID')
      .required(),
    lga: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .message('Please enter a valid LGA ID')
      .optional(),
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
      .max(255)
      .required()

  })
  return schema.validate(user);
}

function validateFarm(farm) {

  const schema = Joi.object({
    farmingExperience: Joi.number()
      .min(0)
      .max(150)
      .required(),
    farmSize: Joi.number()
      .min(1)
      .max(1000)
      .required(),
    cropTypes: Joi.string()
      .min(2)
      .max(1024)
      .required(),
    farmAddress: Joi.string()
      .min(2)
      .max(1024)
      .required(),

  })
  return schema.validate(farm);
}

function validateGuarantor(guarantor) {

  const schema = Joi.object({
    full_name: Joi.string()
      .min(2)
      .max(255)
      .required(),
    address: Joi.string()
      .min(2)
      .max(1000)
      .required(),
    phone: Joi.string()
      .pattern(new RegExp(/^\+[1-9]\d{1,14}$/))
      .message('Please enter a valid phone number in international format')
      .required(),
    email: Joi.string()
      .min(5)
      .max(255)
      .required()
      .email(),
    gender: Joi.string()
      .min(4)
      .max(25)
      .required(),

    occupation: Joi.string()
      .min(5)
      .max(255)
      .required()


  })
  return schema.validate(guarantor);
}
exports.User = User;
exports.validateUser = validateUser;
exports.validateFarm = validateFarm;
exports.validateGuarantor = validateGuarantor;
