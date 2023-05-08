const { default: mongoose } = require("mongoose");

const lgaSchema = mongoose.Schema({
    _id: {type: mongoose.Schema.Types.ObjectId},
    state: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'State'},
    name: {type: String, required: true} 
});


module.exports = mongoose.model('LGA', lgaSchema);