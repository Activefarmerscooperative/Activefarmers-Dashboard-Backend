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
        email: Joi.string()
            .min(5)
            .max(255)
            .required()
            .email(),
        password: Joi.string()
            .min(5)
            .max(255)
            .required(),
    })
    return schema.validate(req);
}

// exports.validate = validate;
// exports.loginValidator = loginValidator;
