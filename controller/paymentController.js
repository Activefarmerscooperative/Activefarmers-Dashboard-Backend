const mongoose = require("mongoose");
const { validatePaystackPayment } = require("../utils/paystack");
const Savings = require("../models/savings");
const SavingsWallet = require("../models/savingsWallet");
const Transaction = require("../models/transaction");
const StatusCodes = require("../utils/status-codes")
const { Card_Is_Valid } = require("../utils/checkValidCard")
const UserCard = require("../models/cardDetails");
const { Loan } = require("../models/loan");
const SavingsCardDetails = require("../models/savingsCardDetails");
const { ScheduledSavings } = require("../models/scheduledSavings");
const crypto = require("crypto")

exports.validatePayment = async (req, res) => {

    const data = await validatePaystackPayment(req.body.reference);

    if (!data.status) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: data.message });

    if (data.data.status !== 'success') return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Payment not completed' });

    const amount_paid = data.data.amount / 100;

    const savings = await Savings.findById(data.data.metadata.savings)
        .exec();


    // If this payment has already been verified maybe either by callbackUrl or webhook prevent re-run wen page is refreshed
    if (savings.status === "Confirmed") {
        const response = {
            status: 'success',
            message: '',
            data: {}
        };

        if (data.data.metadata?.type === "Validate Card") {
            // Check if Card is Valid for Loan period
            const cardIsValid = Card_Is_Valid(data.data)
            if (!data.data.authorization.reusable || !cardIsValid) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: 'success',
                    message: 'Your Card Does not meet the minimum required criteria please try another card.'
                });
            }
            response.message = 'Your card validation was successful.';
        } else if (data.data.metadata?.type === "Scheduled Savings Card") {
            response.message = 'Your card validation was successful.';
        } else {
            response.message = 'Your savings transaction was successful.';
            response.data.savings = savings;
        }

        return res.status(StatusCodes.OK).json(response);
    }
    //payment was successful, confirm the payment
    //make sure the amount paid and order total amount corresponds
    if (savings.amount !== amount_paid) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Amount paid does not match amount recorded' });

    savings.status = 'Confirmed'

    let updateSavings = await SavingsWallet.findOne({ user: savings.user })

    updateSavings.categories.map(item => {
        if (item.category === savings.category) {
            item.amount += savings.amount
            return item
        } else {
            return item
        }
    })

    const transaction = new Transaction({
        type: 'savings',
        user: savings.user,
        amount: savings.amount,
        payment_method: 'paystack',
        reference: req.body.reference,
        item: savings._id,
        checkModel: "Savings"
    })
    await updateSavings.save();
    await savings.save()
    await transaction.save();

    if (data.data.metadata?.type === "Validate Card") {
        // Check if Card is Valid for Loan period
        const cardIsValid = Card_Is_Valid(data.data)
        if (!data.data.authorization.reusable || !cardIsValid) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: 'success',
                message: 'Your Card Does not meet the minimum required criteria please try another card.'
            });
        }
        const card = new UserCard({
            _id: new mongoose.Types.ObjectId(),
            user: savings.user,
            email: data.data.customer.email,
            authorization: data.data.authorization
        })

        await Loan.findOneAndUpdate({ user: savings.user, status: "Pending" }, {
            $set: {
                cardIsValid: true
            }
        }, {
            new: true
        })
        await card.save()
        return res.status(StatusCodes.OK).json({
            status: 'success',
            message: 'Your Loan request has been completed successfully.',

        });
    } else if (data.data.metadata?.type === "Scheduled Savings Card") {

        const scheduledSavings = await ScheduledSavings.findById(data.data.metadata.scheduledSavings)
            .exec();

        const savingsCard = new SavingsCardDetails({
            _id: new mongoose.Types.ObjectId(),
            user: scheduledSavings.user,
            email: data.data.customer.email,
            authorization: data.data.authorization
        })
        await savingsCard.save();
        await ScheduledSavings.findByIdAndUpdate(scheduledSavings._id, {
            card: savingsCard._id,
            status: "Active"
        })
        return res.status(StatusCodes.OK).json({
            status: 'success',
            message: 'Your Card validation transaction was successful.'
        });
    }

    return res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Your Savings transaction was successful.'
    });

}

exports.validatePaymentByWebhook = async (req, res, next) => {
    try {
        const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');

        if (!req.headers['x-paystack-signature']) return res.status(StatusCodes.UNAUTHORIZED).json({ status: 'failed', error: 'Un-authorized operation' });

        if (hash == req.headers['x-paystack-signature']) {
            // Retrieve the request's body
            const event = req.body;
            if (event.event == 'charge.success') {
                const data = await validatePaystackPayment(event.data.reference);

                if (!data.status) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: data.message });

                if (data.data.status !== 'success') return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Payment not completed' });
                const amount_paid = data.data.amount / 100;
       

                const savings = await Savings.findById(data.data.metadata.savings)
                    .exec();
        
                    // This was a charge authorization.
                if (!savings) {
                    return res.sendStatus(200);
                }

                // If this payment has already been verified maybe either by callbackUrl or webhook prevent re-run wen page is refreshed
                if (savings.status === "Confirmed") {

                    return res.status(StatusCodes.OK);
                }
                //payment was successful, confirm the payment
                //make sure the amount paid and order total amount corresponds
                if (savings.amount !== amount_paid) return res.status(StatusCodes.BAD_REQUEST).json({ status: 'failed', error: 'Amount paid does not match amount recorded' });

                savings.status = 'Confirmed'

                let updateSavings = await SavingsWallet.findOne({ user: savings.user })

                updateSavings.categories.map(item => {
                    if (item.category === savings.category) {
                        item.amount += savings.amount
                        return item
                    } else {
                        return item
                    }
                })

                const transaction = new Transaction({
                    type: 'savings',
                    user: savings.user,
                    amount: savings.amount,
                    payment_method: 'paystack',
                    reference: data.data.reference,
                    item: savings._id,
                    checkModel: "Savings"
                })
                await updateSavings.save();
                await savings.save()
                await transaction.save();

                if (data.data.metadata?.type === "Validate Card") {
                    // Check if Card is Valid for Loan period
                    const cardIsValid = Card_Is_Valid(data.data)
                    if (!data.data.authorization.reusable || !cardIsValid) {
                        return res.sendStatus(200);
                    }
                    const card = new UserCard({
                        _id: new mongoose.Types.ObjectId(),
                        user: savings.user,
                        email: data.data.customer.email,
                        authorization: data.data.authorization
                    })

                    await Loan.findOneAndUpdate({ user: savings.user, status: "Pending" }, {
                        $set: {
                            cardIsValid: true
                        }
                    }, {
                        new: true
                    })
                    await card.save()

                } else if (data.data.metadata?.type === "Scheduled Savings Card") {

                    const scheduledSavings = await ScheduledSavings.findById(data.data.metadata.scheduledSavings)
                        .exec();

                    const savingsCard = new SavingsCardDetails({
                        _id: new mongoose.Types.ObjectId(),
                        user: scheduledSavings.user,
                        email: data.data.customer.email,
                        authorization: data.data.authorization
                    })
                    await savingsCard.save();
                    await ScheduledSavings.findByIdAndUpdate(scheduledSavings._id, {
                        card: savingsCard._id,
                        status: "Active"
                    })

                }
                return res.sendStatus(200);

            }

        } else {

            return res.status(StatusCodes.UNAUTHORIZED).json({ status: 'failed', error: 'Un-authorized operation' });
        }
        // res.send(200);
    } catch (error) {
        console.log(error)
    }

}