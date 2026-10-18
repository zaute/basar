# Velkomstside og "Trekk fra bok" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `index.html` into a welcome page that lets the user choose between the existing number-draw mode and a new "trekk fra bok" (book draw) mode, where each draw picks a random book + a random number within that book, without ever repeating the same book/number combination.

**Architecture:** The existing number-draw pure logic in `js/draw-logic.js` is extended (not changed) with a handful of new pure functions for book draws. A new shared controller factory (`js/control-shared.js`) extracts the control-panel orchestration logic (draw-in-progress locking, opening/watching the display window, broadcast channel wiring, reset) that both `js/control.js` (number mode) and the new `js/control-bok.js` (book mode) use. `trekning.html` is renamed to `visning.html` and `js/display.js` becomes mode-aware via a `?mode=` query parameter, picking the right `BroadcastChannel` name and rendering logic for each mode.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Node's built-in test runner (`node --test`), `BroadcastChannel` for cross-window messaging, `http-server`/Playwright for manual browser verification (dev-only, never committed as a dependency).

---

## Spec reference

See `docs/superpowers/specs/2026-10-18-bok-trekning-design.md` for the full approved design this plan implements.

## Current file layout (before this plan)

- `index.html` — number-draw control panel (inputs, settings, history, buttons).
- `trekning.html` — standalone display/projector window, loaded by `window.open()`.
- `js/draw-logic.js` — pure draw logic + animation timing (`validateInterval`, `createDrawState`, `drawNumber`, `undrawNumber`, `remainingCount`, `isExhausted`, `runRollingAnimation`, `ANIMATION_SPEEDS`).
- `js/control.js` — number-draw control panel logic (owns `drawState`, `BroadcastChannel('loddtrekning')`, draw-in-progress locking, display-window lifecycle).
- `js/display.js` — display window logic (reveal gesture, history rendering, its own "draw" trigger).
- `tests/draw-logic.test.js` — unit tests for `draw-logic.js`.
- `styles.css` — all styling.

## Target file layout (after this plan)

| File | Status | Role |
|---|---|---|
| `index.html` | **Rewritten** | New welcome page: two large stacked links styled as buttons, linking to `nummer-trekning.html` and `bok-trekning.html`. |
| `nummer-trekning.html` | **New** (renamed from today's `index.html`) | Number-draw control panel. Unchanged content/behavior. |
| `bok-trekning.html` | **New** | Book-draw control panel: "Fra og med", "Til og med", "Antall bøker" inputs, same settings/history/buttons as number mode. |
| `visning.html` | **New** (renamed from `trekning.html`) | Shared display window for both modes, selected via `?mode=nummer` / `?mode=bok`. |
| `js/draw-logic.js` | **Extended** | Adds `decodeBookDraw`, `encodeBookDraw`, `validateBookCount`, `runBookDrawAnimation`. No changes to existing exports. |
| `js/control-shared.js` | **New** | `createDrawController(config)` factory extracted from `js/control.js`: draw-in-progress locking, display-window open/close-watch, `BroadcastChannel` wiring, reset. |
| `js/control.js` | **Rewritten** | Thin number-mode config passed to `createDrawController`. |
| `js/control-bok.js` | **New** | Thin book-mode config passed to `createDrawController`. |
| `js/display.js` | **Rewritten** | Mode-aware via `?mode=` query param: picks channel name, draw message shape, and animation/rendering per mode. |
| `tests/draw-logic.test.js` | **Extended** | Tests for the four new pure functions. |
| `styles.css` | **Extended** | Styles for the new welcome page buttons. |
| `README.md` | **Updated** | Describes the three pages and the welcome flow. |

---

### Task 1: Add book-draw pure logic to `draw-logic.js`

**Files:**
- Modify: `js/draw-logic.js`
- Test: `tests/draw-logic.test.js`

This task adds four pure, DOM-free functions: `decodeBookDraw`, `encodeBookDraw`, `validateBookCount`, and `runBookDrawAnimation`. They follow the exact same style as the existing functions in this file (plain exported functions, no classes).

- [ ] **Step 1: Write the failing tests**

Open `tests/draw-logic.test.js` and update the import list at the top to include the four new functions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
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
  runRollingAnimation,
  runBookDrawAnimation,
} from '../js/draw-logic.js';
```

Then append these tests at the end of the file (after the last existing test, `'runRollingAnimation rejects an unknown speed'`):

```js
test('validateBookCount accepts a positive integer', () => {
  const result = validateBookCount('5');
  assert.deepEqual(result, { valid: true, count: 5 });
});

test('validateBookCount rejects zero', () => {
  const result = validateBookCount('0');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('validateBookCount rejects non-numeric input', () => {
  const result = validateBookCount('abc');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('validateBookCount rejects empty input', () => {
  const result = validateBookCount('');
  assert.equal(result.valid, false);
  assert.match(result.error, /helt tall/);
});

test('decodeBookDraw maps index 0 to the first book and the lowest number', () => {
  assert.deepEqual(decodeBookDraw(0, 1, 100), { book: 1, number: 1 });
});

test('decodeBookDraw maps the last index to the last book and the highest number', () => {
  // 3 books, range 1-100 => rangeSize 100, totalCombos 300, last index 299
  assert.deepEqual(decodeBookDraw(299, 1, 100), { book: 3, number: 100 });
});

test('decodeBookDraw wraps to the next book at a range boundary', () => {
  // rangeSize 100 (1-100): index 99 is book 1 number 100, index 100 is book 2 number 1
  assert.deepEqual(decodeBookDraw(99, 1, 100), { book: 1, number: 100 });
  assert.deepEqual(decodeBookDraw(100, 1, 100), { book: 2, number: 1 });
});

test('encodeBookDraw is the inverse of decodeBookDraw', () => {
  for (const index of [0, 1, 99, 100, 299]) {
    const { book, number } = decodeBookDraw(index, 1, 100);
    assert.equal(encodeBookDraw(book, number, 1, 100), index);
  }
});

test('runBookDrawAnimation rolls the book first, then the number, then completes', () => {
  let fakeNow = 0;
  const callbacks = [];
  const bookTicks = [];
  const numberTicks = [];
  let completedWith = null;

  const fakeSetInterval = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  const fakeClearInterval = () => {};

  runBookDrawAnimation({
    bookFrom: 1,
    bookTo: 3,
    finalBook: 2,
    numberFrom: 1,
    numberTo: 100,
    finalNumber: 42,
    speed: 'fast',
    onBookTick: (book) => bookTicks.push(book),
    onNumberTick: (number) => numberTicks.push(number),
    onComplete: (book, number) => {
      completedWith = { book, number };
    },
    setIntervalFn: fakeSetInterval,
    clearIntervalFn: fakeClearInterval,
    now: () => fakeNow,
  });

  // First interval registered is the book-rolling phase.
  assert.equal(callbacks.length, 1);

  // Tick the book phase once (still rolling), then let it finish.
  fakeNow += 100;
  callbacks[0]();
  assert.equal(bookTicks.length, 1);
  assert.equal(numberTicks.length, 0);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  callbacks[0]();
  // Book phase is done; the number phase should now have registered its
  // own interval.
  assert.equal(callbacks.length, 2);
  assert.equal(completedWith, null);

  // Tick the number phase once (still rolling), then let it finish.
  fakeNow = 0;
  fakeNow += 100;
  callbacks[1]();
  assert.equal(numberTicks.length, 1);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  callbacks[1]();
  assert.deepEqual(completedWith, { book: 2, number: 42 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — errors like `validateBookCount is not a function`, `decodeBookDraw is not a function`, etc., because none of these exist yet in `js/draw-logic.js`.

- [ ] **Step 3: Implement the new functions**

Open `js/draw-logic.js`. Add `validateBookCount` right after `validateInterval` (which ends just before `export function createDrawState`):

```js
export function validateBookCount(countInput) {
  const count = Number(countInput);
  const countIsValid =
    countInput !== '' && Number.isInteger(count) && count >= 1;

  if (!countIsValid) {
    return { valid: false, error: 'Antall bøker må være et helt tall større enn 0.' };
  }
  return { valid: true, count };
}
```

Add `decodeBookDraw` and `encodeBookDraw` right after `undrawNumber` (which is the function added in the previous bugfix session, right after `drawNumber`):

```js
// A book-draw combines a book number and a number-within-the-book into a
// single combined index, so the existing draw-without-replacement logic
// (createDrawState/drawNumber/undrawNumber) can be reused unchanged by
// treating the whole book x number space as one flat interval
// [0, bookCount * rangeSize - 1]. These two functions translate between a
// combined index and the { book, number } pair people actually care about.
// Books are numbered starting at 1.
export function decodeBookDraw(index, from, to) {
  const rangeSize = to - from + 1;
  const book = Math.floor(index / rangeSize) + 1;
  const number = from + (index % rangeSize);
  return { book, number };
}

export function encodeBookDraw(book, number, from, to) {
  const rangeSize = to - from + 1;
  return (book - 1) * rangeSize + (number - from);
}
```

Finally, add `runBookDrawAnimation` at the end of the file, after `runRollingAnimation`:

```js
// Plays the book-rolling animation to completion, then plays the
// number-rolling animation to completion, then calls onComplete with both
// final values. Reuses runRollingAnimation for each phase instead of
// duplicating the timing logic.
export function runBookDrawAnimation({
  bookFrom,
  bookTo,
  finalBook,
  numberFrom,
  numberTo,
  finalNumber,
  speed,
  onBookTick,
  onNumberTick,
  onComplete,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = Date.now,
}) {
  runRollingAnimation({
    from: bookFrom,
    to: bookTo,
    finalNumber: finalBook,
    speed,
    onTick: onBookTick,
    onComplete: (book) => {
      runRollingAnimation({
        from: numberFrom,
        to: numberTo,
        finalNumber,
        speed,
        onTick: onNumberTick,
        onComplete: (number) => {
          onComplete(book, number);
        },
        setIntervalFn,
        clearIntervalFn,
        now,
      });
    },
    setIntervalFn,
    clearIntervalFn,
    now,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests (old + new) green.

- [ ] **Step 5: Commit**

```bash
git add js/draw-logic.js tests/draw-logic.test.js
git commit -m "Add book-draw pure logic (decode/encode/validate/animate)"
```

---

### Task 2: Extract shared control-panel logic into `js/control-shared.js`

**Files:**
- Create: `js/control-shared.js`
- Test: manual verification only (DOM-heavy; covered by Task 3's regression check)

This factory function contains everything that is identical between the number-draw and book-draw control panels: the draw-in-progress lock (including the synchronous-before-any-`await` fix), opening/reusing the display window, waiting for the display window to confirm a draw completed (or rolling it back if the window is closed first), the `BroadcastChannel` message handling for `request-draw`/`request-reset`/`request-sync`/`draw-complete`, and reset.

- [ ] **Step 1: Create `js/control-shared.js`**

```js
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
    runInlineAnimation,
    resetExtra,
  } = config;

  const {
    drawButton,
    resetButton,
    errorMessage,
    historyList,
    remainingCountEl,
    newWindowCheckbox,
    inlineDisplay,
    inlineNumber,
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
    if (!newWindowCheckbox.checked) {
      return Promise.resolve();
    }
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

    if (newWindowCheckbox.checked && (!displayWindow || displayWindow.closed)) {
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

    if (!newWindowCheckbox.checked) {
      inlineDisplay.hidden = false;
      inlineDisplay.className = `display theme-${theme}`;
      runInlineAnimation(state, result, speed, inlineNumber, finalizeDraw);
    } else {
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
    inlineDisplay.hidden = true;
    inlineNumber.textContent = '\u00A0';
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
```

- [ ] **Step 2: Verify syntax**

Run: `node --check js/control-shared.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add js/control-shared.js
git commit -m "Add shared control-panel orchestration factory"
```

---

### Task 3: Rewrite `js/control.js` to use the shared controller (regression check)

**Files:**
- Modify: `js/control.js`
- Depends on: Task 2

This replaces today's `js/control.js` body with a thin number-mode configuration for `createDrawController`. Behavior must stay identical — this task is a refactor, not a feature change.

- [ ] **Step 1: Replace the contents of `js/control.js`**

```js
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
```

- [ ] **Step 2: Verify syntax and run unit tests**

Run: `node --check js/control.js`
Expected: no output.

Run: `npm test`
Expected: PASS (this refactor doesn't touch `draw-logic.js`, so all tests from Task 1 stay green).

- [ ] **Step 3: Regression-check the refactor in a real browser**

Start a local server in one terminal:

```bash
npx http-server . -p 8085 -c-1
```

Install Playwright temporarily (dev-only, never committed — see `README.md`'s "no dependencies" note):

```bash
npm install -D playwright --no-save
npx playwright install chromium
```

Create a throwaway file `debug-refactor-check.mjs` (not committed) in the repo root:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:8085/index.html');

// Rapid-click guard still works.
await page.uncheck('#newWindowCheckbox');
for (let i = 0; i < 10; i++) {
  await page.click('#drawButton', { force: true }).catch(() => {});
}
await page.waitForTimeout(5000);
console.log('rapid-click history (expect exactly 1):', await page.$$eval('#historyList li', (els) => els.map((e) => e.textContent)));

// Window-closed rollback still works.
await page.check('#newWindowCheckbox');
const [popup] = await Promise.all([
  context.waitForEvent('page'),
  page.click('#drawButton'),
]);
await popup.waitForLoadState();
await popup.close();
await page.waitForTimeout(800);
console.log('after closing popup before reveal (expect still 1):', await page.$$eval('#historyList li', (els) => els.map((e) => e.textContent)));
console.log('drawButton disabled (expect false):', await page.isDisabled('#drawButton'));

// A normal external-window draw still completes and updates history.
const [popup2] = await Promise.all([
  context.waitForEvent('page'),
  page.click('#drawButton'),
]);
await popup2.waitForLoadState();
await popup2.keyboard.press('Space');
await page.waitForTimeout(4000);
console.log('after a normal completed draw (expect 2 entries):', await page.$$eval('#historyList li', (els) => els.map((e) => e.textContent)));

await browser.close();
```

Run it:

```bash
node debug-refactor-check.mjs
```

Expected output: `rapid-click history (expect exactly 1): [ '<some number>' ]`, `after closing popup before reveal (expect still 1): [ '<same number>' ]`, `drawButton disabled (expect false): false`, `after a normal completed draw (expect 2 entries): [ '<number>', '<same first number>' ]`.

- [ ] **Step 4: Clean up the throwaway verification files**

```bash
Remove-Item debug-refactor-check.mjs -Force
npm uninstall playwright
git status --short
```

Expected: `git status --short` shows no `node_modules`/`package-lock.json`/`debug-refactor-check.mjs` entries (they're gitignored or removed).

- [ ] **Step 5: Commit**

```bash
git add js/control.js
git commit -m "Refactor control.js to use the shared draw-controller factory"
```

---

### Task 4: Rename `index.html` to `nummer-trekning.html`

**Files:**
- Rename: `index.html` → `nummer-trekning.html`
- Depends on: Task 3

No content changes in this task — just the move, so the next task can create a brand-new `index.html` welcome page.

- [ ] **Step 1: Rename the file with git**

```bash
git mv index.html nummer-trekning.html
```

- [ ] **Step 2: Verify it still works standalone**

With the local server still running (`npx http-server . -p 8085 -c-1`), open `http://localhost:8085/nummer-trekning.html` in a browser (or re-run the Playwright check from Task 3 against `nummer-trekning.html` instead of `index.html`) and confirm the page loads and a draw works end-to-end.

- [ ] **Step 3: Commit**

```bash
git commit -m "Rename index.html to nummer-trekning.html"
```

---

### Task 5: Rename `trekning.html` to `visning.html` and make `js/display.js` mode-aware

**Files:**
- Rename: `trekning.html` → `visning.html`
- Modify: `js/display.js`
- Depends on: Task 1 (for `runBookDrawAnimation`)

- [ ] **Step 1: Rename the file with git**

```bash
git mv trekning.html visning.html
```

- [ ] **Step 2: Update the page title in `visning.html`**

In `visning.html`, change:

```html
  <title>Trekning</title>
```

to:

```html
  <title>Visning</title>
```

- [ ] **Step 3: Rewrite `js/display.js` to be mode-aware**

Replace the full contents of `js/display.js` with:

```js
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
```

- [ ] **Step 4: Verify syntax**

Run: `node --check js/display.js`
Expected: no output.

- [ ] **Step 5: Update `js/control.js` to use the new filename and channel name**

Confirm `js/control.js` (from Task 3) already uses `channelName: 'loddtrekning-nummer'` and `displayUrl: 'visning.html?mode=nummer'` — it does, since Task 3 was written with the final names in mind. No change needed here, but re-run the Task 3 Playwright regression check (Step 3 of Task 3) now against `visning.html` opening correctly (the popup's URL should be `visning.html?mode=nummer`) to confirm the rename didn't break anything:

```bash
npx http-server . -p 8085 -c-1
```

(reuse the same `debug-refactor-check.mjs` script from Task 3, pointed at `http://localhost:8085/nummer-trekning.html` this time instead of `index.html`), then clean up the script and Playwright afterwards exactly as in Task 3 Steps 3-4.

- [ ] **Step 6: Commit**

```bash
git add visning.html js/display.js
git commit -m "Rename trekning.html to visning.html and make display.js mode-aware"
```

---

### Task 6: Create the book-draw control panel

**Files:**
- Create: `bok-trekning.html`
- Create: `js/control-bok.js`
- Depends on: Task 1, Task 2

- [ ] **Step 1: Create `bok-trekning.html`**

```html
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>Trekk fra bok - julebasar</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="control-panel">
    <h1>Trekk fra bok — Betania julebasar</h1>

    <section class="interval-section">
      <fieldset>
        <legend>Bokoppsett</legend>
        <label>
          Fra og med
          <input type="number" id="fromInput" value="1" min="1" max="999">
        </label>
        <label>
          Til og med
          <input type="number" id="toInput" value="100" min="1" max="999">
        </label>
        <label>
          Antall bøker
          <input type="number" id="bookCountInput" value="1" min="1" max="999">
        </label>
      </fieldset>
    </section>

    <section class="settings-section">
      <fieldset>
        <legend>Animasjonshastighet</legend>
        <label><input type="radio" name="speed" value="slow" checked> Sakte</label>
        <label><input type="radio" name="speed" value="medium"> Middels</label>
        <label><input type="radio" name="speed" value="fast"> Rask</label>
      </fieldset>

      <fieldset>
        <legend>Fargetema</legend>
        <label><input type="radio" name="theme" value="dark" checked> Svart bakgrunn, hvit tekst</label>
        <label><input type="radio" name="theme" value="light"> Hvit bakgrunn, svart tekst</label>
      </fieldset>

      <fieldset>
        <legend>Visning</legend>
        <label>
          <input type="checkbox" id="newWindowCheckbox" checked>
          Åpne trekning i eget vindu
        </label>
      </fieldset>
    </section>

    <section class="history-section">
      <fieldset>
        <legend>Historikk (<span id="remainingCount">—</span> gjenstår)</legend>
        <ul id="historyList"></ul>
      </fieldset>
    </section>

    <div class="button-row">
      <button id="drawButton">Trekk</button>
      <button id="resetButton" type="button">Nullstill</button>
    </div>
    <p id="errorMessage" role="alert" hidden></p>

    <section id="inlineDisplay" class="display" hidden>
      <div id="inlineNumber" class="number">&nbsp;</div>
    </section>
  </main>

  <script type="module" src="js/control-bok.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/control-bok.js`**

```js
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
  runBookDrawAnimation,
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
    newWindowCheckbox: document.getElementById('newWindowCheckbox'),
    inlineDisplay: document.getElementById('inlineDisplay'),
    inlineNumber: document.getElementById('inlineNumber'),
  },
  getSelectedSpeed,
  getSelectedTheme,
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
  runInlineAnimation(state, result, speed, inlineNumber, onComplete) {
    runBookDrawAnimation({
      bookFrom: 1,
      bookTo: bookCount,
      finalBook: result.book,
      numberFrom: rangeFrom,
      numberTo: rangeTo,
      finalNumber: result.number,
      speed,
      onBookTick: (book) => {
        inlineNumber.textContent = `Bok ${book}`;
      },
      onNumberTick: (number) => {
        inlineNumber.textContent = `Bok ${result.book} — nummer ${number}`;
      },
      onComplete: (book, number) => {
        inlineNumber.textContent = `Bok ${book} — nummer ${number}`;
        onComplete();
      },
    });
  },
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
```

- [ ] **Step 3: Verify syntax and run unit tests**

Run: `node --check js/control-bok.js`
Expected: no output.

Run: `npm test`
Expected: PASS (book-draw control logic is DOM-only and not covered by `node --test`; the pure logic it depends on was already tested in Task 1).

- [ ] **Step 4: Verify book-draw end-to-end in a real browser**

```bash
npx http-server . -p 8085 -c-1
npm install -D playwright --no-save
npx playwright install chromium
```

Create a throwaway `debug-bok-check.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:8085/bok-trekning.html');
await page.fill('#fromInput', '1');
await page.fill('#toInput', '10');
await page.fill('#bookCountInput', '2');

const [popup] = await Promise.all([
  context.waitForEvent('page'),
  page.click('#drawButton'),
]);
await popup.waitForLoadState();
await popup.keyboard.press('Space');
await page.waitForTimeout(6000); // book phase + number phase, both "slow"

const historyText = await page.$$eval('#historyList li', (els) => els.map((e) => e.textContent));
console.log('control-panel history (expect one "<1-2>-<1-10>" entry):', historyText);

const popupHistoryText = await popup.$$eval('#historyList li', (els) => els.map((e) => e.textContent));
console.log('popup history (expect same entry):', popupHistoryText);

const finalText = await popup.textContent('#numberDisplay');
console.log('popup final text (expect "Bok X — nummer Y"):', finalText);

// Draw until exhausted (2 books * 10 numbers = 20 combos) and confirm no
// combo repeats and no crash occurs on the last draw.
for (let i = 0; i < 19; i++) {
  await popup.click('body'); // trigger a brand-new draw from inside the popup
  await page.waitForTimeout(6000);
}
const allEntries = await page.$$eval('#historyList li', (els) => els.map((e) => e.textContent));
console.log('total entries drawn (expect 20):', allEntries.length);
console.log('all entries unique (expect true):', new Set(allEntries).size === allEntries.length);
console.log('remaining count text (expect 0):', await page.textContent('#remainingCount'));

await browser.close();
```

Run it:

```bash
node debug-bok-check.mjs
```

Expected: all the `(expect ...)` assertions in the console output match (one history entry in the format `book-number`, matching popup history, final text in the `Bok X — nummer Y` format, 20 total unique entries, remaining count `0`).

- [ ] **Step 5: Clean up the throwaway verification files**

```bash
Remove-Item debug-bok-check.mjs -Force
npm uninstall playwright
git status --short
```

- [ ] **Step 6: Commit**

```bash
git add bok-trekning.html js/control-bok.js
git commit -m "Add book-draw control panel (bok-trekning.html + control-bok.js)"
```

---

### Task 7: New welcome page (`index.html`)

**Files:**
- Create (overwrite): `index.html`
- Modify: `styles.css`
- Depends on: Task 4, Task 6

- [ ] **Step 1: Write the new `index.html`**

```html
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>Loddtrekning - julebasar</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="control-panel welcome-panel">
    <h1>Loddtrekning — Betania julebasar</h1>
    <div class="welcome-buttons">
      <a class="welcome-button" href="nummer-trekning.html">🔢 Trekk nummer</a>
      <a class="welcome-button" href="bok-trekning.html">📖 Trekk fra bok</a>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 2: Add welcome-page styles to `styles.css`**

Append to the end of `styles.css`:

```css
.welcome-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.welcome-buttons {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  margin-top: 1rem;
}

.welcome-button {
  display: block;
  text-align: center;
  font-size: 1.5rem;
  padding: 1.5rem 2rem;
  cursor: pointer;
  background: var(--color-accent-gold);
  color: var(--color-primary-green);
  border: none;
  border-radius: 8px;
  font-weight: bold;
  text-decoration: none;
}

.welcome-button:hover {
  background: var(--color-accent-gold-dark);
}
```

- [ ] **Step 3: Verify in a real browser**

```bash
npx http-server . -p 8085 -c-1
```

Open `http://localhost:8085/` and confirm: two stacked gold buttons appear below the title, "🔢 Trekk nummer" links to `nummer-trekning.html`, "📖 Trekk fra bok" links to `bok-trekning.html`, and both destination pages load and work.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "Add welcome page with links to both draw modes"
```

---

### Task 8: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the "Bruk" section**

Replace:

```markdown
## Bruk

1. Åpne `index.html` i nettleseren (via en lokal server, se under).
2. Angi loddintervall ("fra og med" / "til og med").
3. Velg animasjonshastighet, fargetema, og om trekningen skal vises i et eget
   vindu (f.eks. for en prosjektor).
4. Klikk "Trekk" for å trekke ett og ett vinnernummer. Samme nummer trekkes
   aldri to ganger i samme økt.
```

with:

```markdown
## Bruk

1. Åpne `index.html` i nettleseren (via en lokal server, se under). Dette er
   en velkomstside der du velger trekningsmodus.
2. Velg **Trekk nummer** for å trekke unike enkeltnumre fra et intervall,
   eller **Trekk fra bok** for å trekke en tilfeldig bok + et tilfeldig
   nummer i den boken (samme bok/nummer-kombinasjon trekkes aldri to
   ganger).
3. Angi loddintervall ("fra og med" / "til og med"), og for bok-modus også
   "Antall bøker".
4. Velg animasjonshastighet, fargetema, og om trekningen skal vises i et eget
   vindu (f.eks. for en prosjektor).
5. Klikk "Trekk" for å trekke. I bok-modus ruller boknummeret ferdig først,
   deretter nummeret i boken.
```

- [ ] **Step 2: Note the three pages explicitly**

After the "Bruk" section and before "Kjøre lokalt", add:

```markdown
## Sider

- `index.html` — velkomstside, velg trekningsmodus.
- `nummer-trekning.html` — kontrollpanel for nummer-trekning.
- `bok-trekning.html` — kontrollpanel for bok-trekning.
- `visning.html` — delt visningsvindu (prosjektor) for begge moduser, åpnes
  automatisk av kontrollpanelene.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Update README for the welcome page and book-draw mode"
```

---

### Task 9: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: PASS, all tests green (Task 1's new tests + all pre-existing tests).

- [ ] **Step 2: Manual smoke test of every page**

With `npx http-server . -p 8085 -c-1` running, open each of these URLs in a browser and confirm they load without console errors:

- `http://localhost:8085/` (welcome page)
- `http://localhost:8085/nummer-trekning.html` (number draw, full flow: draw in own window, reset, draw inline)
- `http://localhost:8085/bok-trekning.html` (book draw, full flow: draw in own window, reset, draw inline)
- `http://localhost:8085/visning.html?mode=nummer` and `http://localhost:8085/visning.html?mode=bok` opened directly (should show the click/space prompt and, once revealed, correctly request a brand-new draw from whichever control panel is listening on that mode's channel — or simply show nothing drawn yet if no control panel is open, which is expected).

- [ ] **Step 3: Confirm no dev-only artifacts were committed**

```bash
git status --short
```

Expected: clean (no untracked `node_modules`, `package-lock.json`, or `debug-*.mjs` files — all either removed or covered by `.gitignore`).
