const { default: mongoose } = require("mongoose");

const savingsCategorySchema = mongoose.Schema({

    name: { type: String, required: true },

}, {
    timestamps: true,
});

module.exports = mongoose.model('SavingsCategory', savingsCategorySchema);