const { default: mongoose } = require("mongoose");

const loanSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    amount: { type: Number, required: true },
    savings: { type: Number, required: false },
    status: {
        type: String,
        enum: ['Pending', "In Progress", 'Confirmed', "Rejected", "Cancelled"],//User can cancel loan before it's approved.
        default: 'Pending'
    },

    paymentStatus: {
        type: String,
        enum: ['Pending', 'success', "failed", "reversed"],//This response from paystack after transfer is done
        default: 'Pending'
    },
    repaymentMethod: {
        type: String,
        enum: ['Card', 'Savings', 'MandateForm'],
        required: true
    },
    cardIsValid: {
        type: Boolean,
        default: false,
    },
    repaymentPeriod: {
        type: Number,
        min: 1,
        max: 12,
        required: true
    },
    repayment: [{
        amount: {
            type: Number,
            default: 0
        },
        paymentMethod: {
            type: String
        },
        timestamp: { type: Date, 'default': Date.now }
    }],
    cronStatus: {
        type: String,
        enum: ["Initiated", "Failed", "Successful"]
    },
    repaymentStatus: {
        type: String,
        default: "Ongoing",
        enum: ["Ongoing", "Completed","Canceled"]
        //Ongoing when the user has not completed loan payment
        //Completed when payment has been completed and Loan closed
    },
    adminActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Loan = mongoose.model('Loan', loanSchema);

function validateLoan(loan) {
    amount, repaymentMethod, repaymentPeriod
    const schema = Joi.object({
        amount: Joi.string()
            .min(2)
            .max(250)
            .required(),
        repaymentMethod: Joi.string()
            .min(2)
            .max(250)
            .required(),
        repaymentPeriod: Joi.string()
            .pattern(/^(1[0-2]|[1-9])$/)
            .message('Invalid period selected.')
            .required(),

    })
    return schema.validate(loan);
}
exports.Loan = Loan;
exports.validateLoan = validateLoan;