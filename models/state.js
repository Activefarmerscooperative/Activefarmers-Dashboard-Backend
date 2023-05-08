const { default: mongoose } = require("mongoose");

const stateSchema = mongoose.Schema({
    _id:{type: mongoose.Schema.Types.ObjectId},
    country: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Country'},
    name: {type: String, required: true}  
});

module.exports = mongoose.model('State', stateSchema);