import {
  validateInterval,
  createDrawState,
  drawNumber,
  undrawNumber,
  remainingCount,
  isExhausted,
  runRollingAnimation,
} from './draw-logic.js';
import { createDrawController } from './control-shared.js';

const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');

let drawState = null;

function getSelectedSpeed() {
  const checked = document.querySelector('input[name="speed"]:checked');
  return checked ? checked.value : 'medium';
}

function getSelectedTheme() {
  const checked = document.querySelector('input[name="theme"]:checked');
  return checked ? checked.value : 'dark';
}

createDrawController({
  channelName: 'loddtrekning-nummer',
  displayUrl: 'visning.html?mode=nummer',
  windowName: 'loddtrekningVisningNummer',
  elements: {
    drawButton: document.getElementById('drawButton'),
    resetButton: document.getElementById('resetButton'),
    errorMessage: document.getElementById('errorMessage'),
    historyList: document.getElementById('historyList'),
    remainingCountEl: document.getElementById('remainingCount'),
    newWindowCheckbox: document.getElementById('newWindowCheckbox'),
    inlineDisplay: document.getElementById('inlineDisplay'),
    inlineNumber: document.getElementById('inlineNumber'),
  },
  getSelectedSpeed,
  getSelectedTheme,
  exhaustedMessage: 'Alle numre i intervallet er trukket.',
  ensureState(showError) {
    if (drawState) {
      return true;
    }
    const result = validateInterval(fromInput.value, toInput.value);
    if (!result.valid) {
      showError(result.error);
      return false;
    }
    drawState = createDrawState(result.from, result.to);
    fromInput.disabled = true;
    toInput.disabled = true;
    showError('');
    return true;
  },
  getState: () => drawState,
  isExhausted,
  remainingCount,
  performDraw: (state) => drawNumber(state),
  undoDraw: (state, number) => undrawNumber(state, number),
  buildDrawMessage: (state, number) => ({
    from: state.from,
    to: state.to,
    finalNumber: number,
  }),
  formatHistoryEntry: (number) => String(number),
  runInlineAnimation(state, number, speed, inlineNumber, onComplete) {
    runRollingAnimation({
      from: state.from,
      to: state.to,
      finalNumber: number,
      speed,
      onTick: (n) => {
        inlineNumber.textContent = String(n);
      },
      onComplete: (n) => {
        inlineNumber.textContent = String(n);
        onComplete();
      },
    });
  },
  resetExtra() {
    drawState = null;
    fromInput.disabled = false;
    toInput.disabled = false;
  },
});
