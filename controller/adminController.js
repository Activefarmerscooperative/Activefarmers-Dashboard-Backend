const SavingsCategory = require("../models/savingsCategory");
const StatusCodes = require("../utils/status-codes")

exports.createSavingsCategory = async (req, res) => {
    const { name } = req.body;
    const savingsCategory = new SavingsCategory({
        name
    })
    await savingsCategory.save()

    res.status(StatusCodes.OK).json({ message: `Savings Category Added Successfully` })

}