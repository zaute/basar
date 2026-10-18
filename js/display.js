import { runRollingAnimation } from './draw-logic.js';

const displayRoot = document.getElementById('displayRoot');
const numberDisplay = document.getElementById('numberDisplay');
const historyList = document.getElementById('historyList');

const channel = new BroadcastChannel('loddtrekning');

// The final number is already decided by the control panel; we only delay
// *showing* the rolling animation until the person at this window triggers
// it with a click or the space bar (e.g. for suspense on a projector) —
// unless this window itself requested the draw, in which case it plays
// immediately since the click already happened.
let pendingDraw = null;
let awaitingOwnDraw = false;

function showPrompt() {
  numberDisplay.textContent = 'Klikk eller trykk mellomrom for å trekke';
  numberDisplay.classList.add('prompt');
}

function clearPrompt() {
  numberDisplay.classList.remove('prompt');
}

function addHistoryEntry(number) {
  const item = document.createElement('li');
  item.textContent = String(number);
  historyList.prepend(item);
}

function renderHistory(history) {
  historyList.innerHTML = '';
  for (const number of history) {
    addHistoryEntry(number);
  }
}

function runDraw(message) {
  clearPrompt();
  numberDisplay.textContent = '\u00A0';
  runRollingAnimation({
    from: message.from,
    to: message.to,
    finalNumber: message.finalNumber,
    speed: message.speed,
    onTick: (n) => {
      numberDisplay.textContent = String(n);
    },
    onComplete: (n) => {
      numberDisplay.textContent = String(n);
      addHistoryEntry(n);
    },
  });
}

function startPendingDraw() {
  if (pendingDraw) {
    const message = pendingDraw;
    pendingDraw = null;
    runDraw(message);
    return;
  }

  // No draw is waiting to be revealed, so this click/space press is a
  // request to draw a brand-new number from within this window.
  awaitingOwnDraw = true;
  channel.postMessage({ type: 'request-draw' });
}

channel.onmessage = (event) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === 'sync') {
    renderHistory(message.history);
    return;
  }

  if (message.type === 'reset') {
    pendingDraw = null;
    awaitingOwnDraw = false;
    clearPrompt();
    numberDisplay.textContent = '\u00A0';
    historyList.innerHTML = '';
    return;
  }

  if (message.type !== 'draw') {
    return;
  }

  displayRoot.className = `display theme-${message.theme}`;

  if (awaitingOwnDraw) {
    awaitingOwnDraw = false;
    runDraw(message);
    return;
  }

  pendingDraw = message;
  showPrompt();
};

document.addEventListener('click', () => {
  startPendingDraw();
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    startPendingDraw();
  }
});

channel.postMessage({ type: 'request-sync' });
