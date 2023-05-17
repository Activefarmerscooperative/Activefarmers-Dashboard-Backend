const { default: mongoose } = require("mongoose");

const savingsWalletSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    categories: [{
        category: {
            type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SavingsCategory'
        },
        amount: {
            type: Number,
            default: 0
        },
        timestamp: { type: Date, 'default': Date.now }
    },
    ],
}, {
    timestamps: true,
});

module.exports = mongoose.model('SavingsWallet', savingsWalletSchema);