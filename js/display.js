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

const FIREWORKS_DURATION_MS = 5000;
const ROCKET_FLIGHT_MS = 900;
const LAUNCH_INTERVAL_MIN_MS = 350;
const LAUNCH_INTERVAL_MAX_MS = 750;
const BURST_PARTICLE_COUNT = 40;
const FIREWORK_COLORS = ['#d4af37', '#fff8dc', '#ff6b6b', '#4dd4ff', '#8aff8a', '#ff8ad4'];

// Timeout ids for any in-flight fireworks schedule, so a reset can cancel
// a show that's still running instead of leaving it to finish on its own.
let fireworksTimeoutIds = [];

function randomColor() {
  return FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
}

// A burst of particles exploding outward from a single screen point (plus
// a quick shockwave ring), used for each firework's "pop" at the top of
// its flight.
function burst(x, y) {
  const container = document.createElement('div');
  container.className = 'explosion';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;

  const ring = document.createElement('span');
  ring.className = 'shockwave';
  ring.style.borderColor = randomColor();
  container.appendChild(ring);

  const maxDistance = 150 + Math.random() * 180;
  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    const angle = (Math.PI * 2 * i) / BURST_PARTICLE_COUNT + Math.random() * 0.4;
    const distance = maxDistance * (0.5 + Math.random() * 0.6);
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    const size = 10 + Math.random() * 10;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.background = randomColor();
    container.appendChild(particle);
  }
  document.body.appendChild(container);
  container.addEventListener('animationend', () => container.remove(), {
    once: true,
  });
  // Safety net in case animationend doesn't fire for some reason.
  setTimeout(() => container.remove(), 1800);
}

// A single rocket rising from the bottom of the screen to a random point,
// then popping into a burst there.
function launchRocket() {
  const rocket = document.createElement('div');
  rocket.className = 'firework-rocket';
  const xVw = 10 + Math.random() * 80;
  const targetYVh = 100 - (15 + Math.random() * 45);
  rocket.style.left = `${xVw}vw`;
  rocket.style.setProperty('--rocket-color', randomColor());
  document.body.appendChild(rocket);

  // Start at the bottom, then trigger the transition to the target height
  // on the next frame so the browser registers the starting position
  // first instead of jumping straight there.
  rocket.style.bottom = '0';
  requestAnimationFrame(() => {
    rocket.style.transition = `bottom ${ROCKET_FLIGHT_MS}ms ease-out`;
    rocket.style.bottom = `${100 - targetYVh}vh`;
  });

  rocket.addEventListener(
    'transitionend',
    () => {
      const rect = rocket.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      rocket.remove();
    },
    { once: true },
  );
  // Safety net in case transitionend doesn't fire for some reason.
  setTimeout(() => rocket.remove(), ROCKET_FLIGHT_MS + 500);
}

// Launches rockets at randomized intervals for FIREWORKS_DURATION_MS,
// giving a fireworks show that explodes at different spots across the
// whole screen over roughly 10 seconds. Purely decorative; only shown
// when the control panel has opted in via message.effects.
function triggerExplosion() {
  for (const id of fireworksTimeoutIds) {
    clearTimeout(id);
  }
  fireworksTimeoutIds = [];

  const startTime = Date.now();
  function scheduleNext() {
    launchRocket();
    if (Date.now() - startTime >= FIREWORKS_DURATION_MS) {
      return;
    }
    const delay = LAUNCH_INTERVAL_MIN_MS
      + Math.random() * (LAUNCH_INTERVAL_MAX_MS - LAUNCH_INTERVAL_MIN_MS);
    fireworksTimeoutIds.push(setTimeout(scheduleNext, delay));
  }
  scheduleNext();
}

// Cancels any in-progress fireworks show (pending rocket launches) and
// removes any rockets/bursts currently in the DOM, e.g. when the control
// panel is reset mid-show.
function cancelFireworks() {
  for (const id of fireworksTimeoutIds) {
    clearTimeout(id);
  }
  fireworksTimeoutIds = [];
  document
    .querySelectorAll('.firework-rocket, .explosion')
    .forEach((el) => el.remove());
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
  cancelFireworks();
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
        numberDisplay.textContent = `${book}`;
      },
      onNumberTick: (number) => {
        numberDisplay.textContent = `${message.finalBook}-${number}`;
      },
      onComplete: (book, number) => {
        numberDisplay.textContent = `${book}-${number}`;
        addHistoryEntry({ book, number });
        if (message.effects) {
          triggerExplosion();
        }
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
      if (message.effects) {
        triggerExplosion();
      }
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
    cancelFireworks();
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
