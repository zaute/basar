import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterval } from '../js/draw-logic.js';

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
