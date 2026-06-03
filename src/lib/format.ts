export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(value);

export const generateToken = () =>
  Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join('-');
