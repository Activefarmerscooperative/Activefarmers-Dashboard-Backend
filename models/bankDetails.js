const { default: mongoose } = require("mongoose");
const Joi = require("joi");
const bankDetailsSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountNumber: { type: Number, required: true },
    accountType: { type: String, required: false },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const BankDetails = mongoose.model('BankDetails', bankDetailsSchema);
function validateAccount(account) {

    const schema = Joi.object({
        accountNumber: Joi.string()
            .pattern(/^\d{10}$/)
            .message('Please enter a valid bank account number')
            .required(),
        bankCode: Joi.string()
            .min(1)
            .required(),
        accountName: Joi.string()
            .min(2)
            .max(1024)
            .required(),
        bankName: Joi.string()
            .min(2)
            .max(1024)
            .required(),
        accountType: Joi.string()
            .min(2)
            .max(1024)
            .optional(),
        _id: Joi.any()
            .optional(),
        __v: Joi.any()
            .optional(),
        createdAt: Joi.any()
            .optional(),
        user: Joi.any()
            .optional()

    })
    return schema.validate(account);
}
exports.BankDetails = BankDetails;
exports.validateAccount = validateAccount;