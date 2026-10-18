# Loddtrekning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, GitHub-Pages-hostable web tool for drawing unique lottery
winner numbers for a julebasar, with an optional separate display window for
projectors and an animated "rolling numbers" draw.

**Architecture:** Pure HTML/CSS/vanilla JavaScript (ES modules), no build step,
no backend. A pure, DOM-free core logic module (`js/draw-logic.js`) handles
interval validation, draw state, and the rolling-animation timing, and is unit
tested with Node's built-in test runner. Two thin HTML pages — a control panel
(`index.html`) and a display window (`trekning.html`) — wire that logic to the
DOM and to each other via `BroadcastChannel`.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES modules), Node.js built-in
test runner (`node:test`, `node:assert/strict`) for unit tests. No frameworks,
no bundler, no npm dependencies.

Reference spec: `docs/superpowers/specs/2026-10-18-loddtrekning-design.md`

---

### Task 1: Core logic — interval validation (TDD)

**Files:**
- Create: `package.json`
- Create: `js/draw-logic.js`
- Create: `tests/draw-logic.test.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "loddtrekning",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/draw-logic.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterval } from '../js/draw-logic.js';

test('validateInterval accepts a valid interval', () => {
  const result = validateInterval('1', '10');
  assert.deepEqual(result, { valid: true, from: 1, to: 10 });
});

test('validateInterval rejects non-numeric input', () => {
  const result = validateInterval('abc', '10');
  assert.equal(result.valid, false);
  assert.match(result.error, /hele tall/);
});

test('validateInterval rejects empty input', () => {
  const result = validateInterval('', '10');
  assert.equal(result.valid, false);
  assert.match(result.error, /hele tall/);
});

test('validateInterval rejects from greater than to', () => {
  const result = validateInterval('10', '1');
  assert.equal(result.valid, false);
  assert.match(result.error, /mindre enn/);
});

test('validateInterval accepts from equal to to', () => {
  const result = validateInterval('5', '5');
  assert.deepEqual(result, { valid: true, from: 5, to: 5 });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/draw-logic.js'` (file doesn't exist yet)

- [ ] **Step 4: Create `js/draw-logic.js` with the minimal implementation**

```js
export function validateInterval(fromInput, toInput) {
  const from = Number(fromInput);
  const to = Number(toInput);
  const fromIsValid = fromInput !== '' && Number.isInteger(from);
  const toIsValid = toInput !== '' && Number.isInteger(to);

  if (!fromIsValid || !toIsValid) {
    return { valid: false, error: 'Fra og til må være hele tall.' };
  }
  if (from > to) {
    return {
      valid: false,
      error: '"Fra og med" må være mindre enn eller lik "til og med".',
    };
  }
  return { valid: true, from, to };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all 5 tests in `tests/draw-logic.test.js` pass

- [ ] **Step 6: Commit**

```bash
git add package.json js/draw-logic.js tests/draw-logic.test.js
git commit -m "Add interval validation logic for lottery draw"
```

---

### Task 2: Core logic — draw state and drawing numbers (TDD)

**Files:**
- Modify: `js/draw-logic.js`
- Modify: `tests/draw-logic.test.js`

- [ ] **Step 1: Write the failing tests**

Update the `import` line at the top of `tests/draw-logic.test.js` so there is
only one import from `'../js/draw-logic.js'`:

```js
import {
  validateInterval,
  createDrawState,
  drawNumber,
  remainingCount,
  isExhausted,
} from '../js/draw-logic.js';
```

Append to `tests/draw-logic.test.js`:

```js
test('createDrawState tracks the interval with no numbers drawn yet', () => {
  const state = createDrawState(1, 3);
  assert.equal(remainingCount(state), 3);
  assert.equal(isExhausted(state), false);
});

test('drawNumber never repeats a number until the interval is exhausted', () => {
  const state = createDrawState(1, 3);
  const drawn = new Set();
  drawn.add(drawNumber(state));
  drawn.add(drawNumber(state));
  drawn.add(drawNumber(state));

  assert.equal(drawn.size, 3);
  assert.deepEqual([...drawn].sort(), [1, 2, 3]);
  assert.equal(remainingCount(state), 0);
  assert.equal(isExhausted(state), true);
});

test('drawNumber throws once the interval is exhausted', () => {
  const state = createDrawState(1, 1);
  drawNumber(state);
  assert.throws(() => drawNumber(state), /allerede trukket/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `createDrawState is not a function` (or similar, since it
doesn't exist yet)

- [ ] **Step 3: Implement the minimal code**

Append to `js/draw-logic.js`:

```js
export function createDrawState(from, to) {
  return { from, to, drawnNumbers: new Set() };
}

export function remainingCount(state) {
  return state.to - state.from + 1 - state.drawnNumbers.size;
}

export function isExhausted(state) {
  return remainingCount(state) <= 0;
}

export function drawNumber(state) {
  if (isExhausted(state)) {
    throw new Error('Alle numre i intervallet er allerede trukket.');
  }
  const remaining = [];
  for (let n = state.from; n <= state.to; n++) {
    if (!state.drawnNumbers.has(n)) {
      remaining.push(n);
    }
  }
  const index = Math.floor(Math.random() * remaining.length);
  const number = remaining[index];
  state.drawnNumbers.add(number);
  return number;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/draw-logic.js tests/draw-logic.test.js
git commit -m "Add draw state and unique number drawing logic"
```

---

### Task 3: Core logic — rolling animation helper (TDD)

**Files:**
- Modify: `js/draw-logic.js`
- Modify: `tests/draw-logic.test.js`

- [ ] **Step 1: Write the failing test**

Update the `import` block at the top of `tests/draw-logic.test.js` to also
pull in `runRollingAnimation`:

```js
import {
  validateInterval,
  createDrawState,
  drawNumber,
  remainingCount,
  isExhausted,
  runRollingAnimation,
} from '../js/draw-logic.js';
```

Append to `tests/draw-logic.test.js`:

```js
test('runRollingAnimation ticks random numbers then completes with the final number', () => {
  let fakeNow = 0;
  let tickCallback;
  const ticks = [];
  let completedWith = null;
  let cleared = false;

  const fakeSetInterval = (callback) => {
    tickCallback = callback;
    return 'fake-interval-id';
  };
  const fakeClearInterval = (id) => {
    assert.equal(id, 'fake-interval-id');
    cleared = true;
  };

  runRollingAnimation({
    from: 1,
    to: 10,
    finalNumber: 7,
    speed: 'fast',
    onTick: (n) => ticks.push(n),
    onComplete: (n) => {
      completedWith = n;
    },
    setIntervalFn: fakeSetInterval,
    clearIntervalFn: fakeClearInterval,
    now: () => fakeNow,
  });

  fakeNow += 100;
  tickCallback();
  assert.equal(ticks.length, 1);
  assert.equal(completedWith, null);

  fakeNow += 1000;
  tickCallback();
  assert.equal(completedWith, 7);
  assert.equal(cleared, true);
});

test('runRollingAnimation rejects an unknown speed', () => {
  assert.throws(
    () =>
      runRollingAnimation({
        from: 1,
        to: 10,
        finalNumber: 7,
        speed: 'ludicrous',
        onTick: () => {},
        onComplete: () => {},
      }),
    /ukjent hastighet/i,
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `runRollingAnimation is not a function`

- [ ] **Step 3: Implement the minimal code**

Append to `js/draw-logic.js`:

```js
export const ANIMATION_SPEEDS = {
  slow: { tickMs: 160, totalMs: 3000 },
  medium: { tickMs: 90, totalMs: 1600 },
  fast: { tickMs: 45, totalMs: 800 },
};

export function runRollingAnimation({
  from,
  to,
  finalNumber,
  speed,
  onTick,
  onComplete,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = Date.now,
}) {
  const settings = ANIMATION_SPEEDS[speed];
  if (!settings) {
    throw new Error(`Ukjent hastighet: ${speed}`);
  }
  const { tickMs, totalMs } = settings;
  const startTime = now();

  const intervalId = setIntervalFn(() => {
    const elapsed = now() - startTime;
    if (elapsed >= totalMs) {
      clearIntervalFn(intervalId);
      onComplete(finalNumber);
      return;
    }
    const randomNumber = Math.floor(Math.random() * (to - from + 1)) + from;
    onTick(randomNumber);
  }, tickMs);

  return intervalId;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/draw-logic.js tests/draw-logic.test.js
git commit -m "Add rolling animation timing logic"
```

---

### Task 4: Shared styles

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Create the stylesheet**

```css
body {
  font-family: system-ui, sans-serif;
  margin: 0;
}

.control-panel {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.interval-section,
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

fieldset {
  border: 1px solid #ccc;
  border-radius: 4px;
}

#drawButton {
  font-size: 1.5rem;
  padding: 0.75rem 2rem;
  cursor: pointer;
}

#errorMessage {
  color: #b00020;
  font-weight: bold;
}

.history-section ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.history-section li {
  background: #eee;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
}

.display {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 60vh;
}

.display .number {
  font-size: 20vw;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.theme-dark {
  background: #000;
  color: #fff;
}

.theme-light {
  background: #fff;
  color: #000;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "Add shared stylesheet for control panel and display window"
```

---

### Task 5: Control panel markup

**Files:**
- Modify: `index.html` (replaces the placeholder "Hello World" content)

- [ ] **Step 1: Replace the contents of `index.html`**

```html
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>Loddtrekning - julebasar</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="control-panel">
    <h1>Loddtrekning</h1>

    <section class="interval-section">
      <label>
        Fra og med
        <input type="number" id="fromInput" value="1">
      </label>
      <label>
        Til og med
        <input type="number" id="toInput" value="500">
      </label>
    </section>

    <section class="settings-section">
      <fieldset>
        <legend>Animasjonshastighet</legend>
        <label><input type="radio" name="speed" value="slow"> Sakte</label>
        <label><input type="radio" name="speed" value="medium" checked> Middels</label>
        <label><input type="radio" name="speed" value="fast"> Rask</label>
      </fieldset>

      <fieldset>
        <legend>Fargetema</legend>
        <label><input type="radio" name="theme" value="dark" checked> Svart bakgrunn, hvit tekst</label>
        <label><input type="radio" name="theme" value="light"> Hvit bakgrunn, svart tekst</label>
      </fieldset>

      <label>
        <input type="checkbox" id="newWindowCheckbox">
        Åpne trekning i eget vindu (f.eks. prosjektor)
      </label>
    </section>

    <button id="drawButton">Trekk</button>
    <p id="errorMessage" role="alert" hidden></p>

    <section id="inlineDisplay" class="display" hidden>
      <div id="inlineNumber" class="number">&nbsp;</div>
    </section>

    <section class="history-section">
      <h2>Historikk (<span id="remainingCount">—</span> gjenstår)</h2>
      <ul id="historyList"></ul>
    </section>
  </main>

  <script type="module" src="js/control.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Replace placeholder index.html with control panel markup"
```

---

### Task 6: Control panel logic

**Files:**
- Create: `js/control.js`

- [ ] **Step 1: Create the control panel script**

```js
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
      },
    });
  }

  addHistoryEntry(number);
  updateRemainingCount();

  if (isExhausted(drawState)) {
    drawButton.disabled = true;
    showError('Alle numre i intervallet er trukket.');
  }
}

drawButton.addEventListener('click', handleDraw);
```

- [ ] **Step 2: Verify manually in a browser**

The browser blocks ES module imports over the `file://` protocol, so serve
the project with a local static server:

Run: `npx http-server . -p 8080` (or `python -m http.server 8080`)

Open `http://localhost:8080/` and:
1. Set "Fra og med" to `1` and "Til og med" to `3`.
2. Click "Trekk" three times — confirm the inline display shows an animated
   roll each time, landing on a number, and the history list grows with 3
   distinct numbers, "gjenstår" counting down to 0.
3. Click "Trekk" a 4th time — confirm the error message "Alle numre i
   intervallet er trukket." appears and the button is disabled.
4. Reload the page — confirm the inputs are re-enabled and history is empty
   again (no persistence, as per spec).

Expected: all of the above behave as described.

- [ ] **Step 3: Commit**

```bash
git add js/control.js
git commit -m "Add control panel logic for drawing unique lottery numbers"
```

---

### Task 7: Display window

**Files:**
- Create: `trekning.html`
- Create: `js/display.js`

- [ ] **Step 1: Create `trekning.html`**

```html
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>Trekning</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="displayRoot" class="display theme-dark">
    <div id="numberDisplay" class="number">&nbsp;</div>
  </main>

  <script type="module" src="js/display.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/display.js`**

```js
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
```

- [ ] **Step 3: Verify manually in a browser**

With the local server from Task 6 still running:
1. Open `http://localhost:8080/` in one tab.
2. Check "Åpne trekning i eget vindu (f.eks. prosjektor)".
3. Set an interval (e.g. `1` to `5`) and click "Trekk".
4. Confirm a new window/tab opens showing `trekning.html`, plays the same
   rolling animation, and lands on the same number shown in the control
   panel's history list.
5. Click "Trekk" again — confirm the existing display window updates (no
   second window is opened) and shows the next number.

Expected: both windows show matching, synchronized results.

- [ ] **Step 4: Commit**

```bash
git add trekning.html js/display.js
git commit -m "Add synchronized display window for projector output"
```

---

### Task 8: Documentation and GitHub Pages hosting

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Replace the contents of `README.md` with:

```markdown
# Loddtrekning — julebasar

Enkelt, statisk nettbasert verktøy for å trekke unike vinnernumre i en
loddtrekning (f.eks. til en julebasar). Ingen backend, ingen avhengigheter —
bare HTML, CSS og vanilla JavaScript.

Se designspesifikasjonen i
[`docs/superpowers/specs/2026-10-18-loddtrekning-design.md`](docs/superpowers/specs/2026-10-18-loddtrekning-design.md).

## Bruk

1. Åpne `index.html` i nettleseren (via en lokal server, se under).
2. Angi loddintervall ("fra og med" / "til og med").
3. Velg animasjonshastighet, fargetema, og om trekningen skal vises i et eget
   vindu (f.eks. for en prosjektor).
4. Klikk "Trekk" for å trekke ett og ett vinnernummer. Samme nummer trekkes
   aldri to ganger i samme økt.

## Kjøre lokalt

Nettleseren blokkerer ES-moduler over `file://`, så bruk en enkel lokal
server:

```bash
npx http-server . -p 8080
# eller
python -m http.server 8080
```

Åpne deretter `http://localhost:8080/`.

## Kjøre tester

Kjernelogikken (intervallvalidering, trekning, animasjonstiming) er dekket av
enhetstester som kjøres med Node sin innebygde test-runner:

```bash
npm test
```

## Hosting på GitHub Pages

Dette er et rent statisk nettsted og kan hostes direkte fra repoet:

1. Gå til repoets **Settings → Pages** på GitHub.
2. Under "Build and deployment", velg **Deploy from a branch**.
3. Velg branch `main` og mappe `/ (root)`, lagre.
4. Siden blir tilgjengelig på `https://<bruker>.github.io/<repo>/` innen
   noen minutter.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document usage, local testing, and GitHub Pages hosting"
```

---

## Plan Self-Review Notes

- **Spec coverage:** interval input (Task 5), unique one-at-a-time draws
  (Tasks 2, 6), animation with speed setting (Tasks 3, 6, 7), history list
  (Task 6), color theme (Tasks 4–7), separate display window via
  `BroadcastChannel` (Tasks 6–7), exhausted-interval error handling (Tasks 2,
  6), no persistence (confirmed by manual check in Task 6), static hosting on
  GitHub Pages (Task 8). All spec sections are covered.
- **Type consistency:** `draw-logic.js` exports (`validateInterval`,
  `createDrawState`, `drawNumber`, `remainingCount`, `isExhausted`,
  `runRollingAnimation`, `ANIMATION_SPEEDS`) are used with identical names and
  signatures across Tasks 1–3, 6, and 7.
- **No placeholders:** every step has complete, concrete code or an exact
  command plus expected output.
