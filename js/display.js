import { runRollingAnimation, runBookDrawAnimation } from './draw-logic.js';

const mode = new URLSearchParams(location.search).get('mode') === 'bok'
  ? 'bok'
  : 'nummer';

const displayRoot = document.getElementById('displayRoot');
const numberDisplay = document.getElementById('numberDisplay');
const historyList = document.getElementById('historyList');

const channel = new BroadcastChannel(
  mode === 'bok' ? 'loddtrekning-bok' : 'loddtrekning-nummer',
);

// The final result is already decided by the control panel; we only delay
// *showing* the rolling animation until the person at this window triggers
// it with a click or the space bar (e.g. for suspense on a projector) —
// unless this window itself requested the draw, in which case it plays
// immediately since the click already happened.
let pendingDraw = null;
let awaitingOwnDraw = false;
let isAnimating = false;

function showPrompt() {
  numberDisplay.textContent = 'Klikk eller trykk mellomrom for å trekke';
  numberDisplay.classList.add('prompt');
}

function clearPrompt() {
  numberDisplay.classList.remove('prompt');
}

function formatEntry(entry) {
  if (mode === 'bok') {
    return `${entry.book}-${entry.number}`;
  }
  return String(entry);
}

function addHistoryEntry(entry) {
  const item = document.createElement('li');
  item.textContent = formatEntry(entry);
  historyList.prepend(item);
}

function renderHistory(history) {
  historyList.innerHTML = '';
  for (const entry of history) {
    addHistoryEntry(entry);
  }
}

function runDraw(message) {
  isAnimating = true;
  clearPrompt();
  numberDisplay.textContent = '\u00A0';

  if (mode === 'bok') {
    runBookDrawAnimation({
      bookFrom: message.bookFrom,
      bookTo: message.bookTo,
      finalBook: message.finalBook,
      numberFrom: message.numberFrom,
      numberTo: message.numberTo,
      finalNumber: message.finalNumber,
      speed: message.speed,
      onBookTick: (book) => {
        numberDisplay.textContent = `Bok ${book}`;
      },
      onNumberTick: (number) => {
        numberDisplay.textContent = `Bok ${message.finalBook} — nummer ${number}`;
      },
      onComplete: (book, number) => {
        numberDisplay.textContent = `Bok ${book} — nummer ${number}`;
        addHistoryEntry({ book, number });
        isAnimating = false;
        channel.postMessage({ type: 'draw-complete' });
      },
    });
    return;
  }

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
      isAnimating = false;
      channel.postMessage({ type: 'draw-complete' });
    },
  });
}

function startPendingDraw() {
  if (isAnimating) {
    return;
  }

  if (pendingDraw) {
    const message = pendingDraw;
    pendingDraw = null;
    runDraw(message);
    return;
  }

  // No draw is waiting to be revealed, so this click/space press is a
  // request to draw a brand-new result from within this window.
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
    isAnimating = false;
    clearPrompt();
    numberDisplay.textContent = '\u00A0';
    historyList.innerHTML = '';
    return;
  }

  if (message.type !== 'draw') {
    return;
  }

  if (isAnimating) {
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
