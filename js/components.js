import { store } from './store.js';
import { navigateToRecipe, navigateHome } from './router.js';
import { 
  getRecipeMeta, catColor, formatInstructions, 
  triggerExplosion, BOOKMARK_IN, BOOKMARK_OUT, parseIngredient, formatAmount,
  rememberFocus, restoreFocus, syncBodyScrollLock, focusFirstElement, playDing,
  escapeHtml, generateMacrosFromIngredients, renderMacros, parseInstructionSteps,
  formatSingleInstruction, initDonuts
} from './utils.js';

let activeMultiplier = 1;
export let activeTimers = [];
try {
  activeTimers = JSON.parse(localStorage.getItem('activeTimers') || '[]');
} catch (e) {
  activeTimers = [];
  console.warn('Failed to parse active timers', e);
}
let windowTimerInterval = null;

export function initTimers() {
  if (activeTimers.length > 0) {
    if (!windowTimerInterval) {
      windowTimerInterval = setInterval(updateTimers, 1000);
    }
    renderTimers();
  }
}

// Subscribe to store changes to automatically update UI
export function setupReactivity() {
  store.subscribe('feed', () => {
    renderRecipeCards();
  });
  
  store.subscribe('categories', renderCategoryTabs);
  store.subscribe('activeCategory', renderCategoryTabs);

  store.subscribe('favorites', () => {
    updateFavBadge();
    refreshCardSaves();
    renderFavoritesGrid();
    if (store.state.activeRecipeId) {
      // Refresh the save button in the detail view without full re-render
      const btn = document.getElementById('fav-btn');
      if (btn) {
        const isFav = store.state.favorites.includes(store.state.activeRecipeId);
        btn.classList.toggle('saved', isFav);
        btn.textContent = isFav ? 'Saved' : 'Save recipe';
      }
    }
  });

  store.subscribe('cart', () => {
    updateCartBadge();
    renderCartItems();
    // Refresh card cart icons
    document.querySelectorAll('.card-cart').forEach(btn => {
      const inCart = store.state.cart.includes(btn.dataset.recipeId);
      btn.classList.toggle('in-cart', inCart);
      btn.setAttribute('aria-label', inCart ? 'Remove from cart' : 'Add to cart');
    });
    // Refresh detail cart button
    if (store.state.activeRecipeId) {
      const btn = document.getElementById('cart-add-btn');
      if (btn) {
        const inCart = store.state.cart.includes(store.state.activeRecipeId);
        btn.classList.toggle('saved', inCart);
        btn.textContent = inCart ? 'In List' : 'Add to List';
      }
    }
  });

  store.subscribe('recentViews', () => renderRecentViews());

  store.subscribe('activeRecipeId', async (id) => {
    if (id) {
      if (!store.state.recipes[id]) {
        try {
          const api = await import('./api.js');
          await api.fetchRecipeById(id);
        } catch (err) {
          console.error("Failed to fetch recipe details:", err);
          return;
        }
      }
      viewRecipe(id);
    } else {
      closeOverlay();
    }
  });
}

// -----------------------------------------------------------------------------
// BADGES
// -----------------------------------------------------------------------------
function updateFavBadge() {
  const favs = store.state.favorites;
  const badge = document.getElementById('fav-count');
  const mobBadge = document.getElementById('mob-fav-count');
  const count = favs.length;

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (mobBadge) {
    mobBadge.textContent = count;
    mobBadge.classList.toggle('hidden', count === 0);
  }
}

function updateCartBadge() {
  const cart = store.state.cart;
  const badge = document.getElementById('cart-count');
  const mobBadge = document.getElementById('mob-cart-count');
  const count = cart.length;

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (mobBadge) {
    mobBadge.textContent = count;
    mobBadge.classList.toggle('hidden', count === 0);
  }
}

// -----------------------------------------------------------------------------
// RECIPE CARDS & LISTINGS
// -----------------------------------------------------------------------------
export function renderSkeletonCards(count = 8) {
  const grid = document.getElementById('recipes');
  if (!grid) return;
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  const tmpl = document.getElementById('skeleton-card-template');
  if (!tmpl) return;
  for (let i = 0; i < count; i++) {
    frag.appendChild(tmpl.content.cloneNode(true));
  }
  grid.appendChild(frag);
}

function renderRecipeCards() {
  const grid = document.getElementById('recipes');
  if (!grid) return;
  grid.innerHTML = '';

  const feed = store.state.feed;
  const count = feed.length;

  const countEl = document.getElementById('recipe-count');
  if (countEl) countEl.textContent = `${count} recipe${count !== 1 ? 's' : ''}`;

  const noRes = document.getElementById('no-results');
  if(noRes) noRes.classList.toggle('hidden', count > 0);

  const titleEl = document.getElementById('recipes-title');
  const category = store.state.activeCategory;
  if (titleEl) {
    titleEl.textContent = category === 'all'
      ? 'All recipes'
      : category.charAt(0).toUpperCase() + category.slice(1) + ' recipes';
  }

  const frag = document.createDocumentFragment();

  feed.forEach((item, i) => {
    const id = item.id;
    const r = store.state.recipes[id];
    
    let meta = { servings: 2, totalTime: '30 min', difficulty: 'Medium' };
    if (r) {
      meta = getRecipeMeta(r);
    }

    const isFav = store.state.favorites.includes(id);
    const inCart = store.state.cart.includes(id);
    const catName = escapeHtml(item.category || 'Other');
    
    const tmpl = document.getElementById('recipe-card-template');
    if (!tmpl) return;
    const cardContent = tmpl.content.cloneNode(true);
    const card = cardContent.querySelector('.recipe-card');

    card.dataset.category = catName;
    card.dataset.recipeId = id;
    card.setAttribute('aria-label', `View recipe: ${item.title}`);
    card.style.setProperty('--card-accent', catColor(catName));
    card.style.animationDelay = `${0.24 + i * 0.05}s`;

    card.querySelector('.cat-name').textContent = catName;
    
    const cartBtn = card.querySelector('.card-cart');
    cartBtn.dataset.recipeId = id;
    if (inCart) {
      cartBtn.classList.add('in-cart');
      cartBtn.setAttribute('aria-label', 'Remove from cart');
    }
    
    const saveBtn = card.querySelector('.card-save');
    saveBtn.dataset.recipeId = id;
    saveBtn.innerHTML = isFav ? BOOKMARK_IN : BOOKMARK_OUT;
    if (isFav) {
      saveBtn.classList.add('saved');
      saveBtn.setAttribute('aria-label', 'Remove from saved');
    } else {
      saveBtn.setAttribute('aria-label', 'Save recipe');
    }
    
    const img = card.querySelector('.card-img');
    img.src = item.image;
    img.alt = item.title;
    
    card.querySelector('.card-title').textContent = item.title;
    
    const metaEl = card.querySelector('.card-meta');
    if (r) {
      metaEl.textContent = `Serves ${meta.servings} · ${meta.totalTime} · ${meta.difficulty}`;
    } else {
      metaEl.remove();
    }

    frag.appendChild(cardContent);
  });
  
  grid.appendChild(frag);
}

function refreshCardSaves() {
  const favs = store.state.favorites;
  document.querySelectorAll('.card-save').forEach(btn => {
    const id = btn.dataset.recipeId;
    const saved = favs.includes(id);
    btn.classList.toggle('saved', saved);
    btn.innerHTML = saved ? BOOKMARK_IN : BOOKMARK_OUT;
    btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save recipe');
  });
}

function renderCategoryTabs() {
  const catBar = document.getElementById('cat-bar');
  if (!catBar) return;
  const activeCat = store.state.activeCategory;
  
  catBar.innerHTML = `<button class="cat ${activeCat === 'all' ? 'active' : ''}" data-category="all" aria-current="${activeCat === 'all' ? 'true' : 'false'}">Discover</button>`;
  
  store.state.categories.forEach(cat => {
    const btn = document.createElement('button');
    const isActive = activeCat === cat;
    btn.className = `cat ${isActive ? 'active' : ''}`;
    btn.dataset.category = cat;
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    btn.textContent = cat;
    catBar.appendChild(btn);
  });
}

// -----------------------------------------------------------------------------
// RECENT VIEWS
// -----------------------------------------------------------------------------
export async function renderRecentViews() {
  const section = document.getElementById('recently-viewed');
  const list = document.getElementById('recently-viewed-list');
  if (!section || !list) return;

  const api = await import('./api.js');
  
  const missingIds = store.state.recentViews.filter(id => !store.state.recipes[id]);
    if (missingIds.length > 0) {
      list.textContent = 'Loading...';
      list.style.color = 'var(--ink-3)';
      list.style.fontSize = '0.9rem';
      list.style.padding = '4px 10px';
      try {
        await Promise.all(missingIds.map(id => api.fetchRecipeById(id)));
      } catch (err) {
        list.textContent = 'Failed to load details.';
        return;
      }
    }

  let validRecents = [];
  for (const id of store.state.recentViews) {
    let r = store.state.recipes[id];
    if (r) validRecents.push(id);
  }

  list.innerHTML = '';

  if (!validRecents.length) {
    section.classList.add('hidden');
    return;
  }

  validRecents.forEach((id) => {
    const recipe = store.state.recipes[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-pill';
      const dot = document.createElement('span');
      dot.className = 'cat-dot';
      dot.style.background = catColor(recipe.category);
    button.appendChild(dot);
    button.appendChild(document.createTextNode(recipe.title));
    button.addEventListener('click', () => navigateToRecipe(id));
    list.appendChild(button);
  });

  section.classList.remove('hidden');
}

// -----------------------------------------------------------------------------
// RECIPE DETAIL OVERLAY
// -----------------------------------------------------------------------------
export function viewRecipe(recipeId) {
  const r = store.state.recipes[recipeId];
  if (!r) return;

  activeMultiplier = 1;

  const overlay = document.getElementById('overlay');
  const details = document.getElementById('recipe-details');
  const isFav = store.state.favorites.includes(recipeId);
  const inCart = store.state.cart.includes(recipeId);
  const color = catColor(r.category);
  const meta = getRecipeMeta(r);
  
  const tmpl = document.getElementById('recipe-detail-template');
  if (!tmpl) return;

  details.textContent = '';
  const detailContent = tmpl.content.cloneNode(true);
  
  const hero = detailContent.querySelector('.detail-hero');
  hero.src = r.image;
  hero.alt = r.title;

  const badge = detailContent.querySelector('.detail-cat-badge');
  badge.style.color = color;
  detailContent.querySelector('.cat-dot').style.background = color;
  detailContent.querySelector('.cat-name').textContent = r.category;
  
  detailContent.querySelector('#recipe-detail-title').textContent = r.title;
  
  detailContent.querySelector('.meta-servings').textContent = `Serves ${meta.servings}`;
  detailContent.querySelector('.meta-time').textContent = meta.totalTime;
  detailContent.querySelector('.meta-diff').textContent = meta.difficulty;
  
  detailContent.querySelector('.serve-count').textContent = `${meta.servings} servings`;
  
  const ingList = detailContent.querySelector('#ing-list');
  const ingItemTmpl = document.getElementById('cart-ingredient-template');
  r.ingredients.forEach(i => {
    const li = document.createElement('li');
    if (ingItemTmpl) {
       const itemContent = ingItemTmpl.content.cloneNode(true);
       itemContent.querySelector('.ing-text').textContent = i;
       itemContent.querySelector('label').className = 'ing-label';
       li.appendChild(itemContent);
    } else {
       li.textContent = i;
    }
    ingList.appendChild(li);
  });
  
  const methodContainer = detailContent.querySelector('#method-container');
  methodContainer.innerHTML = formatInstructions(r.instructions);

  const macroContainer = detailContent.querySelector('#macro-container');
  macroContainer.innerHTML = renderMacros(generateMacrosFromIngredients(r.ingredients), 1 / meta.servings);
  initDonuts(macroContainer);

  const favBtn = detailContent.querySelector('#fav-btn');
  favBtn.dataset.recipeId = recipeId;
  favBtn.textContent = isFav ? 'Saved' : 'Save recipe';
  if (isFav) favBtn.classList.add('saved');

  const cartBtn = detailContent.querySelector('#cart-add-btn');
  cartBtn.dataset.recipeId = recipeId;
  cartBtn.textContent = inCart ? 'In List' : 'Add to List';
  if (inCart) cartBtn.classList.add('saved');
  
  details.appendChild(detailContent);

  if (overlay.classList.contains('hidden')) {
    rememberFocus();
    overlay.classList.remove('hidden');
    focusFirstElement(overlay.querySelector('.panel-drawer'));
    syncBodyScrollLock();
  }

  // Attach serving button listeners
  let activeServings = meta.servings;
  const updateServingsDisplay = () => {
    details.querySelector('.serve-count').textContent = `${activeServings} serving${activeServings > 1 ? 's' : ''}`;
    updateServings(activeServings / meta.servings, r);
  };

  details.querySelector('.serve-minus').addEventListener('click', () => {
    if (activeServings > 1) {
      activeServings--;
      updateServingsDisplay();
    }
  });

  details.querySelector('.serve-plus').addEventListener('click', () => {
    activeServings++;
    updateServingsDisplay();
  });

  details.querySelector('#fav-btn').addEventListener('click', (e) => {
    store.toggleFavorite(recipeId);
    if (store.state.favorites.includes(recipeId)) {
      const rect = e.target.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });

  details.querySelector('#cart-add-btn').addEventListener('click', (e) => {
    store.toggleCart(recipeId);
    if (store.state.cart.includes(recipeId)) {
      const rect = e.target.getBoundingClientRect();
      triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });

  details.querySelector('#cooking-mode-btn').addEventListener('click', () => openCookingMode(r));
  details.querySelector('#print-btn').addEventListener('click', () => window.print());
  const exportBtn = details.querySelector('#export-btn');
  if (exportBtn) exportBtn.addEventListener('click', () => exportRecipeCard(r));
}

export function closeOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    syncBodyScrollLock();
    restoreFocus();
  }
}

function updateServings(multiplier, recipe) {
  activeMultiplier = multiplier;
  const list = document.getElementById('ing-list');
  list.innerHTML = recipe.ingredients.map(ing => {
    const parsed = parseIngredient(ing);
    let text = ing;
    if (parsed) {
      const newAmount = formatAmount(parsed.amount * multiplier);
      text = `${newAmount} ${parsed.rest}`;
    }

    return `
      <li>
        <label class="ing-label">
          <input type="checkbox">
          <span class="ing-text">${escapeHtml(text)}</span>
        </label>
      </li>
    `;
  }).join('');

}

// -----------------------------------------------------------------------------
// FAVORITES GRID
// -----------------------------------------------------------------------------
export async function renderFavoritesGrid() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('no-favorites');
  const favs = store.state.favorites;
  if (!grid || !empty) return;
  
  grid.innerHTML = '';

  if (favs.length === 0) { 
    empty.style.display = 'block'; 
    return; 
  }
  empty.style.display = 'none';

  const frag = document.createDocumentFragment();
  const api = await import('./api.js');    
  const missingIds = favs.filter(id => !store.state.recipes[id]);
    if (missingIds.length > 0) {
      grid.textContent = 'Loading details...';
      grid.style.cssText = 'text-align:center; padding:40px; color:var(--ink-3); font-size:1.1rem; grid-column:1/-1;';
      try {
        await Promise.all(missingIds.map(id => api.fetchRecipeById(id)));
      } catch (err) {
        grid.textContent = 'Failed to load recipe details. Please check your connection.';
        return;
      }
    }

  const tmpl = document.getElementById('fav-item-template');
  for (const id of favs) {
    let r = store.state.recipes[id];
    if (!r || !tmpl) continue;

    const favContent = tmpl.content.cloneNode(true);
    const item = favContent.querySelector('.fav-item');
    item.setAttribute('aria-label', `Open saved recipe: ${r.title}`);
    
    const catSpan = item.querySelector('.fav-cat');
    catSpan.style.color = catColor(r.category);
    item.querySelector('.cat-dot').style.background = catColor(r.category);
    item.querySelector('.cat-name').textContent = r.category;
    item.querySelector('.fav-title').textContent = r.title;
    
    item.addEventListener('click', () => { 
      document.getElementById('fav-sheet').classList.add('hidden');
      syncBodyScrollLock();
      restoreFocus(); // Fix for focus flow
      navigateToRecipe(id); 
    });
    
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('fav-sheet').classList.add('hidden');
        syncBodyScrollLock();
        restoreFocus(); // Fix for focus flow
        navigateToRecipe(id);
      }
    });
    
    frag.appendChild(favContent);
  }
  
  grid.style.cssText = '';
  grid.textContent = ''; // clear in case it changed during await
  grid.appendChild(frag);
}

// -----------------------------------------------------------------------------
// CART
// -----------------------------------------------------------------------------
export async function renderCartItems() {
  const container = document.getElementById('cart-items');
  const empty = document.getElementById('no-cart');
  const actions = document.getElementById('cart-actions');
  const cart = store.state.cart;
  if (!container || !empty || !actions) return;
  
  container.innerHTML = '';

  if (cart.length === 0) { 
    empty.style.display = ''; 
    actions.style.display = 'none';
    return; 
  }
  
  empty.style.display = 'none';
  actions.style.display = 'block';

  const frag = document.createDocumentFragment();
  const api = await import('./api.js');    
  const missingIds = cart.filter(id => !store.state.recipes[id]);
    if (missingIds.length > 0) {
      container.textContent = 'Loading details...';
      container.style.cssText = 'text-align:center; padding:40px; color:var(--ink-3); font-size:1.1rem;';
      try {
        await Promise.all(missingIds.map(id => api.fetchRecipeById(id)));
      } catch (err) {
        container.textContent = 'Failed to load cart items. Please check your connection.';
        return;
      }
    }
  
    const groupTmpl = document.getElementById('cart-group-template');
    const itemTmpl = document.getElementById('cart-ingredient-template');

    for (const id of cart) {
      let r = store.state.recipes[id];
      if (!r || !groupTmpl || !itemTmpl) continue;
  
      const groupContent = groupTmpl.content.cloneNode(true);
      const group = groupContent.querySelector('.cart-recipe-group');
      group.querySelector('.cart-recipe-title').textContent = r.title;
      const ingList = group.querySelector('.cart-ingredients-list');
      
      r.ingredients.forEach(ing => {
        const itemContent = itemTmpl.content.cloneNode(true);
        itemContent.querySelector('.ing-text').textContent = ing;
        ingList.appendChild(itemContent);
      });
      frag.appendChild(groupContent);
    }
    
    container.style.cssText = '';
    container.textContent = ''; // clear in case it changed during await
    container.appendChild(frag);

  
  const clearBtn = document.getElementById('cart-clear');
  if (clearBtn) {
    clearBtn.onclick = () => store.clearCart();
  }
}

// -----------------------------------------------------------------------------
// COOKING MODE
// -----------------------------------------------------------------------------
let cookingSteps = [];
let currentCookingStep = 0;
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) { }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

export function openCookingMode(recipe) {
  cookingSteps = parseInstructionSteps(recipe.instructions);
  if (cookingSteps.length === 0) cookingSteps = ["No instructions available."];
  currentCookingStep = 0;
  
  document.getElementById('cooking-mode-title').textContent = recipe.title;
  updateCookingModeUI();
  
  const overlay = document.getElementById('cooking-mode-overlay');
  rememberFocus();
  overlay.classList.remove('hidden');
  focusFirstElement(overlay);
  syncBodyScrollLock();
  requestWakeLock();
}

export function closeCookingMode() {
  document.getElementById('cooking-mode-overlay').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
  releaseWakeLock();
}

export function updateCookingModeUI() {
  const textEl = document.getElementById('cooking-step-text');
  const progEl = document.getElementById('cooking-progress');
  const prevBtn = document.getElementById('cooking-prev');
  const nextBtn = document.getElementById('cooking-next');
  
  let stepText = cookingSteps[currentCookingStep].replace(/^\d+[\.\)]\s*/, '');
  textEl.innerHTML = formatSingleInstruction(stepText);
  progEl.textContent = `Step ${currentCookingStep + 1} of ${cookingSteps.length}`;
  
  prevBtn.disabled = currentCookingStep === 0;
  nextBtn.textContent = currentCookingStep === cookingSteps.length - 1 ? "Finish" : "Next Step";
}

export function nextCookingStep() {
    if (currentCookingStep < cookingSteps.length - 1) {
        currentCookingStep++;
        updateCookingModeUI();
    } else {
        closeCookingMode();
    }
}

export function prevCookingStep() {
    if (currentCookingStep > 0) {
        currentCookingStep--;
        updateCookingModeUI();
    }
}


// -----------------------------------------------------------------------------
// TIMERS
// -----------------------------------------------------------------------------
export function startTimer(amount, unit) {
  let ms = amount * 60000;
  if (unit.toLowerCase().startsWith('hr') || unit.toLowerCase().startsWith('hour')) {
    ms = amount * 3600000;
  }
  
  const timer = { id: Date.now(), end: Date.now() + ms, total: ms, done: false };
  activeTimers.push(timer);
  localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
  renderTimers();
  
  if (!windowTimerInterval) {
    windowTimerInterval = setInterval(updateTimers, 1000);
  }
}

function updateTimers() {
  if (activeTimers.length === 0) {
    clearInterval(windowTimerInterval);
    windowTimerInterval = null;
    return;
  }
  
  const now = Date.now();
  
  activeTimers.forEach(t => {
    if (now >= t.end && !t.done) {
      t.done = true;
      localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
      playDing();
    }
  });
  
  renderTimers();
}

export function removeTimer(id) {
  activeTimers = activeTimers.filter(t => t.id !== id);
  localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
  renderTimers();
}

export function renderTimers() {
  const container = document.getElementById('active-timers');
  if (!container) return;
  
  if (activeTimers.length === 0) {
    container.textContent = '';
    return;
  }
  
  container.textContent = '';
  const now = Date.now();
  const tmpl = document.getElementById('active-timer-template');
  
  activeTimers.forEach(t => {
    if (!tmpl) return;
    const tContent = tmpl.content.cloneNode(true);
    const tDiv = tContent.querySelector('.active-timer');
    
    const textSpan = tContent.querySelector('.timer-text');
    const closeBtn = tContent.querySelector('.timer-close');
    const bg = tContent.querySelector('.timer-ring-bg');
    const fg = tContent.querySelector('.timer-ring-fg');
    
    closeBtn.dataset.id = t.id;
    
    if (t.done) {
      tDiv.classList.add('active-timer--done');
      textSpan.textContent = 'Timer Done!';
      if (bg) bg.style.display = 'none';
      if (fg) fg.style.display = 'none';
    } else {
      const left = Math.max(0, t.end - now);
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
      const pct = ((t.total - left) / t.total) * 100;
      
      textSpan.textContent = timeStr;
      if (fg) fg.style.width = `${pct}%`;
    }
    
    container.appendChild(tContent);
  });
}

async function exportRecipeCard(r) {
  const template = document.getElementById('export-template');
  if (!template || !window.html2canvas) return;
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.export-card');
  
  const heroImg = card.querySelector('.export-hero');
  try {
    const res = await fetch(r.image);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    heroImg.src = dataUrl;
  } catch(e) {
    heroImg.src = r.image;
  }
  
  await new Promise(resolve => {
    if (heroImg.complete) resolve();
    else {
      heroImg.onload = resolve;
      heroImg.onerror = resolve;
    }
  });
  card.querySelector('.export-cat').textContent = r.category || 'Recipe';
  card.querySelector('.export-title').textContent = r.title;
  const meta = getRecipeMeta(r);
  const macros = r.ingredients ? renderMacros(generateMacrosFromIngredients(r.ingredients), 1 / meta.servings) : '';
  card.querySelector('.export-macros').innerHTML = macros;
  initDonuts(card.querySelector('.export-macros'));
  
  let ings = '';
  if (r.ingredients) {
    ings = r.ingredients.map(i => escapeHtml(i)).join('<br>');
  }
  card.querySelector('.export-ingredients').innerHTML = ings;
  
  card.style.position = 'fixed';
  card.style.top = '-9999px';
  card.style.left = '-9999px';
  document.body.appendChild(card);
  
  try {
    const canvas = await html2canvas(card, { scale: 2, useCORS: true, allowTaint: true });
    const link = document.createElement('a');
    link.download = r.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Export failed', err);
    alert('Sorry, the recipe could not be exported as an image. This is usually due to cross-origin restrictions on the recipe image.');
  } finally {
    document.body.removeChild(card);
  }
}
