const { default: mongoose } = require("mongoose");

const transactionSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    acton: { type: String, required: true },
    amount: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);