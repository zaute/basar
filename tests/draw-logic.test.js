import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInterval,
  validateBookCount,
  createDrawState,
  drawNumber,
  undrawNumber,
  decodeBookDraw,
  encodeBookDraw,
  remainingCount,
  isExhausted,
  runRollingAnimation,
  runBookDrawAnimation,
} from '../js/draw-logic.js';

test('validateInterval accepts a valid interval', () => {
  const result = validateInterval('1', '10');
  assert.deepEqual(result, { valid: true, from: 1, to: 10 });
});

test('validateInterval rejects non-numeric input', () => {
  const result = validateInterval('abc', '10');
  assert.equal(result.valid, false);
  assert.match(result.error, /hele tall/);
});

test('validateInterval rejects empty input', () => {
  const result = validateInterval('', '10');
  assert.equal(result.valid, false);
  assert.match(result.error, /hele tall/);
});

test('validateInterval rejects from greater than to', () => {
  const result = validateInterval('10', '1');
  assert.equal(result.valid, false);
  assert.match(result.error, /mindre enn/);
});

test('validateInterval accepts from equal to to', () => {
  const result = validateInterval('5', '5');
  assert.deepEqual(result, { valid: true, from: 5, to: 5 });
});

test('createDrawState tracks the interval with no numbers drawn yet', () => {
  const state = createDrawState(1, 3);
  assert.equal(remainingCount(state), 3);
  assert.equal(isExhausted(state), false);
});

test('drawNumber never repeats a number until the interval is exhausted', () => {
  const state = createDrawState(1, 3);
  const drawn = new Set();
  drawn.add(drawNumber(state));
  drawn.add(drawNumber(state));
  drawn.add(drawNumber(state));

  assert.equal(drawn.size, 3);
  assert.deepEqual([...drawn].sort(), [1, 2, 3]);
  assert.equal(remainingCount(state), 0);
  assert.equal(isExhausted(state), true);
});

test('drawNumber throws once the interval is exhausted', () => {
  const state = createDrawState(1, 1);
  drawNumber(state);
  assert.throws(() => drawNumber(state), /allerede trukket/);
});

test('undrawNumber puts a drawn number back into the pool', () => {
  const state = createDrawState(1, 3);
  const number = drawNumber(state);
  assert.equal(remainingCount(state), 2);

  undrawNumber(state, number);
  assert.equal(remainingCount(state), 3);
  assert.equal(isExhausted(state), false);
});

test('runRollingAnimation ticks random numbers then completes with the final number', () => {
  let fakeNow = 0;
  let tickCallback;
  const ticks = [];
  let completedWith = null;
  let cleared = false;

  const fakeSetInterval = (callback) => {
    tickCallback = callback;
    return 'fake-interval-id';
  };
  const fakeClearInterval = (id) => {
    assert.equal(id, 'fake-interval-id');
    cleared = true;
  };

  runRollingAnimation({
    from: 1,
    to: 10,
    finalNumber: 7,
    speed: 'fast',
    onTick: (n) => ticks.push(n),
    onComplete: (n) => {
      completedWith = n;
    },
    setIntervalFn: fakeSetInterval,
    clearIntervalFn: fakeClearInterval,
    now: () => fakeNow,
  });

  fakeNow += 100;
  tickCallback();
  assert.equal(ticks.length, 1);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  tickCallback();
  assert.equal(completedWith, 7);
  assert.equal(cleared, true);
});

test('runRollingAnimation rejects an unknown speed', () => {
  assert.throws(
    () =>
      runRollingAnimation({
        from: 1,
        to: 10,
        finalNumber: 7,
        speed: 'ludicrous',
        onTick: () => {},
        onComplete: () => {},
      }),
    /ukjent hastighet/i,
  );
});

test('validateBookCount accepts a positive integer', () => {
  const result = validateBookCount('5');
  assert.deepEqual(result, { valid: true, count: 5 });
});

test('validateBookCount rejects zero', () => {
  const result = validateBookCount('0');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('validateBookCount rejects non-numeric input', () => {
  const result = validateBookCount('abc');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('validateBookCount rejects empty input', () => {
  const result = validateBookCount('');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('decodeBookDraw maps index 0 to the first book and the lowest number', () => {
  assert.deepEqual(decodeBookDraw(0, 1, 100), { book: 1, number: 1 });
});

test('decodeBookDraw maps the last index to the last book and the highest number', () => {
  // 3 books, range 1-100 => rangeSize 100, totalCombos 300, last index 299
  assert.deepEqual(decodeBookDraw(299, 1, 100), { book: 3, number: 100 });
});

test('decodeBookDraw wraps to the next book at a range boundary', () => {
  // rangeSize 100 (1-100): index 99 is book 1 number 100, index 100 is book 2 number 1
  assert.deepEqual(decodeBookDraw(99, 1, 100), { book: 1, number: 100 });
  assert.deepEqual(decodeBookDraw(100, 1, 100), { book: 2, number: 1 });
});

test('encodeBookDraw is the inverse of decodeBookDraw', () => {
  for (const index of [0, 1, 99, 100, 299]) {
    const { book, number } = decodeBookDraw(index, 1, 100);
    assert.equal(encodeBookDraw(book, number, 1, 100), index);
  }
});

test('runBookDrawAnimation rolls the book first, then the number, then completes', () => {
  let fakeNow = 0;
  const callbacks = [];
  const bookTicks = [];
  const numberTicks = [];
  let completedWith = null;

  const fakeSetInterval = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  const fakeClearInterval = () => {};

  runBookDrawAnimation({
    bookFrom: 1,
    bookTo: 3,
    finalBook: 2,
    numberFrom: 1,
    numberTo: 100,
    finalNumber: 42,
    speed: 'fast',
    onBookTick: (book) => bookTicks.push(book),
    onNumberTick: (number) => numberTicks.push(number),
    onComplete: (book, number) => {
      completedWith = { book, number };
    },
    setIntervalFn: fakeSetInterval,
    clearIntervalFn: fakeClearInterval,
    now: () => fakeNow,
  });

  // First interval registered is the book-rolling phase.
  assert.equal(callbacks.length, 1);

  // Tick the book phase once (still rolling), then let it finish.
  fakeNow += 100;
  callbacks[0]();
  assert.equal(bookTicks.length, 1);
  assert.equal(numberTicks.length, 0);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  callbacks[0]();
  // Book phase is done; the number phase should now have registered its
  // own interval.
  assert.equal(callbacks.length, 2);
  assert.equal(completedWith, null);

  // Tick the number phase once (still rolling), then let it finish.
  fakeNow = 0;
  fakeNow += 100;
  callbacks[1]();
  assert.equal(numberTicks.length, 1);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  callbacks[1]();
  assert.deepEqual(completedWith, { book: 2, number: 42 });
});
