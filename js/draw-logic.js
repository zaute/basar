export function validateInterval(fromInput, toInput) {
  const from = Number(fromInput);
  const to = Number(toInput);
  const fromIsValid = fromInput !== '' && Number.isInteger(from);
  const toIsValid = toInput !== '' && Number.isInteger(to);

  if (!fromIsValid || !toIsValid) {
    return { valid: false, error: 'Fra og til må være hele tall.' };
  }
  if (from > to) {
    return {
      valid: false,
      error: '"Fra og med" må være mindre enn eller lik "til og med".',
    };
  }
  return { valid: true, from, to };
}
