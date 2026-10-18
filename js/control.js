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
const resetButton = document.getElementById('resetButton');
const errorMessage = document.getElementById('errorMessage');
const historyList = document.getElementById('historyList');
const remainingCountEl = document.getElementById('remainingCount');
const newWindowCheckbox = document.getElementById('newWindowCheckbox');
const inlineDisplay = document.getElementById('inlineDisplay');
const inlineNumber = document.getElementById('inlineNumber');

const channel = new BroadcastChannel('loddtrekning');

let drawState = null;
let displayWindow = null;
let historyNumbers = [];

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
    return Promise.resolve();
  }
  if (displayWindow && !displayWindow.closed) {
    return Promise.resolve();
  }
  displayWindow = window.open('trekning.html', 'loddtrekningVisning');
  if (!displayWindow) {
    showError(
      'Kunne ikke åpne visningsvindu. Sjekk at nettleseren ikke blokkerer popup-vinduer.',
    );
    return Promise.resolve();
  }
  // Wait for the new window to load before posting to the BroadcastChannel,
  // otherwise its listener isn't registered yet and the first draw is lost.
  return new Promise((resolve) => {
    displayWindow.addEventListener('load', () => resolve(), { once: true });
  });
}

async function handleDraw() {
  if (!ensureState()) {
    return;
  }
  if (isExhausted(drawState)) {
    showError('Alle numre i intervallet er allerede trukket.');
    drawButton.disabled = true;
    return;
  }

  await openDisplayWindowIfNeeded();

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
    historyNumbers.push(number);
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

function resetAll() {
  drawState = null;
  historyNumbers = [];
  fromInput.disabled = false;
  toInput.disabled = false;
  drawButton.disabled = false;
  historyList.innerHTML = '';
  remainingCountEl.textContent = '—';
  showError('');
  inlineDisplay.hidden = true;
  inlineNumber.textContent = '\u00A0';
  channel.postMessage({ type: 'reset' });
}

resetButton.addEventListener('click', resetAll);

// The display window can also trigger draws/reset and asks for a history
// snapshot on load; the control panel stays the single source of truth for
// the interval/settings and the set of drawn numbers.
channel.onmessage = (event) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === 'request-draw') {
    handleDraw();
  } else if (message.type === 'request-reset') {
    resetAll();
  } else if (message.type === 'request-sync') {
    channel.postMessage({
      type: 'sync',
      history: historyNumbers.slice(),
      remaining: drawState ? remainingCount(drawState) : null,
    });
  }
};
