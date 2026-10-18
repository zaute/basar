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

export const ANIMATION_SPEEDS = {
  slow: { tickMs: 160, totalMs: 3000 },
  medium: { tickMs: 90, totalMs: 1600 },
  fast: { tickMs: 45, totalMs: 800 },
};

export function runRollingAnimation({
  from,
  to,
  finalNumber,
  speed,
  onTick,
  onComplete,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = Date.now,
}) {
  const settings = ANIMATION_SPEEDS[speed];
  if (!settings) {
    throw new Error(`Ukjent hastighet: ${speed}`);
  }
  const { tickMs, totalMs } = settings;
  const startTime = now();

  const intervalId = setIntervalFn(() => {
    const elapsed = now() - startTime;
    if (elapsed >= totalMs) {
      clearIntervalFn(intervalId);
      onComplete(finalNumber);
      return;
    }
    const randomNumber = Math.floor(Math.random() * (to - from + 1)) + from;
    onTick(randomNumber);
  }, tickMs);

  return intervalId;
}
