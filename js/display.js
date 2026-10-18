import { runRollingAnimation } from './draw-logic.js';

const displayRoot = document.getElementById('displayRoot');
const numberDisplay = document.getElementById('numberDisplay');

const channel = new BroadcastChannel('loddtrekning');

channel.onmessage = (event) => {
  const message = event.data;
  if (!message || message.type !== 'draw') {
    return;
  }

  displayRoot.className = `display theme-${message.theme}`;

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
    },
  });
};
