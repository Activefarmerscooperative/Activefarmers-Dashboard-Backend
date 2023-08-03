
const { Loan } = require("../../models/loan")

const resetCron = async () => {

    // This function will set all ongoing cronStatus to Initiated so dat dey can be charged for the current month

    try {
        const loans = await Loan.find({ status: "Confirmed", repaymentStatus: "Ongoing", cronStatus: "Successful" });

        for (let i = 0; i < loans.length; i++) {
            let loan = loans[i];
            loan.cronStatus = "Initiated"
            await loan.save()
        }

    } catch (error) {
        console.log(error);
    }
};


module.exports = resetCron