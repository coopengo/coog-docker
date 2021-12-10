const Joi = require('@hapi/joi');

const envVarsSchema = Joi.object({
  COOG_DB_NAME: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  REDIS_DB: Joi.number().required(),
  MONGO_URL: Joi.string().required(),
  MONGO_INITDB_ROOT_USERNAME: Joi.string(),
  MONGO_INITDB_ROOT_PASSWORD: Joi.string(),
  MONGO_API_DB: Joi.string().required(),
  MONGO_IDENTITY_DB: Joi.string().required(),
  API_IDENTITY_MANAGER_INTERNAL_URL: Joi.string(),
  GET_IDENTITIES_FROM: Joi.string()
    .pattern(/^(csv|api)$/)
    .default('csv'),
  IDENTITIES_FILE_NAME: Joi.string().default('data.csv'),
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
  mongoUser: envVars.MONGO_INITDB_ROOT_USERNAME,
  mongoPassword: envVars.MONGO_INITDB_ROOT_PASSWORD,
  mongoApiDb: envVars.MONGO_API_DB,
  mongoIdentityDb: envVars.MONGO_IDENTITY_DB,
  apiIdentityManagerInternalUrl: envVars.API_IDENTITY_MANAGER_INTERNAL_URL,
  getIdentitiesFrom: envVars.GET_IDENTITIES_FROM,
  identitiesFileName: envVars.IDENTITIES_FILE_NAME,
};

module.exports = CONFIG;
