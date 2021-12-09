const { performance } = require('perf_hooks');
const _ = require('lodash');
const redis = require('redis');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const request = require('axios');
const fsProm = require('fs/promises');
const fs = require('fs');

const { getSalesRouteFromQuotation } = require('./transformToSR');
const { getOfferFromV1 } = require('./transformOfferToV2');

const tStart = performance.now();
const CONFIG = require('./config');
const IMPORT_DIR = '/workdir/import/';

/**
 * In Redis, table 7 (by default)
 * "q:xxx" : Quotation
 * "database:yyy:q" : Set with database = coogDbName (COOG_DB_NAME) and yyy = User token
 *   Set with IDs of quotations ("xxx" for example)
 *   So "q:xxx" will get the quotation
 * "zzz" : Containing token with expire and max age
 */

const redisClient = redis.createClient({
  url: CONFIG.redisURL,
  db: CONFIG.redisDb,
});

const scanAsync = promisify(redisClient.scan).bind(redisClient);
const sscanAsync = promisify(redisClient.sscan).bind(redisClient);
const getAsync = promisify(redisClient.get).bind(redisClient);

const logStream = fs.createWriteStream(`${IMPORT_DIR}logs.txt`, { flags: 'a' });

const addDigits = (text, length = 2) => {
  if (`${text}`.length < length) {
    return `0${text}`;
  }

  return text;
};

const log = text => {
  _.forEach(text.split('\n'), line => {
    console.log(line);

    const date = new Date();
    const strDate = `${date.getFullYear()}/${addDigits(date.getMonth() + 1)}/${addDigits(date.getDate())} ${addDigits(
      date.getHours()
    )}:${addDigits(date.getMinutes())}:${addDigits(date.getSeconds())}:${addDigits(date.getMilliseconds(), 3)}`;
    logStream.write(`${strDate} ${line}\n`);
  });
};

const getIdentityByToken = (token, allIdentities) => {
  return request
    .post(`${CONFIG.apiIdentityManagerInternalUrl}/auth/coog/bearer`, { token })
    .then(response => response.data)
    .then(data => [
      ...allIdentities,
      {
        coogId: _.get(data, 'token.user'),
        token: _.get(data, 'token.key'),
        dist_network: { id: _.get(data, 'dist_network') },
      },
    ])
    .catch(err => {
      log(`Error ${_.get(err, 'response.status', err)} for ${token}:`);
      log(_.get(err, 'response.data', _.get(err, 'response')));
    });
};

const displaySuccessInsertLoadIdentities = identities => {
  log(`Successfully added ${identities.result.n} identities\n`);
  return identities.ops;
};

const fetchIdentities = db => db.collection('identities').find({}).toArray();

const fetchSalesroutes = (db, query = [{}]) =>
  db
    .collection('salesroutes')
    .find(...query)
    .toArray();

const createTokenIdentity = (acc = {}, { dist_network: distNetwork = {}, _id }) => ({
  ...acc,
  [distNetwork.id]: _id,
});

const reduceIdentityByToken = (acc, { token, ...identity }) => ({
  ...acc,
  [token]: createTokenIdentity(acc[token], identity),
});

const mapPartialIdentities = (identities = []) => {
  log(`Identities found: ${identities.length}`);
  return identities.reduce(reduceIdentityByToken, {});
};

const fetchMongoIdentity = db => db.collection('identities').find({}).toArray().then(mapPartialIdentities);

const insertIdentities = (db, identities) =>
  db
    .collection('identities')
    .insertMany(identities, { checkKeys: false })
    .then(displaySuccessInsertLoadIdentities)
    .catch(e => {
      log(`Error: ${e}`);
      return identities;
    });

const fetchIdentity = client => {
  const Identity = client.db(CONFIG.mongoIdentityDb);
  return fetchMongoIdentity(Identity);
};

const parseQuotation = val => {
  const quotation = { ...JSON.parse(val) };

  const newSR = getSalesRouteFromQuotation(quotation);
  const contractsWithOffer = getOfferFromV1(newSR, quotation.offer);

  const newSROffer = { ...newSR, ...contractsWithOffer };

  return newSROffer;
};

const fetchQuotation = quotation => getAsync(`q:${quotation}`).then(parseQuotation);

// Filter quotations so only ones that have not been already transformed into SR will be transformed
const getUserQuotationsList = salesRoutes => val => {
  const quotations = val[1].filter(v => !salesRoutes.has(v));
  log(`${quotations.length} (out of ${val[1].length}) quotations for one user to fetch`);
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
  if (salesRoutes && salesRoutes.length) {
    const salesRouteByIdentity = _.countBy(salesRoutes, 'createdBy');
    const salesRouteByIdentityStr = _.reduce(salesRouteByIdentity, getSalesRouteIdentityInfo, '');
    log(`\nSalesRoute count by identity: ${salesRouteByIdentityStr}\n`);
  } else {
    log('\nNo insert needed\n');
  }

  return salesRoutes;
};

const getRedisToken =
  ({ salesRoutes }) =>
  ({ identities, val }) => {
    const usersTokens = val[1].map(token => token.split(':')[1]);
    return Promise.all(val[1].map(getUserQuotationsKey(salesRoutes)))
      .then(getSalesRouteForIdentity({ usersTokens, identities }))
      .then(displaySalesRouteInformation);
  };

const addMongoIdentities =
  ({ identities, client }) =>
  val => {
    if (CONFIG.getIdentitiesFrom === 'api') {
      const usersTokens = val[1].map(token => token.split(':')[1]);
      log(`Redis users found: ${usersTokens.length}\n`);

      const identityKeys = Object.keys(identities);
      const tokenToAdd = _.filter(usersTokens, token => !_.includes(identityKeys, token));

      if (tokenToAdd.length) {
        log(`*******************************`);
        log(`*   Add identities to Mongo   *\n`);
        log(`Tokens to add to Mongo: ${tokenToAdd.length}`);
      }

      return _.reduce(
        tokenToAdd,
        (prevPromise, token) => {
          return prevPromise.then(allIdentities => {
            return getIdentityByToken(token, allIdentities);
          });
        },
        Promise.resolve([])
      )
        .then(allIdentities => {
          if (allIdentities && allIdentities.length) {
            log(`${allIdentities.length} users will be added to Mongo`);
            const db = client.db(CONFIG.mongoIdentityDb);
            return insertIdentities(db, allIdentities);
          }

          return null;
        })
        .then(identitiesAdded => {
          if (identitiesAdded && identitiesAdded.length) {
            log(`Get new Mongo identities`);
            return fetchIdentity(client);
          }

          return null;
        })
        .then(newIdentities => {
          if (newIdentities) {
            log(`\n*             End             *`);
            log(`*******************************\n`);
            return {
              identities: newIdentities || identities,
              val,
            };
          }

          return {
            identities,
            val,
          };
        });
    }

    return {
      identities,
      val,
    };
  };

const insertMongoIdentitiesFromFile = client => {
  return fsProm
    .readFile(`${IMPORT_DIR}${CONFIG.identitiesFileName}`, 'utf8')
    .then(data => {
      if (!data) {
        log('Identities file is empty.');
        return null;
      }

      const dataJson = [];

      try {
        const lines = data.split('\n');
        const headers = lines.shift();
        let separator = ';';

        if (headers.split(',').length === 3) {
          separator = ',';
        }

        _.forEach(lines, line => {
          const columns = line.split(separator);
          const obj = {};

          if (columns.length === 3) {
            _.forEach(columns, (col, idx) => {
              const value = col.trim();

              switch (idx) {
                case 0:
                  if (_.isFinite(parseInt(value, 10))) {
                    obj.coogId = parseInt(value, 10);
                  }
                  break;
                case 1:
                  obj.token = value;
                  break;
                case 2:
                  if (_.isFinite(parseInt(value, 10))) {
                    obj.dist_network = { id: parseInt(value, 10) };
                  }
                  break;
                default:
                  break;
              }
            });
          }

          if (obj.coogId && obj.token && obj.dist_network) {
            dataJson.push(obj);
          }
        });
      } catch (e) {
        log('Error getting data from identities file');
        log(e);
      }

      log(`${dataJson.length} identities found in file.`);

      return dataJson;
    })
    .then(allIdentities => {
      const db = client.db(CONFIG.mongoIdentityDb);

      return fetchIdentities(db).then(currentIdentities => ({
        newIdentities: allIdentities,
        currentIdentities,
      }));
    })
    .then(({ newIdentities, currentIdentities }) => {
      const identitiesToAdd = newIdentities.filter(
        ({ coogId, token, dist_network: { id: distNetId } }) =>
          !_.find(currentIdentities, { coogId, token, dist_network: { id: distNetId } })
      );

      if (identitiesToAdd.length) {
        log(`${identitiesToAdd.length} new identities will be inserted.`);
        const db = client.db(CONFIG.mongoIdentityDb);
        return insertIdentities(db, identitiesToAdd);
      }

      log('No new identities will be inserted.');
      return null;
    })
    .catch(err => {
      log('Error reading identities file');
      log(err);
    });
};

const mapPartialSalesRoutes = (salesRoutes = []) => new Set(salesRoutes.map(({ title }) => title));

// Get Mongo SR already transformed (so with a title), and get only title field
const fetchMongoSalesRoute = db =>
  fetchSalesroutes(db, [
    {
      title: {
        $exists: true,
      },
    },
    {
      title: 1,
    },
  ]).then(mapPartialSalesRoutes);

const fetchExistingSalesRoutes = client => {
  const SalesRoute = client.db(CONFIG.mongoApiDb);
  return fetchMongoSalesRoute(SalesRoute);
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
  log(`Successfully added ${salesRoutes.result.n} salesRoute(s)`);
  return displaySalesRouteInformation(salesRoutes.ops);
};

const insertSalesRoutes = (db, salesRoutes, exponent, offset) =>
  db
    .collection('salesroutes')
    .insertMany(salesRoutes, { checkKeys: false })
    .then(displaySuccessInsertLoad)
    .catch(() => {
      if (exponent === 0) {
        const newSalesRoute = parseSalesRoute(salesRoutes[0]);
        return db.collection('salesroutes').insertOne(newSalesRoute).then(displaySuccessInsertLoad);
      }
      log(`Error happen at offset: ${offset}, salesRoute amount: ${salesRoutes.length}, exponent: ${exponent}`);
      log(`Reducing exponent at: ${exponent - 1}\n`);
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
  log(mongoBorder);

  if (CONFIG.getIdentitiesFrom === 'csv') {
    const t1 = performance.now();
    log(`*******************************`);
    log(`*        From CSV file        *`);
    log(`*   Add identities to Mongo   *\n`);

    await insertMongoIdentitiesFromFile(client);

    log(`\n*             End             *`);
    log(`*******************************\n`);
    const t2 = performance.now();
    log(`Get & insert identities time elapsed: ${t2 - t1} ms`);
  }

  const t2 = performance.now();

  const [identities, salesRoutesSet] = await Promise.all([fetchIdentity(client), fetchExistingSalesRoutes(client)]);

  const t3 = performance.now();
  log(`SalesRoutes already created: ${salesRoutesSet.size}`);
  log(`Mongo fetch time elapsed: ${t3 - t2} ms`);
  log(redisBorder);

  const redisUsers = scanAsync(0, 'match', `${CONFIG.coogDbName}*`, 'count', 1e6);
  const salesRoutes = await redisUsers
    .then(addMongoIdentities({ identities, client }))
    .then(getRedisToken({ salesRoutes: salesRoutesSet }));

  const t4 = performance.now();
  log(`Redis fetch time elapsed: ${t4 - t3} ms`);
  log(mongoBorder);

  if (!salesRoutes.length) {
    log('No salesroutes insert needed\n');
    return client;
  }

  log(`Starting insertion of ${salesRoutes.length} salesRoutes`);

  return batchInsertSalesRoute(client, salesRoutes).then(() => {
    const t5 = performance.now();
    log(`Mongo insert time elapsed: ${t5 - t4} ms`);
    return client;
  });
};

const exportMongoData = async client => {
  const dbIdentity = client.db(CONFIG.mongoIdentityDb);
  const dbSR = client.db(CONFIG.mongoApiDb);

  await fetchIdentities(dbIdentity)
    .then(docs => {
      return fsProm.writeFile(`${IMPORT_DIR}identities.json`, JSON.stringify(docs));
    })
    .then(() => {
      log('Done writing Identities to identities.json.');
    })
    .catch(e => {
      log('Error writing Identities to file');
      log(e);
    });

  return fetchSalesroutes(dbSR)
    .then(docs => {
      return fsProm.writeFile(`${IMPORT_DIR}salesroutes.json`, JSON.stringify(docs));
    })
    .then(() => {
      log('Done writing SalesRoutes to salesroutes.json.');

      return client;
    })
    .catch(e => {
      log('Error getting SalesRoutes for export');
      log(e);

      return client;
    });
};

const getMongoAuth = () => (CONFIG.mongoUser ? `${CONFIG.mongoUser}:${CONFIG.mongoPassword}@` : '');
const getMongoHost = () => CONFIG.mongoURL;

log(`Mongo connection to ${CONFIG.mongoURL} with user ${CONFIG.mongoUser}`);
log(`Database for Identities is ${CONFIG.mongoIdentityDb}`);
log(`Database for SalesRoutes is ${CONFIG.mongoApiDb}`);

MongoClient.connect(`mongodb://${getMongoAuth()}${getMongoHost()}`, { useUnifiedTopology: true })
  .then(runMigrationProcess)
  .then(exportMongoData)
  .then(client => {
    client.close();

    const tEnd = performance.now();
    log(`\nTotal time execution: ${tEnd - tStart} ms\n`);
    log('You can get your Mongo dumps in the /import directory. You might need to change owner/chmod.');
    process.exit(0);
  })
  .catch(err => {
    log(err);
    process.exit(err.status || 2);
  });
