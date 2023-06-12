const mongoose = require("mongoose");
const { validatePaystackPayment } = require("../utils/paystack");
const Savings = require("../models/savings");
const SavingsWallet = require("../models/savingsWallet");
const Transaction = require("../models/transaction");
const StatusCodes = require("../utils/status-codes")
const { Card_Is_Valid } = require("../utils/checkValidCard")
const UserCard = require("../models/cardDetails");
const Loan = require("../models/loan")

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
    // Each item in this order may belong to many sellers
    // Update each item with the paymnt confirmation status.

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

                // const amount_paid = data.data.amount / 100;
                const order = await Order.findById(data.data.metadata.order)
                    .populate({
                        path: 'address',
                        model: 'Address',
                        populate: [
                            {
                                path: 'state',
                                model: 'State',
                            },
                            {
                                path: 'country',
                                model: 'Country',
                            }]
                    })
                    .populate({
                        path: 'items',
                        model: 'OrderItem',
                        populate: {
                            path: 'product',
                            model: 'Product',
                            populate: [{
                                path: 'unit',
                                model: 'Unit',
                            },
                            {
                                path: 'state',
                                model: 'State',
                            },
                            {
                                path: 'country',
                                model: 'Country',
                            }]
                        }
                    })
                    .exec();

                // If this payment has already been verified maybe either by callbackUrl or hook prevent re-run wen page is refreshed
                if (order.completed === true) {
                    return res.sendStatus(200);
                }
                //payment was successful, confirm the order



                // Each item in this order may belong to many sellers
                // Update each item with the paymnt confirmation status.
                await OrderItem.updateMany({ _id: { $in: order.items } },
                    {
                        $push: {
                            status: {
                                text: "Confirmed",
                            }
                        }
                    });

                order.payment = true;
                order.completed = true;
                order.status = 'In Progress';
                await order.save();

                const transaction = new Transaction({
                    _id: new mongoose.Types.ObjectId(),
                    type: 'order',
                    amount: order.amount,
                    payment_method: 'paystack',
                    reference: data.data.reference,
                    item: order._id
                })

                await transaction.save();
                const buyer = await User.findOne({ email: data.data.customer.email })

                //empty cart
                await Cart.deleteMany({ user: buyer._id }).exec();


                // Send Email message to Buyer
                await orderCompleted(buyer, order)
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