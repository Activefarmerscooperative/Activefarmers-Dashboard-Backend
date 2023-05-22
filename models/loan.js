const { default: mongoose } = require("mongoose");

const loanSchema = mongoose.Schema({
    _id: {type: mongoose.Schema.Types.ObjectId},
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    amount: { type: Number, required: true },
    // category: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SavingsCategory' },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', "Rejected"],
        default: 'Pending'
    },
    repaymentMethod:{
        type: String,
        enum: ['Card', 'Savings', 'MandateForm'],
        required:true
    },
    cardIsValid:{
        type:Boolean,
        default:false,
    },
    repaymentPeriod:{
        type: Number,
        min:1,
        max:12,
        required:true
    },
    repayment:[{
        amount: {
            type: Number,
            default: 0
        },
        timestamp: { type: Date, 'default': Date.now }
    }],
    repaymentStatus:{
        type: String,
        default:"Ongoing",
        enum:["Ongoing","Failed","Completed"]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Loan', loanSchema);