// Shared control-panel orchestration used by both js/control.js (number
// draws) and js/control-bok.js (book draws). Each caller supplies the
// mode-specific pieces (how to validate/create its draw state, how to
// perform/undo one draw, how to format a result for history/animation) via
// `config`; this module owns everything about *when* those pieces run.
export function createDrawController(config) {
  const {
    channelName,
    displayUrl,
    windowName,
    elements,
    getSelectedSpeed,
    getSelectedTheme,
    exhaustedMessage,
    ensureState,
    getState,
    isExhausted,
    remainingCount,
    performDraw,
    undoDraw,
    buildDrawMessage,
    formatHistoryEntry,
    resetExtra,
  } = config;

  const {
    drawButton,
    resetButton,
    errorMessage,
    historyList,
    remainingCountEl,
  } = elements;

  const channel = new BroadcastChannel(channelName);

  let displayWindow = null;
  let historyEntries = [];
  let isDrawing = false;
  // Set while waiting for the display window to confirm it actually showed
  // a draw. If the window is closed before that happens, the draw is
  // rolled back instead of silently counting as "drawn".
  let pendingFinalize = null;
  let closeWatcherId = null;

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = !message;
  }

  function addHistoryEntry(text) {
    const item = document.createElement('li');
    item.textContent = text;
    historyList.prepend(item);
  }

  function updateRemainingCount() {
    const state = getState();
    remainingCountEl.textContent = state ? String(remainingCount(state)) : '—';
  }

  function openDisplayWindowIfNeeded() {
    if (displayWindow && !displayWindow.closed) {
      return Promise.resolve();
    }
    displayWindow = window.open(displayUrl, windowName);
    if (!displayWindow) {
      showError(
        'Kunne ikke åpne visningsvindu. Sjekk at nettleseren ikke blokkerer popup-vinduer.',
      );
      return Promise.resolve();
    }
    // Wait for the new window to load before posting to the
    // BroadcastChannel, otherwise its listener isn't registered yet and
    // the first draw is lost.
    return new Promise((resolve) => {
      displayWindow.addEventListener('load', () => resolve(), { once: true });
    });
  }

  async function handleDraw() {
    if (isDrawing) {
      return;
    }
    if (!ensureState(showError)) {
      return;
    }
    const state = getState();
    if (isExhausted(state)) {
      showError(exhaustedMessage);
      drawButton.disabled = true;
      return;
    }

    // Lock out further draws immediately, synchronously, before any await -
    // otherwise several rapid clicks can all pass the isDrawing check
    // above while the first call is still waiting on the display window
    // to open.
    isDrawing = true;
    drawButton.disabled = true;

    await openDisplayWindowIfNeeded();

    if (!displayWindow || displayWindow.closed) {
      // openDisplayWindowIfNeeded() already showed an error (e.g. popup
      // blocked); don't consume a draw nobody can see.
      isDrawing = false;
      drawButton.disabled = false;
      return;
    }

    const result = performDraw(state);
    const speed = getSelectedSpeed();
    const theme = getSelectedTheme();

    channel.postMessage({
      type: 'draw',
      speed,
      theme,
      ...buildDrawMessage(state, result),
    });

    function finalizeDraw() {
      historyEntries.push(result);
      addHistoryEntry(formatHistoryEntry(result));
      updateRemainingCount();

      isDrawing = false;
      if (isExhausted(state)) {
        drawButton.disabled = true;
        showError(exhaustedMessage);
      } else {
        drawButton.disabled = false;
      }
    }

    // The display window shows/animates the draw itself (possibly after
    // a click/space reveal gesture); we only finalize once it confirms
    // the draw actually completed there, or roll back if the window is
    // closed before that happens.
    pendingFinalize = finalizeDraw;
    closeWatcherId = setInterval(() => {
      if (displayWindow && displayWindow.closed) {
        clearInterval(closeWatcherId);
        closeWatcherId = null;
        pendingFinalize = null;
        undoDraw(state, result);
        isDrawing = false;
        drawButton.disabled = false;
        showError(
          'Visningsvinduet ble lukket før trekningen ble vist. Trukket resultat ble ikke talt - prøv igjen.',
        );
      }
    }, 300);
  }

  function resetAll() {
    historyEntries = [];
    isDrawing = false;
    if (closeWatcherId) {
      clearInterval(closeWatcherId);
      closeWatcherId = null;
    }
    pendingFinalize = null;
    drawButton.disabled = false;
    historyList.innerHTML = '';
    remainingCountEl.textContent = '—';
    showError('');
    resetExtra();
    channel.postMessage({ type: 'reset' });
  }

  drawButton.addEventListener('click', handleDraw);
  resetButton.addEventListener('click', resetAll);

  // The display window can also trigger draws/reset and asks for a
  // history snapshot on load; the control panel stays the single source
  // of truth for the interval/settings and the set of drawn results.
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
      const state = getState();
      channel.postMessage({
        type: 'sync',
        history: historyEntries.slice(),
        remaining: state ? remainingCount(state) : null,
      });
    }
  };
}
