const { default: mongoose } = require("mongoose");

const transactionSchema = mongoose.Schema({
    type: {type: String},
    amount: {type: Number},
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    payment_method: {type: String},
    reference: {type: String},
    item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'checkModel' },
    checkModel: {
        type: String,
        enum: ['Savings','SavingsWithdrawal',"Loan"],
        // required: true,
    },
}, {timestamps: true});

module.exports = new mongoose.model('Transaction', transactionSchema);

