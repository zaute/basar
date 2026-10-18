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

export function validateBookCount(countInput) {
  const count = Number(countInput);
  const countIsValid =
    countInput !== '' && Number.isInteger(count) && count >= 1;

  if (!countIsValid) {
    return { valid: false, error: 'Antall bøker må være et helt tall større enn 0.' };
  }
  return { valid: true, count };
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

// Puts a drawn number back into the pool. Used when a draw couldn't be
// completed/confirmed (e.g. the display window was closed before it could
// show the result), so the number can be drawn again later instead of
// being permanently lost.
export function undrawNumber(state, number) {
  state.drawnNumbers.delete(number);
}

// A book-draw combines a book number and a number-within-the-book into a
// single combined index, so the existing draw-without-replacement logic
// (createDrawState/drawNumber/undrawNumber) can be reused unchanged by
// treating the whole book x number space as one flat interval
// [0, bookCount * rangeSize - 1]. These two functions translate between a
// combined index and the { book, number } pair people actually care about.
// Books are numbered starting at 1.
export function decodeBookDraw(index, from, to) {
  const rangeSize = to - from + 1;
  const book = Math.floor(index / rangeSize) + 1;
  const number = from + (index % rangeSize);
  return { book, number };
}

export function encodeBookDraw(book, number, from, to) {
  const rangeSize = to - from + 1;
  return (book - 1) * rangeSize + (number - from);
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
  // Captured lazily on the first tick (rather than at setup time) so that
  // chained animations (e.g. runBookDrawAnimation's number phase, started
  // from within the book phase's onComplete) measure elapsed time from
  // when they actually start ticking.
  let startTime = null;

  const intervalId = setIntervalFn(() => {
    if (startTime === null) {
      startTime = now();
    }
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

// Plays the book-rolling animation to completion, then plays the
// number-rolling animation to completion, then calls onComplete with both
// final values. Reuses runRollingAnimation for each phase instead of
// duplicating the timing logic.
export function runBookDrawAnimation({
  bookFrom,
  bookTo,
  finalBook,
  numberFrom,
  numberTo,
  finalNumber,
  speed,
  onBookTick,
  onNumberTick,
  onComplete,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = Date.now,
}) {
  runRollingAnimation({
    from: bookFrom,
    to: bookTo,
    finalNumber: finalBook,
    speed,
    onTick: onBookTick,
    onComplete: (book) => {
      runRollingAnimation({
        from: numberFrom,
        to: numberTo,
        finalNumber,
        speed,
        onTick: onNumberTick,
        onComplete: (number) => {
          onComplete(book, number);
        },
        setIntervalFn,
        clearIntervalFn,
        now,
      });
    },
    setIntervalFn,
    clearIntervalFn,
    now,
  });
}
