// === Core Game State ===
let coinsBalance = parseFloat(localStorage.getItem('coins')) || 1000.0;
let inBoost = false;
let meter = 0;
let lastTapTime = 0;
let tradeInterval;
let boostStartCoins = 0;
const now = new Date();
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

const stored = JSON.parse(localStorage.getItem('periodStats')) || {};
periodStats = {
  session: { start: coinsBalance },
  today: { start: stored.today?.timestamp === midnight ? stored.today.start : coinsBalance },
  month: { start: stored.month?.timestamp === monthStart ? stored.month.start : coinsBalance }
};

localStorage.setItem('periodStats', JSON.stringify({
  today: { start: periodStats.today.start, timestamp: midnight },
  month: { start: periodStats.month.start, timestamp: monthStart }
}));

let soundOn = true;

// === Utility Functions ===
function randNormal(mean, stdDev) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev + mean;
}

function safeStrategyTradeReturn() {
  return Math.random() < 0.86 ? randNormal(0.0038, 0.0007) : randNormal(-0.0020, 0.0005);
}

function riskyStrategyTradeReturn() {
  return Math.random() < 0.50 ? randNormal(0.0200, 0.0040) : randNormal(-0.0150, 0.0030);
}

// === Trade Engine ===
function runTrade() {
  const pct = inBoost ? riskyStrategyTradeReturn() : safeStrategyTradeReturn();
  coinsBalance *= (1 + pct);
  localStorage.setItem('coins', coinsBalance.toFixed(2));
  updateUI(pct);
}

function updateUI(pct) {
  const pulse = document.getElementById('pulseMsg');
  const bot = document.getElementById('botFace');
  const isGain = pct > 0;
  const delta = (coinsBalance * pct).toFixed(1);
  const pctDisplay = (pct * 100).toFixed(2);
  pulse.textContent = `${isGain ? '+' : '–'}${pctDisplay} % (${isGain ? '+' : '–'}${Math.abs(delta)} C)`;
  pulse.className = isGain ? 'green' : 'gray';
  pulse.style.transform = 'scale(1.2)';
  setTimeout(() => pulse.style.transform = 'scale(1)', 200);

  if (inBoost) bot.src = 'assets/bot-excited.png';
  else bot.src = isGain ? 'assets/bot-happy.png' : 'assets/bot-neutral.png';

  if (soundOn) {
    if (isGain) document.getElementById('winSound').play();
    else document.getElementById('clickSound').play();
  }

  document.getElementById('coinDisplay').textContent = `Coins: ${coinsBalance.toFixed(1)} C`;
  document.getElementById('timeDisplay').textContent = `as of ${new Date().toLocaleTimeString()}`;

  const tab = document.querySelector('.tab.active').dataset.period;
  const start = periodStats[tab].start || coinsBalance; // fallback
  const deltaC = coinsBalance - start;
  const deltaP = ((deltaC / start) * 100).toFixed(1);
  const sign = deltaC >= 0 ? '+' : '–';
  document.getElementById('deltaDisplay').textContent =
  `Return ${tab.charAt(0).toUpperCase() + tab.slice(1)}: ${sign}${Math.abs(deltaP)} % (${sign}${Math.abs(deltaC).toFixed(1)} C)`;
}

// === Tap & Boost Logic ===
function startBoost() {
  inBoost = true;
  boostStartCoins = coinsBalance;
  clearInterval(tradeInterval);
  tradeInterval = setInterval(runTrade, 5000);
}

function stopBoost() {
  inBoost = false;
  clearInterval(tradeInterval);
  tradeInterval = setInterval(runTrade, 20000);

  const diff = coinsBalance - boostStartCoins;
  const pct = ((diff / boostStartCoins) * 100).toFixed(1);
  const text = diff >= 0
    ? `Boost Result: +${pct} % (+${diff.toFixed(1)} C) 🎉`
    : `Boost Result: –${Math.abs(pct)} % (–${Math.abs(diff).toFixed(1)} C). Risky ride!`;
  document.getElementById('summaryText').textContent = text;
  document.getElementById('summaryModal').classList.remove('hidden');
}

function activatePaidBoost() {
  meter = 100;
  document.getElementById('meterBar').style.width = '100%';
  inBoost = true;
  boostStartCoins = coinsBalance;

  clearInterval(tradeInterval);
  tradeInterval = setInterval(runTrade, 5000);

  const boostEndTime = Date.now() + 30000;

  // Start a temp lock that overrides meter decay
  const paidBoostTimer = setInterval(() => {
    const now = Date.now();
    if (now < boostEndTime) {
      meter = 100;
      document.getElementById('meterBar').style.width = '100%';
    } else {
      clearInterval(paidBoostTimer);
      meter = 0;
      document.getElementById('meterBar').style.width = '0%';
      stopBoost(); // Show summary and end
    }
  }, 100); // Check 10x/sec
}

// === UI Events ===
document.getElementById('tapButton').onclick = () => {
  meter = Math.min(100, meter + 10);
  lastTapTime = Date.now();
  document.getElementById('meterBar').style.width = `${meter}%`;
  if (meter === 100 && !inBoost) startBoost();
};

document.getElementById('paidBoost').onclick = activatePaidBoost;
document.getElementById('closeModal').onclick = () => {
  document.getElementById('summaryModal').classList.add('hidden');
};

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    updateUI(0);
  };
});

document.getElementById('soundToggle').onclick = () => {
  soundOn = !soundOn;
  document.getElementById('soundToggle').textContent = soundOn ? '🔊' : '🔇';
};

// === Game Loop ===
tradeInterval = setInterval(runTrade, 20000);
setInterval(() => {
  const now = Date.now();
  if (inBoost) {
    const dt = now - lastTapTime;
    if (dt > 300) meter -= 5;
    if (meter <= 0) {
      meter = 0;
      stopBoost();
    }
  } else {
    meter = Math.max(0, meter - 3);
  }
  document.getElementById('meterBar').style.width = `${Math.max(0, Math.min(100, meter))}%`;
}, 100);

// === Initial Load ===
updateUI(0);
