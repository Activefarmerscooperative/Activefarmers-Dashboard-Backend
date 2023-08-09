const Joi = require("joi");
exports.validate = (validator) => {
    return (req, res, next) => {
        const { error } = validator(req.body);
        if (error) return res.status(400).send(error.details[0].message);
        next();
    }
}

exports.loginValidator = function (req) {
    const schema = Joi.object({
        phone: Joi.string()
            .pattern(new RegExp(/[1-9]\d{1,14}$/))
            .message('Please enter a valid phone number in international format')
            .required(),
        password: Joi.string()
            .min(5)
            .max(255)
            .required(),
    })
    return schema.validate(req);
}

exports.adminLoginValidator = function (req) {
    const schema = Joi.object({
        email: Joi.string()
            .email()
            .message('Please enter a valid email')
            .required(),
        password: Joi.string()
            .min(5)
            .max(255)
            .required(),
    })
    return schema.validate(req);
}

exports.adminProfileValidator = function (admin) {

    const schema = Joi.object({
        firstname: Joi.string()
            .min(2)
            .max(250)
            .required(),
        surname: Joi.string()
            .min(2)
            .max(250)
            .required(),
        phone: Joi.string()
            .pattern(new RegExp(/[1-9]\d{1,14}$/))
            .message('Please enter a valid phone number in international format')
            .required(),
        gender: Joi.string()
            .min(3)
            .max(20)
            .required(),
        address: Joi.string()
            .min(3)
            .required(),

    })
    return schema.validate(admin);
}


exports.scheduledSavingsValidator = function (req) {
    // Joi schema for validation
    const schema = Joi.object({
        amount: Joi.number().positive().required(),
        category: Joi.string().trim().required(),
        newCategory: Joi.string().min(0).trim().allow(null).optional(),
        date: Joi.date().iso().required(),
    });
    return schema.validate(req);
}
// exports.validate = validate;
// exports.loginValidator = loginValidator;
