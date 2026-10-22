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
} from './draw-logic.js';
import { createDrawController } from './control-shared.js';

const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const bookCountInput = document.getElementById('bookCountInput');

let drawState = null;
let rangeFrom = 0;
let rangeTo = 0;
let bookCount = 0;

function getSelectedSpeed() {
  const checked = document.querySelector('input[name="speed"]:checked');
  return checked ? checked.value : 'medium';
}

function getSelectedTheme() {
  const checked = document.querySelector('input[name="theme"]:checked');
  return checked ? checked.value : 'dark';
}

function getSelectedEffects() {
  return document.getElementById('effectsInput').checked;
}

createDrawController({
  channelName: 'loddtrekning-bok',
  displayUrl: 'visning.html?mode=bok',
  windowName: 'loddtrekningVisningBok',
  elements: {
    drawButton: document.getElementById('drawButton'),
    resetButton: document.getElementById('resetButton'),
    errorMessage: document.getElementById('errorMessage'),
    historyList: document.getElementById('historyList'),
    remainingCountEl: document.getElementById('remainingCount'),
  },
  getSelectedSpeed,
  getSelectedTheme,
  getSelectedEffects,
  exhaustedMessage: 'Alle bok- og nummerkombinasjoner er trukket.',
  ensureState(showError) {
    if (drawState) {
      return true;
    }
    const intervalResult = validateInterval(fromInput.value, toInput.value);
    if (!intervalResult.valid) {
      showError(intervalResult.error);
      return false;
    }
    const countResult = validateBookCount(bookCountInput.value);
    if (!countResult.valid) {
      showError(countResult.error);
      return false;
    }
    rangeFrom = intervalResult.from;
    rangeTo = intervalResult.to;
    bookCount = countResult.count;
    const rangeSize = rangeTo - rangeFrom + 1;
    const totalCombos = bookCount * rangeSize;
    drawState = createDrawState(0, totalCombos - 1);
    fromInput.disabled = true;
    toInput.disabled = true;
    bookCountInput.disabled = true;
    showError('');
    return true;
  },
  getState: () => drawState,
  isExhausted,
  remainingCount,
  performDraw(state) {
    const index = drawNumber(state);
    return decodeBookDraw(index, rangeFrom, rangeTo);
  },
  undoDraw(state, result) {
    const index = encodeBookDraw(result.book, result.number, rangeFrom, rangeTo);
    undrawNumber(state, index);
  },
  buildDrawMessage: (state, result) => ({
    bookFrom: 1,
    bookTo: bookCount,
    finalBook: result.book,
    numberFrom: rangeFrom,
    numberTo: rangeTo,
    finalNumber: result.number,
  }),
  formatHistoryEntry: (result) => `${result.book}-${result.number}`,
  resetExtra() {
    drawState = null;
    rangeFrom = 0;
    rangeTo = 0;
    bookCount = 0;
    fromInput.disabled = false;
    toInput.disabled = false;
    bookCountInput.disabled = false;
  },
});
