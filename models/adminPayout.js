const { default: mongoose } = require("mongoose");

const payoutSchema = mongoose.Schema({
    type: { type: String },
    amount: { type: Number },
    admin: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Admin' },
    payment_method: { type: String },
    reference: { type: String },
    item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'checkModel' },
    checkModel: {
        type: String,
        enum: ['SavingsWithdrawal', "Loan"],
        // required: true,
    },
}, { timestamps: true });

module.exports = new mongoose.model('Payout', payoutSchema);

