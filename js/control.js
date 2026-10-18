import {
  validateInterval,
  createDrawState,
  drawNumber,
  undrawNumber,
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
let isDrawing = false;
// Set while waiting for the display window to confirm it actually showed a
// draw. If the window is closed before that happens, the draw is rolled
// back instead of silently counting as "drawn".
let pendingFinalize = null;
let closeWatcherId = null;

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
  if (isDrawing) {
    return;
  }
  if (!ensureState()) {
    return;
  }
  if (isExhausted(drawState)) {
    showError('Alle numre i intervallet er allerede trukket.');
    drawButton.disabled = true;
    return;
  }

  // Lock out further draws immediately, synchronously, before any await -
  // otherwise several rapid clicks can all pass the isDrawing check above
  // while the first call is still waiting on the display window to open.
  isDrawing = true;
  drawButton.disabled = true;

  await openDisplayWindowIfNeeded();

  if (newWindowCheckbox.checked && (!displayWindow || displayWindow.closed)) {
    // openDisplayWindowIfNeeded() already showed an error (e.g. popup
    // blocked); don't consume a number for a draw nobody can see.
    isDrawing = false;
    drawButton.disabled = false;
    return;
  }

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

    isDrawing = false;
    if (isExhausted(drawState)) {
      drawButton.disabled = true;
      showError('Alle numre i intervallet er trukket.');
    } else {
      drawButton.disabled = false;
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
    // The display window shows/animates the draw itself (possibly after a
    // click/space reveal gesture); we only finalize once it confirms the
    // draw actually completed there, or roll back if the window is closed
    // before that happens.
    pendingFinalize = finalizeDraw;
    closeWatcherId = setInterval(() => {
      if (displayWindow && displayWindow.closed) {
        clearInterval(closeWatcherId);
        closeWatcherId = null;
        pendingFinalize = null;
        undrawNumber(drawState, number);
        isDrawing = false;
        drawButton.disabled = false;
        showError(
          'Visningsvinduet ble lukket før trekningen ble vist. Trukket tall ble ikke talt - prøv igjen.',
        );
      }
    }, 300);
  }
}

drawButton.addEventListener('click', handleDraw);

function resetAll() {
  drawState = null;
  historyNumbers = [];
  isDrawing = false;
  if (closeWatcherId) {
    clearInterval(closeWatcherId);
    closeWatcherId = null;
  }
  pendingFinalize = null;
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
  } else if (message.type === 'draw-complete') {
    if (pendingFinalize) {
      if (closeWatcherId) {
        clearInterval(closeWatcherId);
        closeWatcherId = null;
      }
      const finalize = pendingFinalize;
      pendingFinalize = null;
      finalize();
    }
  } else if (message.type === 'request-sync') {
    channel.postMessage({
      type: 'sync',
      history: historyNumbers.slice(),
      remaining: drawState ? remainingCount(drawState) : null,
    });
  }
};
