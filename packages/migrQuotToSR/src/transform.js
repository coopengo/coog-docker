/**
 * Add fields with value to object if value is not null or undefined
 * @param {object} obj Object to add fields to
 * @param {array} listFields Array of objects with key name and value for each field to add
 * @return {object} Object with fields and value added
 */
const addFieldsToObject = (obj, listFields) => {
  const newObj = { ...obj };

  listFields.forEach(({ name, value }) => {
    if (value !== null && value !== undefined) {
      newObj[name] = value;
    }
  });

  return newObj;
};

module.exports = { addFieldsToObject };
