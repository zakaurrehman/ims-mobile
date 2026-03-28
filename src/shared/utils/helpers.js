// Pure helpers — no React, no Next.js — copied from ims-main/utils/utils.js

export const sortArr = (arr, key) => {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) =>
    (a[key] || '').toString().localeCompare((b[key] || '').toString())
  );
};

export const getD = (array, value, item) => {
  const tmp = array.filter((x) => x.id === value[item]).length
    ? array.find((x) => x.id === value[item])[item]
    : '';
  return tmp;
};

export const validate = (value, fields) => {
  let errors = fields
    .map((x) =>
      value[x] === '' || value[x] === null ? { [x]: true } : { [x]: false }
    )
    .reduce((obj, item) => ({ ...obj, ...item }), {});

  if (fields.includes('date')) {
    errors =
      !value.dateRange?.startDate
        ? { ...errors, date: true }
        : { ...errors, date: false };
  }

  return errors;
};

export const filteredArray = (arr, dateSelect) => {
  if (!dateSelect?.start || !dateSelect?.end) return arr;
  return arr.filter((x) => {
    if (!x.date) return false;
    return x.date >= dateSelect.start && x.date <= dateSelect.end;
  });
};

export const formatCurrency = (amount, currency = 'USD') => {
  let safeCurrency = 'USD';
  try { if (currency && new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0)) safeCurrency = currency; } catch { /* invalid currency */ }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
};

// Lookup name from settings array — matches web app's gQ helper
// settings structure: settings.Supplier.Supplier = [{ id, nname, ... }]
export const getName = (settings, category, id, field = 'nname') => {
  try {
    const arr = settings?.[category]?.[category];
    if (!Array.isArray(arr)) return id || '';
    return arr.find((x) => x.id === id)?.[field] || id || '';
  } catch {
    return id || '';
  }
};
