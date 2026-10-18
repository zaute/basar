import {
  validateInterval,
  createDrawState,
  drawNumber,
  remainingCount,
  isExhausted,
  runRollingAnimation,
} from './draw-logic.js';

const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const drawButton = document.getElementById('drawButton');
const errorMessage = document.getElementById('errorMessage');
const historyList = document.getElementById('historyList');
const remainingCountEl = document.getElementById('remainingCount');
const newWindowCheckbox = document.getElementById('newWindowCheckbox');
const inlineDisplay = document.getElementById('inlineDisplay');
const inlineNumber = document.getElementById('inlineNumber');

const channel = new BroadcastChannel('loddtrekning');

let drawState = null;
let displayWindow = null;

function getSelectedSpeed() {
  const checked = document.querySelector('input[name="speed"]:checked');
  return checked ? checked.value : 'medium';
}

function getSelectedTheme() {
  const checked = document.querySelector('input[name="theme"]:checked');
  return checked ? checked.value : 'dark';
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function ensureState() {
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
}

function addHistoryEntry(number) {
  const item = document.createElement('li');
  item.textContent = String(number);
  historyList.prepend(item);
}

function updateRemainingCount() {
  remainingCountEl.textContent = String(remainingCount(drawState));
}

function openDisplayWindowIfNeeded() {
  if (!newWindowCheckbox.checked) {
    return;
  }
  if (displayWindow && !displayWindow.closed) {
    return;
  }
  displayWindow = window.open('trekning.html', 'loddtrekningVisning');
}

function handleDraw() {
  if (!ensureState()) {
    return;
  }
  if (isExhausted(drawState)) {
    showError('Alle numre i intervallet er allerede trukket.');
    drawButton.disabled = true;
    return;
  }

  openDisplayWindowIfNeeded();

  const number = drawNumber(drawState);
  const speed = getSelectedSpeed();
  const theme = getSelectedTheme();

  channel.postMessage({
    type: 'draw',
    from: drawState.from,
    to: drawState.to,
    finalNumber: number,
    speed,
    theme,
  });

  function finalizeDraw() {
    addHistoryEntry(number);
    updateRemainingCount();

    if (isExhausted(drawState)) {
      drawButton.disabled = true;
      showError('Alle numre i intervallet er trukket.');
    }
  }

  if (!newWindowCheckbox.checked) {
    inlineDisplay.hidden = false;
    inlineDisplay.className = `display theme-${theme}`;
    runRollingAnimation({
      from: drawState.from,
      to: drawState.to,
      finalNumber: number,
      speed,
      onTick: (n) => {
        inlineNumber.textContent = String(n);
      },
      onComplete: (n) => {
        inlineNumber.textContent = String(n);
        finalizeDraw();
      },
    });
  } else {
    runRollingAnimation({
      from: drawState.from,
      to: drawState.to,
      finalNumber: number,
      speed,
      onTick: () => {},
      onComplete: finalizeDraw,
    });
  }
}

drawButton.addEventListener('click', handleDraw);
