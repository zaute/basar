import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInterval,
  createDrawState,
  drawNumber,
  remainingCount,
  isExhausted,
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
