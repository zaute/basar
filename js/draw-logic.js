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

export function createDrawState(from, to) {
  return { from, to, drawnNumbers: new Set() };
}

export function remainingCount(state) {
  return state.to - state.from + 1 - state.drawnNumbers.size;
}

export function isExhausted(state) {
  return remainingCount(state) <= 0;
}

export function drawNumber(state) {
  if (isExhausted(state)) {
    throw new Error('Alle numre i intervallet er allerede trukket.');
  }
  const remaining = [];
  for (let n = state.from; n <= state.to; n++) {
    if (!state.drawnNumbers.has(n)) {
      remaining.push(n);
    }
  }
  const index = Math.floor(Math.random() * remaining.length);
  const number = remaining[index];
  state.drawnNumbers.add(number);
  return number;
}
