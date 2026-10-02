/* =========================================================
   SIGNAL LOCK – Guess the Number
   ---------------------------------------------------------
   1. Grab elements
   2. Game state
   3. Dial helpers (angles + arcs)
   4. Drawing the dial (ticks, track)
   5. Playing a guess
   6. Wording (temperature + win messages)
   7. Winning + confetti
   8. Play again
   9. Best score storage
   10. Start
   ========================================================= */

/* ---------- 1. Grab elements ---------- */
const body        = document.body;
const game        = document.getElementById('game');
const dial        = document.getElementById('dial');
const dialNumber  = document.getElementById('dialNumber');
const needle      = document.getElementById('needle');
const track       = document.getElementById('track');
const rangeArc    = document.getElementById('rangeArc');
const ticksGroup  = document.getElementById('ticks');
const burst       = document.getElementById('burst');
const ping        = document.getElementById('ping');
const resultEl    = document.getElementById('result');
const tempEl      = document.getElementById('temp');
const hintEl      = document.getElementById('hint');
const form        = document.getElementById('guessForm');
const input       = document.getElementById('guessInput');
const againBtn    = document.getElementById('againBtn');
const attemptsEl  = document.getElementById('attempts');
const bestEl      = document.getElementById('best');
const bestPill    = document.getElementById('bestPill');
const missionCard = document.getElementById('missionCard');
const directionIntel = document.getElementById('directionIntel');
const signalIntel = document.getElementById('signalIntel');
const zoneIntel = document.getElementById('zoneIntel');
const completeCard = document.getElementById('completeCard');
const completeTitle = document.getElementById('completeTitle');
const completeText = document.getElementById('completeText');

/* ---------- 2. Game state ---------- */
const MIN = 1;
const MAX = 100;

let secret;              // the hidden number
let attempts;            // how many guesses so far
let low;                 // smallest number still possible
let high;                // largest number still possible
let gameOver;            // true after a win
let best = loadBest();   // fewest attempts ever (or null)

/* ---------- 3. Dial helpers ---------- */
// The dial is a 270° arc. Angle 0° points straight up.
// The scale starts at -135° (bottom-left) and ends at +135° (bottom-right).
const CX = 200;          // centre of the SVG drawing
const CY = 200;
const START_ANGLE = -135;
const END_ANGLE = 135;

// Turn a number (1–100) into an angle on the dial
function valueToAngle(value) {
  const fraction = (value - MIN) / (MAX - MIN);
  return START_ANGLE + fraction * (END_ANGLE - START_ANGLE);
}

// Turn an angle + radius into an x/y point on the SVG
function polar(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

// Build an SVG path string for an arc between two angles
function arcPath(a1, a2, radius) {
  const start = polar(a1, radius);
  const end = polar(a2, radius);
  const largeArc = a2 - a1 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/* ---------- 4. Drawing the dial ---------- */
const NS = 'http://www.w3.org/2000/svg';

// Draw tick marks every 5 numbers, with labels at 1, 25, 50, 75, 100
function drawTicks() {
  const labelled = [1, 25, 50, 75, 100];

  for (let v = MIN; v <= MAX; v++) {
    const isLabel = labelled.includes(v);
    if (v % 5 !== 0 && v !== 1) continue;   // only every 5th number (plus 1)

    const angle = valueToAngle(v);
    const outer = polar(angle, 150);
    const inner = polar(angle, isLabel ? 136 : 143);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', outer.x);
    line.setAttribute('y1', outer.y);
    line.setAttribute('x2', inner.x);
    line.setAttribute('y2', inner.y);
    line.setAttribute('class', isLabel ? 'tick tick-major' : 'tick');
    ticksGroup.appendChild(line);

    if (isLabel) {
      const pos = polar(angle, 120);
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y);
      text.setAttribute('class', 'tick-label');
      text.textContent = v;
      ticksGroup.appendChild(text);
    }
  }
}

// The bright "still possible" arc slides smoothly between two angle pairs
let shownStart = START_ANGLE;
let shownEnd = END_ANGLE;
let rangeFrame = null;

function drawRange() {
  // Never let the arc collapse to nothing (keeps a small dot visible)
  const end = Math.max(shownEnd, shownStart + 1);
  rangeArc.setAttribute('d', arcPath(shownStart, end, 170));
}

function animateRange(toStart, toEnd) {
  cancelAnimationFrame(rangeFrame);
  const fromStart = shownStart;
  const fromEnd = shownEnd;
  const startTime = performance.now();
  const duration = 600;

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);          // ease-out
    shownStart = fromStart + (toStart - fromStart) * eased;
    shownEnd = fromEnd + (toEnd - fromEnd) * eased;
    drawRange();
    if (t < 1) rangeFrame = requestAnimationFrame(step);
  }
  rangeFrame = requestAnimationFrame(step);
}

/* ---------- 5. Playing a guess ---------- */
form.addEventListener('submit', (event) => {
  event.preventDefault();      // stop the page from reloading
  handleGuess();
});

function handleGuess() {
  if (gameOver) return;

  const raw = input.value.trim();
  const guess = Number(raw);

  // Reject anything that is not a whole number from 1 to 100
  if (raw === '' || !Number.isInteger(guess) || guess < MIN || guess > MAX) {
    hintEl.textContent = 'Type a whole number from 1 to 100';
    hintEl.classList.add('error');
    restartAnimation(input, 'shake');
    return;
  }

  hintEl.classList.remove('error');
  attempts++;
  attemptsEl.textContent = attempts;
  restartAnimation(attemptsEl, 'bump');           // number "jumps" when it changes

  // Move the needle and show the number in the centre of the dial
  needle.style.transform = `rotate(${valueToAngle(guess)}deg)`;
  dialNumber.textContent = guess;
  restartAnimation(dialNumber, 'tick-pop');
  restartAnimation(ping, 'go');                   // ring ripples outward

  // "Heat" = how close the guess is (0 far away → 1 exactly right)
  const distance = Math.abs(guess - secret);
  const closeness = 1 - distance / (MAX - MIN);
  dial.style.setProperty('--heat', Math.pow(closeness, 3));

  if (guess === secret) {
    win();
  } else if (guess < secret) {
    low = Math.max(low, guess + 1);
    showResult('low', 'SIGNAL BELOW TARGET');
    showTemperature(distance);
    updateIntel('Higher', distance);
  } else {
    high = Math.min(high, guess - 1);
    showResult('high', 'SIGNAL ABOVE TARGET');
    showTemperature(distance);
    updateIntel('Lower', distance);
  }

  // Shrink the bright arc to the numbers that are still possible
  animateRange(valueToAngle(low), valueToAngle(high));

  if (!gameOver) {
    zoneIntel.textContent = `${String(low).padStart(2, '0')}–${String(high).padStart(2, '0')}`;
    // Show the remaining range with the two numbers emphasised
    hintEl.innerHTML = `Search zone narrowed to <b>${low}</b> — <b>${high}</b>`;
    restartAnimation(dial, 'shake');
    input.value = '';
    input.focus();
  }
}

// Change colour theme + show the big message
function showResult(state, message) {
  body.dataset.state = state;
  resultEl.textContent = message;
  restartAnimation(resultEl, 'pop');
}

// Remove and re-add a CSS class so its animation plays again
function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;            // forces the browser to notice the change
  element.classList.add(className);

  const done = (event) => {
    if (event.target !== element) return;   // ignore animations of child elements
    element.classList.remove(className);
    element.removeEventListener('animationend', done);
  };
  element.addEventListener('animationend', done);
}

/* ---------- 6. Wording (temperature + win messages) ---------- */
// A friendly badge that tells the player how close they are
function showTemperature(distance) {
  let level, label;

  if (distance <= 5)       { level = 'burning';  label = 'SIGNAL CRITICAL'; }
  else if (distance <= 12) { level = 'hot';      label = 'SIGNAL HOT'; }
  else if (distance <= 25) { level = 'warm';     label = 'SIGNAL WARM'; }
  else if (distance <= 45) { level = 'cold';     label = 'SIGNAL COLD'; }
  else                     { level = 'freezing'; label = 'SIGNAL DISTANT'; }

  setTemp(level, label);
}

function setTemp(level, label) {
  tempEl.hidden = false;
  tempEl.dataset.level = level;
  tempEl.textContent = label;
  restartAnimation(tempEl, 'slide-in');
}

// Win message depends on how quickly the player got it
function winMessage(count) {
  if (count === 1) return 'First try. Unreal!';
  if (count <= 4)  return `Sharp shooting. Just ${count} attempts!`;
  if (count <= 8)  return `Nice work. Locked in ${count} attempts.`;
  return `Got there in ${count} attempts. Can you beat it?`;
}

/* ---------- 7. Winning + confetti ---------- */
function win() {
  gameOver = true;
  low = high = secret;
  showResult('win', 'SIGNAL LOCKED');
  setTemp('win', 'TARGET ACQUIRED');
  directionIntel.textContent = 'Confirmed';
  signalIntel.textContent = 'Perfect';
  zoneIntel.textContent = String(secret).padStart(2, '0');
  completeCard.hidden = false;
  completeTitle.textContent = 'Signal secured.';
  completeText.textContent = `Target ${secret} acquired in ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}.`;
  dial.classList.add('locked');
  dial.style.setProperty('--heat', 1);
  restartAnimation(dial, 'win');      // plays the green pulse on the dial

  let message = winMessage(attempts);

  // Update the best score if this run is better
  if (best === null || attempts < best) {
    best = attempts;
    saveBest(best);
    bestEl.textContent = best;
    restartAnimation(bestEl, 'bump');
    restartAnimation(bestPill, 'celebrate');
    message = 'NEW BEST SCORE — ' + message;
  }
  hintEl.textContent = message;

  // Mark the mission briefing as completed.
  missionCard.classList.add('completed');

  // Swap the guess form for the Play Again button
  form.hidden = true;
  againBtn.hidden = false;
  againBtn.focus();

  launchConfetti();
}

// Create small coloured pieces that fly out from the centre of the dial
function launchConfetti() {
  const colours = ['#34d399', '#22d3ee', '#fbbf24', '#ffffff', '#a7f3d0', '#ff5a4d'];
  const count = 56;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = i % 3 === 0 ? 'piece round' : 'piece';

    const angle = Math.random() * Math.PI * 2;
    const distance = 130 + Math.random() * 210;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance + 80;      // + 80 = a little gravity

    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
    piece.style.background = colours[i % colours.length];

    burst.appendChild(piece);
    setTimeout(() => piece.remove(), 1700);            // clean up
  }
}

/* ---------- 8. Play again ---------- */
againBtn.addEventListener('click', () => {
  game.classList.add('fading');                         // fade out
  setTimeout(() => {
    resetGame();
    game.classList.remove('fading');                    // fade back in
  }, 300);
});

function updateIntel(direction, distance) {
  directionIntel.textContent = direction;
  if (distance <= 5) signalIntel.textContent = 'Critical';
  else if (distance <= 12) signalIntel.textContent = 'Hot';
  else if (distance <= 25) signalIntel.textContent = 'Warm';
  else if (distance <= 45) signalIntel.textContent = 'Cold';
  else signalIntel.textContent = 'Distant';
  zoneIntel.textContent = `${String(low).padStart(2, '0')}–${String(high).padStart(2, '0')}`;
}

function resetGame() {
  secret = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
  attempts = 0;
  low = MIN;
  high = MAX;
  gameOver = false;

  body.dataset.state = 'idle';
  attemptsEl.textContent = 0;
  bestEl.textContent = best === null ? '–' : best;

  dial.classList.remove('win');
  dial.style.setProperty('--heat', 0);
  needle.style.transform = `rotate(${START_ANGLE}deg)`;
  dialNumber.textContent = '?';

  resultEl.textContent = 'READY TO SCAN';
  tempEl.hidden = true;
  hintEl.classList.remove('error');
  hintEl.textContent = 'The target is hidden. Your first scan starts the lock.';
  directionIntel.textContent = 'Awaiting';
  signalIntel.textContent = 'Standby';
  zoneIntel.textContent = '01–100';
  missionCard.classList.remove('completed');
  completeCard.hidden = true;
  dial.classList.remove('locked');

  form.hidden = false;
  againBtn.hidden = true;
  input.value = '';
  input.focus({ preventScroll: true });

  animateRange(START_ANGLE, END_ANGLE);
}

/* ---------- 9. Best score storage ---------- */
// localStorage keeps the best score after you close the page.
// It's wrapped in try/catch because some browsers block it.
function loadBest() {
  try {
    const saved = localStorage.getItem('signalLockBest');
    return saved ? Number(saved) : null;
  } catch (error) {
    return null;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem('signalLockBest', String(value));
  } catch (error) {
    /* ignore – the score just won't be remembered */
  }
}

/* ---------- 10. Start ---------- */
track.setAttribute('d', arcPath(START_ANGLE, END_ANGLE, 170));
drawTicks();
drawRange();
resetGame();