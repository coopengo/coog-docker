const Joi = require('@hapi/joi');

const envVarsSchema = Joi.object({
  COOG_DB_NAME: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  REDIS_DB: Joi.number().required(),
  MONGO_URL: Joi.string().required(),
  MONGO_USER: Joi.string(),
  MONGO_PASSWORD: Joi.string(),
  MONGO_API_DB: Joi.string().required(),
  MONGO_IDENTITY_DB: Joi.string().required(),
  API_IDENTITY_MANAGER_INTERNAL_URL: Joi.string().required(),
})
  .unknown()
  .required();

const { error, value: envVars } = envVarsSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const CONFIG = {
  coogDbName: envVars.COOG_DB_NAME,
  redisURL: envVars.REDIS_URL,
  redisDb: envVars.REDIS_DB,
  mongoURL: envVars.MONGO_URL,
  mongoUser: envVars.MONGO_USER,
  mongoPassword: envVars.MONGO_PASSWORD,
  mongoApiDb: envVars.MONGO_API_DB,
  mongoIdentityDb: envVars.MONGO_IDENTITY_DB,
  apiIdentityManagerInternalUrl: envVars.API_IDENTITY_MANAGER_INTERNAL_URL,
};

module.exports = CONFIG;
