import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInterval,
  createDrawState,
  drawNumber,
  remainingCount,
  isExhausted,
  runRollingAnimation,
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
