const { performance } = require('perf_hooks');
const _ = require('lodash');
const redis = require('redis');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const { getSalesRouteFromQuotation } = require('./transformToSR');
const { getOfferFromV1 } = require('./transformOfferToV2');

const tStart = performance.now();
const CONFIG = require('./config');

const testData = require('./test/quotations.json');

/**
 * In Redis, table 7 (by default)
 * "q:xxx" : Quotation
 * "database:yyy:q" : Set with database = coogDbName (COOG_DB_NAME) and yyy = User token
 *   Set with IDs of quotations ("xxx" for example)
 *   So "q:xxx" will get the quotation
 * "zzz" : Containing token with expire and max age
 */

let scanAsync;
let sscanAsync;
let getAsync;

const redisClient = redis.createClient({
  url: CONFIG.redisURL,
  db: CONFIG.redisDb,
});

scanAsync = promisify(redisClient.scan).bind(redisClient);
sscanAsync = promisify(redisClient.sscan).bind(redisClient);
getAsync = promisify(redisClient.get).bind(redisClient);

const parseQuotation = val => {
  const quotation = {
    ...JSON.parse(val),
  };

  const newSR = getSalesRouteFromQuotation(quotation);
  const contractsWithOffer = getOfferFromV1(newSR, quotation.offer);

  const newSROffer = { ...newSR, ...contractsWithOffer };

  return newSROffer;
};

const fetchQuotation = quotation => getAsync(`q:${quotation}`).then(parseQuotation);

// Filter quotations so only ones that have not been already transformed into SR will be transformed
const getUserQuotationsList = salesRoutes => val => {
  console.log(`${val[1].length} potential quotations for one user to fetch`);
  const quotations = val[1].filter(v => !salesRoutes.has(v));
  console.log(`Quotations to fetch: ${quotations.length}\n`);
  return Promise.all(quotations.map(fetchQuotation));
};

const getUserQuotationsKey = salesRoutes => redisKey =>
  sscanAsync(redisKey, 0, 'count', 1e6).then(getUserQuotationsList(salesRoutes));

const getIdentity = (distNetwork, identityList = {}) =>
  identityList[distNetwork] || identityList.undefined || Object.values(identityList)[0];

// Add user ID to the SR
const createSalesRouteWithIdentity = ({ quotation, identity }) => ({
  ...quotation,
  createdBy: identity,
  updatedBy: identity,
});

const reduceSalesRouteForUser = identities => (acc, quotation) =>
  [
    ...acc,
    createSalesRouteWithIdentity({
      quotation,
      identity: getIdentity(quotation.broker, identities),
    }),
  ];

const reduceUserQuotations = ({ quotations, identities }) => quotations.reduce(reduceSalesRouteForUser(identities), []);

const getSalesRoutesFromQuotations =
  ({ usersTokens, identities }) =>
  (acc, quotations, i) =>
    [
      ...acc,
      ...reduceUserQuotations({
        quotations,
        identities: identities[usersTokens[i]],
      }),
    ];

const getSalesRouteForIdentity = context => quotationsUsers =>
  quotationsUsers.reduce(getSalesRoutesFromQuotations(context), []);

const getSalesRouteIdentityInfo = (acc, value, key) => `${acc}\n${key}: ${value}`;

const displaySalesRouteInformation = salesRoutes => {
  const salesRouteByIdentity = _.countBy(salesRoutes, 'createdBy');
  const salesRouteByIdentityStr = _.reduce(salesRouteByIdentity, getSalesRouteIdentityInfo, '');
  console.log(`SalesRoute count by identity:${salesRouteByIdentityStr}\n`);
  return salesRoutes;
};

const getRedisToken =
  ({ salesRoutes, identities }) =>
  val => {
    const usersTokens = val[1].map(token => token.split(':')[1]);
    console.log(`Redis users found: ${usersTokens.length}\n`);
    return Promise.all(val[1].map(getUserQuotationsKey(salesRoutes)))
      .then(getSalesRouteForIdentity({ usersTokens, identities }))
      .then(displaySalesRouteInformation);
  };

const createTokenIdentity = (acc = {}, { dist_network: distNetwork, _id }) => ({
  ...acc,
  [distNetwork]: _id,
});

const reduceIdentityByToken = (acc, { token, ...identity }) => ({
  ...acc,
  [token]: createTokenIdentity(acc[token], identity),
});

const mapPartialIdentities = (identities = []) => {
  console.log(`Identities found: ${identities.length}`);
  return identities.reduce(reduceIdentityByToken, {});
};

const fetchMongoIdentity = db => db.collection('identities').find({}).toArray().then(mapPartialIdentities);

const mapPartialSalesRoutes = (salesRoutes = []) => new Set(salesRoutes.map(({ title }) => title));

// Get Mongo SR already transformed (so with a title), and get only title field
const fetchMongoSalesRoute = db =>
  db
    .collection('salesroutes')
    .find(
      {
        title: {
          $exists: true,
        },
      },
      {
        title: 1,
      }
    )
    .toArray()
    .then(mapPartialSalesRoutes);

const fetchExistingSalesRoutes = client => {
  const SalesRoute = client.db(CONFIG.mongoApiDb);
  return fetchMongoSalesRoute(SalesRoute);
};

const fetchIdentity = client => {
  const Identity = client.db(CONFIG.mongoIdentityDb);
  return fetchMongoIdentity(Identity);
};

// Limit key to 36 characters of offer.data
const parseDataKey = key => (key.length <= 36 ? key : key.slice(key.length - 36));

const reduceData = (acc, value, key) => ({
  ...acc,
  [parseDataKey(key)]: value,
});

const parseOfferData = data => _.reduce(data, reduceData, {});

const parseOfferDatas = (datas = []) => datas.map(parseOfferData);

// Remove label of id for offer.columns
const parseOfferColumn = ({ id, ...column }) => ({
  id: id.replace(new RegExp(`^${column.label}`), ''),
  ...column,
});

const parseOfferColumns = (columns = []) => columns.map(parseOfferColumn);

const parseContractOffer = ({ columns, data, ...offer }) => ({
  ...offer,
  data: parseOfferDatas(data),
  columns: parseOfferColumns(columns),
});

const parseContractOffers = (offers = []) => offers.map(parseContractOffer);

const parseSalesRouteContract = ({ offer, ...contract }) => ({
  ...contract,
  offer: parseContractOffers(offer),
});

const parseSalesRouteContracts = (contracts = []) => contracts.map(parseSalesRouteContract);

// If SR can't be imported, fix it by remove some id and limit key to 36 characters
// Then try again to import it to Mongo
const parseSalesRoute = ({ contracts, ...salesRoute }) => ({
  ...salesRoute,
  contracts: parseSalesRouteContracts(contracts),
});

const displaySuccessInsertLoad = salesRoutes => {
  console.log(`Successfully added ${salesRoutes.result.n} salesRoute(s)`);
  return displaySalesRouteInformation(salesRoutes.ops);
};

const insertSalesRoutes = (db, salesRoutes, exponent, offset) =>
  db
    .collection('salesroutes')
    .insertMany(salesRoutes, { check_keys: false })
    .then(displaySuccessInsertLoad)
    .catch(() => {
      if (exponent === 0) {
        const newSalesRoute = parseSalesRoute(salesRoutes[0]);
        return db.collection('salesroutes').insertOne(newSalesRoute).then(displaySuccessInsertLoad);
      }
      console.log(`Error happen at offset: ${offset}, salesRoute amount: ${salesRoutes.length}, exponent: ${exponent}`);
      console.log(`Reducing exponent at: ${exponent - 1}\n`);
      // eslint-disable-next-line no-use-before-define
      return splitBatchByExponent(db, salesRoutes, exponent - 1, offset);
    });

// Import SR by batch of 10^exponent
// If there's an error, try again with exponent-1
const splitBatchByExponent = (db, salesRoutes, exponent, offset = 0) => {
  const chunk = _.chunk(salesRoutes, 10 ** exponent);
  return Promise.all(
    chunk.map((salesRoutesChunk, i) => insertSalesRoutes(db, salesRoutesChunk, exponent, offset + i * 10 ** exponent))
  );
};

const batchInsertSalesRoute = (client, salesRoutes) => {
  const SalesRoute = client.db(CONFIG.mongoApiDb);
  const exponent = parseInt(salesRoutes.length.toExponential().split('e+')[1], 10) + 1;
  return splitBatchByExponent(SalesRoute, salesRoutes, exponent);
};

const mongoBorder = `
*******************************
*                             *
*            MONGO            *
*                             *
*******************************
`;

const redisBorder = `
*******************************
*                             *
*            REDIS            *
*                             *
*******************************
`;

const runMigrationProcess = async client => {
  console.log(mongoBorder);
  const t1 = performance.now();
  const [identities, salesRoutesSet] = await Promise.all([fetchIdentity(client), fetchExistingSalesRoutes(client)]);
  const t2 = performance.now();
  console.log(`SalesRoutes already created: ${salesRoutesSet.size}`);
  console.log(`Mongo fetch time elapsed: ${t2 - t1} ms`);
  console.log(redisBorder);
  const salesRoutes = await scanAsync(0, 'match', `${CONFIG.coogDbName}*`, 'count', 1e6).then(
    getRedisToken({ salesRoutes: salesRoutesSet, identities })
  );

  const t3 = performance.now();
  console.log(`Redis fetch time elapsed: ${t3 - t2} ms`);
  console.log(mongoBorder);

  if (!salesRoutes.length) {
    console.log('No insert needed');
    return null;
  }

  console.log(`Starting insertion of ${salesRoutes.length} salesRoutes`);

  return batchInsertSalesRoute(client, salesRoutes).then(() => {
    const t4 = performance.now();
    console.log(`Mongo insert time elapsed: ${t4 - t3} ms`);
    return null;
  });
};

const getMongoAuth = () => (CONFIG.mongoUser ? `${CONFIG.mongoUser}:${CONFIG.mongoPassword}@` : '');
const getMongoHost = () => CONFIG.mongoURL;

MongoClient.connect(`mongodb://${getMongoAuth()}${getMongoHost()}`, { useUnifiedTopology: true })
  .then(runMigrationProcess)
  .then(() => {
    const tEnd = performance.now();
    console.log(`Total time execution: ${tEnd - tStart} ms`);
    process.exit(0);
  })
  .catch(err => {
    console.log(err);
    process.exit(err.status || 2);
  });
