const { default: mongoose } = require("mongoose");

const accountSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    bankName: { type: String, required: true },
    bankCode:{ type: String, required: true },
    accountNumber: { type: Number, required: true },
    accountType: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Account', accountSchema);
function validateAccount(account) {

    const schema = Joi.object({
        accountNumber: Joi.string()
        .pattern(new RegExp(/^\d{10}$/))
        .message('Please enter a valid bank account number')
        .required(),
        farmSize: Joi.number()
            .min(2)
            .max(1000)
            .required(),
            bankName: Joi.string()
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
exports.AccountDetails = AccountDetails;
exports.validateAccount = validateAccount;