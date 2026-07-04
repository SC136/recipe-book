const CAT_COLORS = {
  beef: '#913b3b',
  breakfast: 'var(--cat-breakfast)',
  chicken: '#d97d3a',
  dessert: 'var(--cat-dessert)',
  goat: '#8b5a45',
  lamb: '#7a3e48',
  miscellaneous: '#7b8772',
  pasta: '#d4a353',
  pork: '#ba6d66',
  seafood: '#52828d',
  side: '#8c9c61',
  starter: '#cf7357',
  vegan: '#467a54',
  vegetarian: '#629e71',
  lunch: 'var(--cat-lunch)',
  dinner: 'var(--cat-dinner)',
};

const DEFAULT_TIME_BY_CATEGORY = {
  breakfast: '20 min',
  lunch: '25 min',
  dinner: '35 min',
  dessert: '45 min',
};

export const BOOKMARK_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
export const BOOKMARK_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

export function catColor(cat) { 
  if (!cat) return 'var(--ink-3)';
  return CAT_COLORS[cat.toLowerCase()] || 'var(--ink-3)'; 
}

export function inferDifficulty(recipe) {
  const count = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (count <= 6) return 'Easy';
  if (count <= 8) return 'Medium';
  return 'Hard';
}

export function inferServings(recipe) {
  return 4;
}

export function getRecipeMeta(recipe) {
  const servings = Number.isFinite(recipe.servings) ? recipe.servings : inferServings(recipe);
  const difficulty = recipe.difficulty || inferDifficulty(recipe);
  const totalTime = recipe.totalTime || DEFAULT_TIME_BY_CATEGORY[recipe.category] || '30 min';
  return { servings, difficulty, totalTime };
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      default: return ch;
    }
  });
}

export function parseInstructionSteps(text) {
  if (!text) return [];
  let cleanText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  let steps = [];

  if (/step\s*\d+/i.test(cleanText)) {
      steps = cleanText.split(/step\s*\d+[-:]?\s*/i);
  } 
  else if (/(?:^|\n|\s)\d+[\.)]\s/m.test(cleanText)) {
      steps = cleanText.split(/(?:^|\n|\s)\d+[\.)]\s/);
  }
  else if (cleanText.includes('\n')) {
      steps = cleanText.split(/\n+/);
  }
  else {
      steps = cleanText.replace(/\.\s+(?=[A-Z])/g, '.|SPLIT|').split('|SPLIT|');
  }

  return steps
      .map(s => s.trim().replace(/^[-:]\s*/, ''))
      .filter(s => s.length > 3);
}

export function formatSingleInstruction(step) {
  const timeRegex = /(\d+)\s*(min|minute|hr|hour)s?/gi;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = timeRegex.exec(step)) !== null) {
      const fullMatch = match[0];
      const num = match[1];
      const unit = match[2];
      const before = step.slice(lastIndex, match.index);
      result += escapeHtml(before);
      const safeLabel = escapeHtml(fullMatch);
      result += `<button type="button" class="timer-btn" data-time="${String(num)}" data-unit="${String(unit)}">${safeLabel}</button>`;
      lastIndex = match.index + fullMatch.length;
  }
  result += escapeHtml(step.slice(lastIndex));
  return result;
}

export function formatInstructions(text) {
  const steps = parseInstructionSteps(text);
  if (steps.length === 0) return '';
  const formattedSteps = steps.map(step => `<li>${formatSingleInstruction(step)}</li>`);
  return `<ol class="detail-instructions-list">${formattedSteps.join('')}</ol>`;
}

export function parseIngredient(text) {
  const match = text.match(/^((?:\d+(?:\s+\d+\/\d+|\.\d+)?|\d*\/\d+))\s+(.*)$/);
  if (!match) return null;

  let amountStr = match[1];
  let amount = 0;

  if (amountStr.includes(' ')) {
    const parts = amountStr.split(' ');
    const fractionParts = parts[1].split('/');
    const fraction = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
    amount = parseFloat(parts[0]) + fraction;
  } else if (amountStr.includes('/')) {
    const fractionParts = amountStr.split('/');
    amount = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
  } else {
    amount = parseFloat(amountStr);
  }

  return { amount, rest: match[2] };
}

export function formatAmount(num) {
  if (Number.isInteger(num)) return num;

  const decimal = num % 1;
  const whole = Math.floor(num);

  if (Math.abs(decimal - 0.5) < 0.01) return whole ? `${whole} 1/2` : '1/2';
  if (Math.abs(decimal - 0.25) < 0.01) return whole ? `${whole} 1/4` : '1/4';
  if (Math.abs(decimal - 0.75) < 0.01) return whole ? `${whole} 3/4` : '3/4';
  if (Math.abs(decimal - 0.33) < 0.01) return whole ? `${whole} 1/3` : '1/3';
  if (Math.abs(decimal - 0.66) < 0.01) return whole ? `${whole} 2/3` : '2/3';

  return Number(num.toFixed(2));
}



export function generateMacrosFromIngredients(ingredients) {
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  const db = {
    chicken: { p: 31, f: 3, c: 0 }, beef: { p: 26, f: 15, c: 0 }, steak: { p: 25, f: 19, c: 0 },
    pork: { p: 27, f: 14, c: 0 }, bacon: { p: 37, f: 42, c: 1 }, sausage: { p: 14, f: 28, c: 2 },
    ham: { p: 21, f: 6, c: 1 }, lamb: { p: 25, f: 21, c: 0 }, duck: { p: 19, f: 28, c: 0 },
    salmon: { p: 20, f: 13, c: 0 }, tuna: { p: 28, f: 1, c: 0 }, shrimp: { p: 24, f: 0, c: 0 },
    prawn: { p: 24, f: 0, c: 0 }, fish: { p: 20, f: 5, c: 0 },
    egg: { p: 13, f: 11, c: 1, unit: 'count', weight: 50 },

    cheese: { p: 25, f: 33, c: 1 }, cheddar: { p: 25, f: 33, c: 1 }, parmesan: { p: 38, f: 29, c: 4 },
    mozzarella: { p: 22, f: 22, c: 2 }, milk: { p: 3, f: 2, c: 5 }, cream: { p: 2, f: 37, c: 3 },
    butter: { p: 1, f: 81, c: 1 }, yogurt: { p: 10, f: 0, c: 4 },

    flour: { p: 10, f: 1, c: 76 }, rice: { p: 3, f: 0, c: 28 }, pasta: { p: 14, f: 2, c: 75 },
    spaghetti: { p: 14, f: 2, c: 75 }, noodle: { p: 14, f: 2, c: 75 }, bread: { p: 9, f: 3, c: 49 },
    bun: { p: 9, f: 3, c: 49 }, potato: { p: 2, f: 0, c: 17 }, fries: { p: 3, f: 15, c: 41 },
    oat: { p: 17, f: 7, c: 66 }, corn: { p: 3, f: 1, c: 19 }, sugar: { p: 0, f: 0, c: 100 },
    honey: { p: 0, f: 0, c: 82 }, syrup: { p: 0, f: 0, c: 70 }, jam: { p: 0, f: 0, c: 69 },

    oil: { p: 0, f: 100, c: 0 }, mayonnaise: { p: 1, f: 75, c: 1 }, margarine: { p: 0, f: 80, c: 0 },

    peanut: { p: 26, f: 49, c: 16 }, almond: { p: 21, f: 50, c: 22 }, walnut: { p: 15, f: 65, c: 14 },
    cashew: { p: 18, f: 44, c: 30 },

    tomato: { p: 1, f: 0, c: 4 }, onion: { p: 1, f: 0, c: 9 }, garlic: { p: 6, f: 0, c: 33 },
    apple: { p: 0, f: 0, c: 14 }, banana: { p: 1, f: 0, c: 23 }, carrot: { p: 1, f: 0, c: 10 },
    bean: { p: 9, f: 0, c: 20 }, lentil: { p: 9, f: 0, c: 20 },

    chocolate: { p: 5, f: 30, c: 60 }, cocoa: { p: 20, f: 14, c: 58 }, soy: { p: 10, f: 5, c: 9 }
  };

  ingredients.forEach(ing => {
    let amountVal = 1;
    let text = ing.toLowerCase();
    
    // Leverage the robust parser to handle fractions like "1 1/2" properly
    const parsed = parseIngredient(ing);
    let hasNumber = false;

    if (parsed) {
      amountVal = parsed.amount;
      text = parsed.rest.toLowerCase();
      hasNumber = true;
    } else {
      const fallback = text.match(/^(\d+(?:\.\d+)?)/);
      if (fallback) {
        amountVal = parseFloat(fallback[1]);
        text = text.replace(fallback[0], '').trim();
        hasNumber = true;
      }
    }

    let amountGrams = 100;
    
    // Check for units
    const weightMatch = text.match(/^(g|kg|oz|lb|pound)s?\b/);
    const volMatch = text.match(/^(ml|l|cup|tbsp|tsp|tablespoon|teaspoon)s?\b/);

    if (weightMatch) {
      let unit = weightMatch[1];
      let val = amountVal;
      if (unit === 'kg') val *= 1000;
      if (unit === 'oz') val *= 28.35;
      if (unit === 'lb' || unit === 'pound') val *= 453.59;
      amountGrams = val;
    } else if (volMatch) {
      let unit = volMatch[1];
      let val = amountVal;
      if (unit === 'cup') val *= 240;
      if (unit === 'tbsp' || unit === 'tablespoon') val *= 15;
      if (unit === 'tsp' || unit === 'teaspoon') val *= 5;
      if (unit === 'l') val *= 1000;
      amountGrams = val;
    } else {
      // If there's a number but no unit, assume it's a count (e.g. "2 apples" -> 200g).
      // If there's no number at all (e.g. "a pinch of salt"), assume a tiny 10g trace amount.
      amountGrams = hasNumber ? amountVal * 100 : 10;
    }

    if (amountGrams > 2000) amountGrams = 2000;

    let matched = false;
    for (const [key, macros] of Object.entries(db)) {
      const regex = new RegExp('\\b' + key + '(?:s|es)?\\b', 'i');
      if (regex.test(text)) {
        // Adjust for specific count-based units (like eggs)
        if (macros.unit === 'count' && !weightMatch && !volMatch && hasNumber) {
          amountGrams = amountVal * macros.weight;
        }
        const multiplier = amountGrams / 100;
        protein += macros.p * multiplier;
        fat += macros.f * multiplier;
        carbs += macros.c * multiplier;
        matched = true;
        break;
      }
    }

    if (!matched) {
      protein += 0.5 * (amountGrams / 100);
      carbs += 2 * (amountGrams / 100);
    }
  });

  protein = Math.max(protein, 1);
  fat = Math.max(fat, 1);
  carbs = Math.max(carbs, 1);
  const calories = (protein * 4) + (carbs * 4) + (fat * 9);

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs)
  };
}

export function renderMacros(macros, multiplier) {
  if (!macros) return '<p class="empty">Macro data unavailable.</p>';
  const cal = Math.round(macros.calories * multiplier);
  const pro = Math.round(macros.protein * multiplier);
  const fat = Math.round(macros.fat * multiplier);
  const car = Math.round(macros.carbs * multiplier);

  const calPro = pro * 4;
  const calFat = fat * 9;
  const calCar = car * 4;
  const total = (calPro + calFat + calCar) || 1;

  const pctPro = (calPro / total) * 100;
  const pctFat = (calFat / total) * 100;
  const pctCar = (calCar / total) * 100;

  return `
    <div class="macro-display">
      <div class="macro-chart">
        <canvas class="donut-canvas" data-pro="${pctPro}" data-fat="${pctFat}" data-car="${pctCar}" style="width: 140px; height: 140px; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0;"></canvas>
        <div class="macro-center" style="z-index: 1; pointer-events: none; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; background: var(--surface); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span class="macro-cals">${cal}</span>
          <span class="macro-cals-lbl">kcal</span>
        </div>
      </div>
      <div class="macro-legend">
        <div class="macro-item">
          <span class="macro-dot" style="background: #5CB88A"></span>
          <span class="macro-lbl">Protein</span>
          <strong class="macro-val">${pro}g</strong>
        </div>
        <div class="macro-item">
          <span class="macro-dot" style="background: #DCA050"></span>
          <span class="macro-lbl">Fat</span>
          <strong class="macro-val">${fat}g</strong>
        </div>
        <div class="macro-item">
          <span class="macro-dot" style="background: #A07FE0"></span>
          <span class="macro-lbl">Carbs</span>
          <strong class="macro-val">${car}g</strong>
        </div>
      </div>
    </div>
  `;
}

export function initDonuts(container) {
  const canvases = container.querySelectorAll('.donut-canvas');
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const pro = parseFloat(canvas.dataset.pro) || 0;
    const fat = parseFloat(canvas.dataset.fat) || 0;
    const car = parseFloat(canvas.dataset.car) || 0;
    
    const size = 140;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) - 6;
    
    ctx.lineWidth = 12;
    ctx.lineCap = 'butt';
    
    let startAngle = -Math.PI / 2;
    
    const drawSegment = (pct, color) => {
      if (pct <= 0) return;
      const angle = (pct / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + angle);
      ctx.strokeStyle = color;
      ctx.stroke();
      startAngle += angle;
    };
    
    drawSegment(pro, '#5CB88A');
    drawSegment(fat, '#DCA050');
    drawSegment(car, '#A07FE0');
  });
}

export function triggerExplosion(x, y) {
  const particles = 12;
  for (let i = 0; i < particles; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    document.body.appendChild(p);

    const angle = (i / particles) * 2 * Math.PI;
    const velocity = 40 + Math.random() * 40;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    p.style.background = Math.random() > 0.5 ? 'var(--accent)' : 'var(--cat-dessert)';

    p.addEventListener('animationend', () => p.remove());
  }
}

let audioCtx = null;
export function playDing() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (common in browsers until user interaction)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    osc.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) {}
}

const focusReturnStack = [];
export function rememberFocus() {
  const active = document.activeElement;
  focusReturnStack.push(active instanceof HTMLElement ? active : null);
}

export function restoreFocus() {
  const previous = focusReturnStack.pop();
  if (previous && previous.isConnected) previous.focus();
}

export function syncBodyScrollLock() {
  const hasOpenLayer =
    !document.getElementById('overlay').classList.contains('hidden') ||
    !document.getElementById('fav-sheet').classList.contains('hidden') ||
    !document.getElementById('contact-sheet').classList.contains('hidden') ||
    !document.getElementById('cart-sheet').classList.contains('hidden') ||
    !document.getElementById('cooking-mode-overlay').classList.contains('hidden') ||
    !document.getElementById('mobile-menu').classList.contains('hidden');
  document.body.style.overflow = hasOpenLayer ? 'hidden' : '';
}

export function focusFirstElement(container) {
  if (!container) return;
  const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length) {
    focusables[0].focus();
  } else {
    container.focus();
  }
}

export function trapFocus(event, container) {
  if (event.key !== 'Tab' || !container || container.classList.contains('hidden')) return;
  const focusables = Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
