const moment = require('moment');
const { isEmpty, get, map, omit, set, times } = require('lodash');

const { addFieldsToObject } = require('./transform');

const STATUS_MAPPING_TO_SALESROUTE = {
  canceled: 'CLOSED',
  pending: 'PUTONHOLD',
  submitted: 'SUBSCRIBED',
  project: 'COMPUTED',
  default: 'COMPUTED',
};

const getCommercialProductFromQuotation = ({ commercial_product: { id, code } = {} }) => (code ? { code } : { id });

const patchAddressesWithCountry = addresses => addresses.map(addr => ({ ...addr, country: 'FR' }));

/**
 * Get coverages loan shares if available
 */
const getCoverages = ({ share = 100, coverage = {} }, loanLength) => {
  const shareStr = `${share / 100}`;

  return map(coverage, (value, key) => {
    const newCvg = { coverage: { code: key } };

    if (value.extra) newCvg.extra_data = value.extra;
    if (value.coverage_amount) newCvg.coverage_amount = `${value.coverage_amount}`;
    if (loanLength) {
      newCvg.loan_shares = times(loanLength, idx => ({ loan: { ref: `loan${idx + 1}` }, share: shareStr }));
    }

    return newCvg;
  });
};

/**
 * Get covereds list and parties from covered
 */
const getCoveredAndPartiesFromQuotation = ({ covered = [], loan = [] }) => {
  const parties = [];

  const covereds = covered.map((cvd, idx) => {
    const { party, extra, package: packageCode, type } = cvd;
    const ref = `party${idx + 1}`;

    parties.push({ ...party, ref, relations: [] });

    const cov = {
      coverages: getCoverages(cvd, loan.length),
      extra_data: extra,
      party: { ref },
      item_descriptor: { code: type },
    };

    if (packageCode) cov.package = { code: packageCode };

    return cov;
  });

  return { covereds, parties };
};

/**
 * Create a party object
 */
const createParty = (
  {
    email,
    phone,
    iban,
    addresses,
    party: { is_person: isPerson, name, birth_date: birthDate, first_name: firstName, gender, siren, siret },
  },
  refParty
) => {
  let newParty = {
    email,
    phone,
    ref: refParty,
    relations: [],
    is_person: isPerson,
    name,
  };

  if (addresses) newParty.addresses = patchAddressesWithCountry(addresses);
  if (iban !== null && iban !== undefined) newParty.bank_accounts = [{ number: iban }];

  newParty = addFieldsToObject(newParty, [
    { name: 'birth_date', value: birthDate },
    { name: 'first_name', value: firstName },
    { name: 'gender', value: gender },
    { name: 'siren', value: siren },
    { name: 'siret', value: siret },
  ]);

  return newParty;
};

/**
 * Create a contract object
 */
const createContract = (
  item,
  { billing_mode: billingMode, allowed_direct_debit_day: directDebitDay, iban, direct_debit: directDebit } = {},
  ref,
  refParty,
  covereds,
  id,
  offerV2
) => {
  const { agent, product, offer, extra = {}, date } = item;
  const refSub = refParty || get(covereds, '[0].party.ref');

  const newContract = {
    commercial_product: getCommercialProductFromQuotation(item),
    coverages: [],
    extra_data: extra,
    start: date,
    covereds,
    ref,
  };
  if (refSub) newContract.subscriber = { ref: refSub };
  if (product) newContract.product = { id: product };
  if (agent) newContract.agent = { id: agent };
  if (id) newContract.id = id;
  if (billingMode) {
    newContract.billing = {
      billing_mode: { id: billingMode },
    };

    if (directDebit) newContract.billing.direct_debit_day = directDebitDay;
    if (refParty) newContract.billing.payer = { ref: refParty };
    if (iban !== null && iban !== undefined) newContract.billing.bank_account_number = iban;
  }

  if (offerV2 && offerV2.length) {
    newContract.offer = offerV2;
  } else if (offer && !isEmpty(offer)) {
    newContract.offer = [offer];
  }

  return newContract;
};

/**
 * Get contracts and parties from subscriptions or transform.
 * Get parties from covered and subscriptions or transform
 */
const getContractsAndPartiesFromQuotation = (item, offerV2) => {
  let contracts = [];
  const { contracts: contractsIds = [], subscriptions } = item;
  const { covereds, parties } = getCoveredAndPartiesFromQuotation(item);

  if (subscriptions && subscriptions.length) {
    contracts = subscriptions.map((sub, idx) => {
      const { subscriber, addresses, phone, email, iban, party: { name } = {} } = sub;
      let refParty;

      if (subscriber < 0 && (name || phone || email || (addresses && addresses.length))) {
        refParty = `party${parties.length + 1}`;
        parties.push(createParty(sub, refParty));
      } else {
        refParty = get(parties, `[${subscriber}].ref`);
        if (addresses) set(parties, `[${subscriber}].addresses`, patchAddressesWithCountry(addresses));
        if (iban !== null && iban !== undefined) set(parties, `[${subscriber}].bank_accounts`, [{ number: iban }]);
      }

      return createContract(
        item,
        sub,
        `contract${idx + 1}`,
        refParty,
        [covereds[idx]],
        contractsIds[0],
        get(offerV2, idx)
      );
    });
  } else {
    const { transform, transform: { subscriber, addresses, party, iban } = {} } = item;
    let refParty;

    if (subscriber >= 0) {
      refParty = get(parties, `[${subscriber}].ref`);
      if (addresses) set(parties, `[${subscriber}].addresses`, patchAddressesWithCountry(addresses));
      if (iban !== null && iban !== undefined) set(parties, `[${subscriber}].bank_accounts`, [{ number: iban }]);
    } else if (party) {
      refParty = `party${parties.length + 1}`;
      parties.push(createParty(transform, refParty));
    }

    contracts.push(createContract(item, transform, 'contract1', refParty, covereds, contractsIds[0], get(offerV2, 0)));
  }

  return { contracts, parties };
};

/**
 * Create a loan object with increments if available
 */
const createLoan =
  releaseDate =>
  ({ amount, rate, increments, ...loan }, idx) => {
    const newLoan = omit(
      {
        ...loan,
        amount: `${amount}`,
        rate: `${rate}`,
        ref: `loan${idx + 1}`,
        funds_release_date: releaseDate,
      },
      'release_date'
    );

    if (increments)
      newLoan.increments = increments.map(incr => ({
        ...incr,
        number_of_payments: parseFloat(get(incr, 'number_of_payments', 0)),
        payment_amount: `${get(incr, 'payment_amount')}`,
      }));

    return newLoan;
  };

const getLoanFromQuotation = ({ release_date: releaseDate, loan = [] }) => loan.map(createLoan(releaseDate));

/**
 * Transform a Quotation to a SalesRoute
 * Will get all fields of a SalesRoute
 * Will build contracts and parties from quotation
 * Will transform loan to loans.
 *
 * @param {object} item Quotation
 * @param {object} offerV2 OfferV2
 * @return {object} SalesRoute
 */
const getSalesRouteFromQuotation = (item, offerV2) => {
  try {
    const { broker, id, quote_status: status, createdOn, writeDate } = item;
    const { contracts, parties } = getContractsAndPartiesFromQuotation(item, offerV2);

    const salesroute = {
      title: id,
      kind: 'quotation',
      contracts,
      loans: getLoanFromQuotation(item),
      options: {
        auto_remove_not_subscriptable: true,
        decline_non_eligible: true,
        // premium_summary_kind: 'first_invoice',
        fast_forward: true,
        start_process: true,
      },
      parties,
      status: get(STATUS_MAPPING_TO_SALESROUTE, status, STATUS_MAPPING_TO_SALESROUTE.default),
      dist_network: broker,
      // distribution_channel: { code: 'web' },
      createdAt: moment(createdOn).utc().format(),
      updatedAt: moment(writeDate || createdOn)
        .utc()
        .format(),
    };

    return salesroute;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }

  return {};
};

module.exports = { getSalesRouteFromQuotation };
