const { default: mongoose } = require("mongoose");

const savingsWithdrawalSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    amount: { type: Number, required: true },
    savings: { type: Number, required: false },
    category: { type: String, required: true, },
    status: {
        type: String,
        enum: ['Pending', "In Progress", 'Confirmed', "Rejected"],
        default: 'Pending'
    },
    paymentStatus: { type: String, },
    adminActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SavingsWithdrawal', savingsWithdrawalSchema);