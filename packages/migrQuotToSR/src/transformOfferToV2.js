/* eslint-disable no-underscore-dangle */

const { forEach, get, map, omit, round } = require('lodash');

const MAPPING_PRODUCT_CODE = {
  1: 'gen_emp',
  2: 'lmp_emp',
  8: 'gen_prev',
  10: 'gen_prev__hc',
  11: 'gen_prev__croisee',
  16: 'lmp_hc',
  17: 'lmp_pp',
  18: 'lmp_pp__croisee',
};

/**
 * Replace loan array index to ref
 * @param {Array} list Array of objects that have loan key with ref
 * @param {Array} loans SR loans
 * @returns
 */
const replaceLoanRef = (list, loans) => {
  if (list) {
    return map(list, obj => {
      if (get(obj, 'loan.ref') && loans) {
        const loan = loans[parseInt(obj.loan.ref, 10)];

        if (loan) {
          return { ...obj, loan: { ...obj.loan, ref: loan.ref } };
        }
      }

      return obj;
    });
  }

  return undefined;
};

/**
 * Replace party array index to ref
 * @param {Array} list Array of objects that have party key with ref
 * @param {Array} parties SR parties list
 * @returns
 */
const replacePartyRef = (list, parties) => {
  if (list) {
    return map(list, obj => {
      if (get(obj, 'origin.covered.party.ref') != null) {
        const party = parties[parseInt(obj.origin.covered.party.ref, 10)];

        if (party) {
          return {
            ...obj,
            origin: {
              ...obj.origin,
              covered: {
                ...obj.origin.covered,
                party: { ...obj.origin.covered.party, ref: party.ref },
              },
            },
          };
        }
      }

      return obj;
    });
  }

  return undefined;
};

/**
 * Stringify TAEA
 * @param {Array} list Array of objects that have taea key
 * @returns
 */
const stringifyTaea = list => map(list, obj => ({ ...obj, taea: `${obj.taea}` }));

/**
 * Round data (all_contract, first, first_year and mean)
 * @param {object} data Object with value to round
 * @param {number} precision Precision to round
 * @param {array} fields List of fields to round
 * @param {boolean} stringify If data if stringified
 * @returns
 */
const roundData = ({
  data,
  precision = 2,
  fields = [
    'average_total',
    'average_total_fee',
    'average_total_premium',
    'average_total_premium_tax',
    'average_total_tax',
    'total',
    'total_fee',
    'total_premium',
    'total_premium_tax',
    'total_tax',
  ],
  stringify = false,
}) => {
  const roundedData = { ...data };

  forEach(fields, field => {
    if (roundedData[field] != null) {
      roundedData[field] = round(roundedData[field], precision);

      if (stringify) {
        roundedData[field] = `${roundedData[field].toFixed(precision)}`;
      }
    }
  });

  return roundedData;
};

const getOfferFromV1 = (salesroute, offer) => {
  const { contracts, loans, parties } = salesroute;

  if (offer) {
    const isLoan = loans && loans[0] && !get(offer, 'premium_summary.contract');

    const newOffers = map(offer.schedules, (schedule, idx) => {
      const covered = get(offer, `premium_summary.by_covered[${idx}]`, {});

      // Replace loan ref for all schedules
      const newSchedule = map(schedule, sched => ({
        ...sched,
        details: replacePartyRef(replaceLoanRef(sched.details, loans), parties),
      }));

      // Stringify and replace loan ref for all TAEA
      const taea = stringifyTaea(replaceLoanRef(covered.taea, loans));

      // Get currency code
      let currencyCode;

      switch (schedule[0].currency_symbol) {
        case '€':
        default:
          currencyCode = 'EUR';
          break;
      }

      // Get premium
      let premium = {
        currency: { code: currencyCode },
        total_fee: 0,
        total_premium: 0,
        total_tax: 0,
        _cptMean: 0,
      };

      if (isLoan) {
        premium.first_year_fee = schedule[0].fee;
        premium.first_year_premium = schedule[0].premium;
        premium.first_year_tax = schedule[0].tax;
        premium.first_year_total = schedule[0].total;
      }

      forEach(schedule, sched => {
        premium.total_fee += parseFloat(sched.fee);
        premium.total_premium += parseFloat(sched.premium);
        premium.total_tax += parseFloat(sched.tax);
        premium._cptMean += 1;
      });

      premium.total_premium_tax = premium.total_tax;
      premium.total = premium.total_premium + premium.total_tax + premium.total_fee;
      premium.average_total_fee = premium.total_fee / premium._cptMean;
      premium.average_total_premium = premium.total_premium / premium._cptMean;
      premium.average_total_premium_tax = premium.total_premium_tax / premium._cptMean;
      premium.average_total_tax = premium.total_tax / premium._cptMean;
      premium.average_total = premium.total / premium._cptMean;

      const covPremium = omit(
        roundData({
          data: {
            average_total: premium.average_total - premium.average_total_fee,
            average_total_fee: '0',
            average_total_premium: premium.average_total_premium,
            average_total_premium_tax: premium.average_total_premium_tax,
            average_total_tax: premium.average_total_tax,
            currency: premium.currency,
            fees: [],
            total: premium.total - premium.total_fee,
            total_fee: '0',
            total_premium: premium.total_premium,
            total_premium_tax: premium.total_premium_tax,
            total_tax: premium.total_tax,
          },
          fields: [
            'average_total',
            'average_total_premium',
            'average_total_premium_tax',
            'average_total_tax',
            'total',
            'total_premium',
            'total_premium_tax',
            'total_tax',
          ],
          stringify: true,
        }),
        ['_cptMean']
      );

      premium = omit(roundData({ data: premium, stringify: true }), ['_cptMean']);

      const newOffer = {
        coverages: [],
        covereds: map(get(contracts, `[${idx}].covereds`), ({ coverages, package: pkg, party }) => ({
          coverages: map(coverages, ({ coverage }) => ({
            coverage,
            eligibility: { eligible: true },
          })),
          premium: covPremium,
          package: pkg,
          party,
        })),
        product: { code: MAPPING_PRODUCT_CODE[contracts[idx].product.id] },
        ref: get(contracts, `[${idx}].ref`),
        premium,
        schedule: newSchedule,
      };

      if (isLoan) {
        newOffer.taea = taea;
      }

      return newOffer;
    });

    const newContracts = map(contracts, (contract, idx) => ({ ...contract, offer: [newOffers[idx]] }));

    return { contracts: newContracts };
  }

  return { contracts };
};

module.exports = { getOfferFromV1 };
