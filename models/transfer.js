const { default: mongoose } = require("mongoose");

const transferSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    type: { type: String },
    transferRecipient: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, default: "Pending", enum: ["Pending", "Initiated", "Completed", "Failed", "Reversed"] },
    transferData: { type: mongoose.Schema.Types.Mixed, },
    item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'checkModel' },
    checkModel: {
        type: String,
        enum: ['SavingsWithdrawal', "Loan"],
        // required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transfer', transferSchema);
