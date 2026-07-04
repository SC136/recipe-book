import { store } from './store.js';
import { fetchCategories, fetchRandomFeed, fetchSearch, fetchByCategory, fetchByIngredients, fetchRecipeById } from './api.js';
import { setupRouter, navigateHome, navigateToRecipe } from './router.js';
import { 
  setupReactivity, renderFavoritesGrid, renderCartItems,
  closeOverlay, closeCookingMode, prevCookingStep, nextCookingStep,
  startTimer, removeTimer, renderSkeletonCards, initTimers
} from './components.js';
import { 
  rememberFocus, restoreFocus, syncBodyScrollLock, focusFirstElement, trapFocus, escapeHtml, triggerExplosion
} from './utils.js';

/* ── Chrome extension compat ── */
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

let closeMobileMenuHandler = null;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  setupReactivity();
  setupRouter(); // checks URL and sets activeRecipeId
  
  fetchCategories();
  renderSkeletonCards();
  initTimers();
  
  const searchBar = document.getElementById('search-bar');
  if (searchBar && searchBar.value.trim() !== '') {
    store.setSearchQuery(searchBar.value.trim());
    fetchSearch(searchBar.value.trim());
  } else if (store.state.activeCategory && store.state.activeCategory !== 'all') {
    fetchByCategory(store.state.activeCategory);
  } else {
    fetchRandomFeed();
  }

  initDarkMode();
  setupSearch();
  setupCategoryTabs();
  setupSheets();
  setupKeyboardShortcuts();
  setupScrollDetect();
  setupGlobalDelegation();
}

function setupGlobalDelegation() {
  document.addEventListener('click', async (e) => {
    // Timer click handlers
    if (e.target.closest('.timer-btn')) {
      const btn = e.target.closest('.timer-btn');
      startTimer(parseInt(btn.dataset.time), btn.dataset.unit);
      return;
    }
    if (e.target.closest('.timer-close')) {
      const id = parseInt(e.target.closest('.timer-close').dataset.id);
      removeTimer(id);
      return;
    }

    // Recipe Card Delegation
    const saveBtn = e.target.closest('.card-save');
    if (saveBtn) {
      e.stopPropagation();
      const id = saveBtn.dataset.recipeId;
      store.toggleFavorite(id);
      if (store.state.favorites.includes(id)) {
        const rect = saveBtn.getBoundingClientRect();
        triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      return;
    }

    const cartBtn = e.target.closest('.card-cart');
    if (cartBtn) {
      e.stopPropagation();
      const id = cartBtn.dataset.recipeId;
      store.toggleCart(id);
      if (store.state.cart.includes(id)) {
        const rect = cartBtn.getBoundingClientRect();
        triggerExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      return;
    }

    const card = e.target.closest('.recipe-card');
    if (card && e.target.closest('#recipes')) {
      const id = card.dataset.recipeId;
      if (!store.state.recipes[id]) {
        card.style.opacity = '0.6';
        card.style.pointerEvents = 'none';
        await fetchRecipeById(id);
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
      navigateToRecipe(id);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.recipe-card');
      if (card && e.target.closest('#recipes')) {
        e.preventDefault();
        card.click();
      }
    }
  });

  // Cooking mode handlers
  const cookingClose = document.getElementById('cooking-close');
  if (cookingClose) cookingClose.addEventListener('click', closeCookingMode);
  
  const cookingPrev = document.getElementById('cooking-prev');
  if (cookingPrev) cookingPrev.addEventListener('click', prevCookingStep);
  
  const cookingNext = document.getElementById('cooking-next');
  if (cookingNext) cookingNext.addEventListener('click', nextCookingStep);
}

function setupScrollDetect() {
  const nav = document.getElementById('topnav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 16);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH & CATEGORY FILTER
   ═══════════════════════════════════════════════════════════════ */
let currentAbortController = null;

function setupSearch() {
  const searchBar = document.getElementById('search-bar');
  const searchForm = document.getElementById('search-form');
  let debounceTimeout;
  
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      searchBar.blur();
    });
  }

  searchBar.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const query = e.target.value.trim();
      store.setSearchQuery(query);
      
      if (query !== '') {
        // Reset category to "Discover" visually and in state
        const hiddenSelect = document.getElementById('category-filter');
        if (hiddenSelect) hiddenSelect.value = 'all';
        store.setActiveCategory('all');
      }

      renderSkeletonCards();
      
      if (currentAbortController) currentAbortController.abort();
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      
      if (query === '') {
        fetchRandomFeed(signal);
      } else {
        fetchSearch(query, signal);
      }
    }, 300);
  });
}

function setupCategoryTabs() {
  const catBar = document.getElementById('cat-bar');
  const hiddenSelect = document.getElementById('category-filter');
  
  if (!catBar) return;

  catBar.addEventListener('click', (e) => {
    const tab = e.target.closest('.cat');
    if (!tab) return;

    const tabs = catBar.querySelectorAll('.cat');
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-current', 'false');
    });
    
    tab.classList.add('active');
    tab.setAttribute('aria-current', 'true');
    
    const cat = tab.dataset.category;
    if (hiddenSelect) hiddenSelect.value = cat;
    store.setActiveCategory(cat);
    
    const searchBar = document.getElementById('search-bar');
    if (searchBar && searchBar.value.trim() !== '') {
      searchBar.value = '';
      store.setSearchQuery('');
    }

    renderSkeletonCards();
    
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    
    if (cat === 'all') {
      fetchRandomFeed(signal);
    } else {
      fetchByCategory(cat, signal);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SHEETS (Overlay / Favorites / Contact)
   ═══════════════════════════════════════════════════════════════ */
function setupSheets() {
  const overlay = document.getElementById('overlay');
  const favSheet = document.getElementById('fav-sheet');
  const cartSheet = document.getElementById('cart-sheet');
  const fridgeSheet = document.getElementById('fridge-sheet');
  const contactSheet = document.getElementById('contact-sheet');

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('hidden')) trapFocus(e, overlay.querySelector('.panel-drawer'));
    else if (!favSheet.classList.contains('hidden')) trapFocus(e, favSheet.querySelector('.modal-box'));
    else if (!cartSheet.classList.contains('hidden')) trapFocus(e, cartSheet.querySelector('.modal-box'));
    else if (!fridgeSheet.classList.contains('hidden')) trapFocus(e, fridgeSheet.querySelector('.fridge-panel'));
    else if (!contactSheet.classList.contains('hidden')) trapFocus(e, contactSheet.querySelector('.modal-box'));
    else {
      const mobileMenu = document.getElementById('mobile-menu');
      if (!mobileMenu.classList.contains('hidden')) trapFocus(e, mobileMenu.querySelector('.mobile-menu-content'));
    }
  });

  const overlayCloseBtn = document.getElementById('overlay-close');
  if (overlayCloseBtn) {
    overlayCloseBtn.addEventListener('click', () => {
      navigateHome(); // This will trigger store.setActiveRecipe(null) which closes the overlay
    });
  }

  const overlayBackdrop = document.querySelector('#overlay .panel-backdrop');
  if (overlayBackdrop) {
    overlayBackdrop.addEventListener('click', () => {
      navigateHome();
    });
  }

  document.getElementById('btn-favs').addEventListener('click', openFavSheet);
  document.getElementById('fav-sheet-close').addEventListener('click', closeFavSheet);
  document.querySelector('#fav-sheet .modal-backdrop').addEventListener('click', closeFavSheet);

  document.getElementById('btn-cart').addEventListener('click', openCartSheet);
  document.getElementById('cart-sheet-close').addEventListener('click', closeCartSheet);
  document.querySelector('#cart-sheet .modal-backdrop').addEventListener('click', closeCartSheet);

  document.getElementById('btn-fridge').addEventListener('click', openFridgeSheet);
  document.getElementById('fridge-sheet-close').addEventListener('click', closeFridgeSheet);
  document.querySelector('#fridge-sheet .modal-backdrop').addEventListener('click', closeFridgeSheet);

  document.getElementById('btn-contact').addEventListener('click', openContactSheet);
  document.getElementById('contact-sheet-close').addEventListener('click', closeContactSheet);
  document.querySelector('#contact-sheet .modal-backdrop').addEventListener('click', closeContactSheet);

  /* Mobile Menu */
  const mobMenu = document.getElementById('mobile-menu');
  const mobBtn = document.getElementById('mobile-menu-btn');
  const mobClose = document.getElementById('mobile-menu-close');
  const mobBackdrop = document.querySelector('.mobile-menu-backdrop');

  if (mobBtn) {
    mobBtn.addEventListener('click', () => {
      rememberFocus();
      mobMenu.classList.remove('hidden');
      mobBtn.setAttribute('aria-expanded', 'true');
      focusFirstElement(mobMenu.querySelector('.mobile-menu-content'));
      syncBodyScrollLock();
    });
  }

  function closeMobileMenu() {
    if (mobMenu) {
      mobMenu.classList.add('hidden');
      if (mobBtn) mobBtn.setAttribute('aria-expanded', 'false');
      syncBodyScrollLock();
      restoreFocus();
    }
  }

  closeMobileMenuHandler = closeMobileMenu;

  if (mobClose) mobClose.addEventListener('click', closeMobileMenu);
  if (mobBackdrop) mobBackdrop.addEventListener('click', closeMobileMenu);

  document.getElementById('mob-favs').addEventListener('click', () => {
    closeMobileMenu();
    openFavSheet();
  });

  document.getElementById('mob-cart').addEventListener('click', () => {
    closeMobileMenu();
    openCartSheet();
  });

  document.getElementById('mob-contact').addEventListener('click', () => {
    closeMobileMenu();
    openContactSheet();
  });

  document.getElementById('mob-fridge').addEventListener('click', () => {
    closeMobileMenu();
    openFridgeSheet();
  });

  let fridgeIngredients = [];
  const fridgeForm = document.getElementById('fridge-form');
  const fridgeInput = document.getElementById('fridge-input');
  const pillContainer = document.getElementById('fridge-pill-container');
  const fridgeSearchBtn = document.getElementById('fridge-search-btn');

  function renderPills() {
    if (!pillContainer) return;
    pillContainer.innerHTML = '';
    fridgeIngredients.forEach((ing, index) => {
      const pill = document.createElement('div');
      pill.className = 'ingredient-pill';
      pill.innerHTML = `
        ${escapeHtml(ing)}
        <button type="button" aria-label="Remove ${escapeHtml(ing)}">&times;</button>
      `;
      pill.querySelector('button').addEventListener('click', () => {
        fridgeIngredients.splice(index, 1);
        renderPills();
      });
      pillContainer.appendChild(pill);
    });
  }

  if (fridgeInput) {
    fridgeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const input = fridgeInput.value.trim();
        if (!input) return;
        if (!fridgeIngredients.includes(input)) {
          fridgeIngredients.push(input);
          renderPills();
        }
        fridgeInput.value = '';
      }
    });
  }

  if (fridgeForm) {
    fridgeForm.addEventListener('submit', (e) => {
      e.preventDefault(); // Catch any stray form submissions
    });
  }

  if (fridgeSearchBtn) {
    fridgeSearchBtn.addEventListener('click', () => {
      if (fridgeIngredients.length === 0) return;
      closeFridgeSheet();
      renderSkeletonCards();
      
      if (currentAbortController) currentAbortController.abort();
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      
      fetchByIngredients(fridgeIngredients, signal);
    });
  }
}

function openFavSheet() {
  const sheet = document.getElementById('fav-sheet');
  rememberFocus();
  sheet.classList.remove('hidden');
  focusFirstElement(sheet.querySelector('.modal-box'));
  syncBodyScrollLock();
}
function closeFavSheet() {
  document.getElementById('fav-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

function openCartSheet() {
  document.getElementById('cart-sheet').classList.remove('hidden');
  syncBodyScrollLock();
  focusFirstElement(document.getElementById('cart-sheet'));
}
function closeCartSheet() {
  document.getElementById('cart-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

function openFridgeSheet() {
  document.getElementById('fridge-sheet').classList.remove('hidden');
  syncBodyScrollLock();
  focusFirstElement(document.getElementById('fridge-sheet'));
}
function closeFridgeSheet() {
  document.getElementById('fridge-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

function openContactSheet() {
  const sheet = document.getElementById('contact-sheet');
  rememberFocus();
  sheet.classList.remove('hidden');
  focusFirstElement(sheet.querySelector('.modal-box'));
  syncBodyScrollLock();
}
function closeContactSheet() {
  document.getElementById('contact-sheet').classList.add('hidden');
  syncBodyScrollLock();
  restoreFocus();
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE
   ═══════════════════════════════════════════════════════════════ */
function initDarkMode() {
  const btn = document.getElementById('toggle-dark-mode');
  
  const readTheme = () => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  };
  const writeTheme = (val) => {
    try { localStorage.setItem('theme', val); } catch {}
  };

  if (readTheme() === 'dark') {
    document.body.classList.add('dark');
  }

  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
    writeTheme(mode);
  });
}

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      document.getElementById('search-bar').focus();
    }
    if (e.key === 'Escape') {
      document.getElementById('search-bar').blur();
      const overlay = document.getElementById('overlay');
      const favSheet = document.getElementById('fav-sheet');
      const cartSheet = document.getElementById('cart-sheet');
      const fridgeSheet = document.getElementById('fridge-sheet');
      const contactSheet = document.getElementById('contact-sheet');
      const mobileMenu = document.getElementById('mobile-menu');
      const cookingMode = document.getElementById('cooking-mode-overlay');

      if (cookingMode && !cookingMode.classList.contains('hidden')) {
        closeCookingMode();
      } else if (!mobileMenu.classList.contains('hidden') && closeMobileMenuHandler) {
        closeMobileMenuHandler();
      } else if (!overlay.classList.contains('hidden')) {
        navigateHome();
      } else if (!favSheet.classList.contains('hidden')) {
        closeFavSheet();
      } else if (!cartSheet.classList.contains('hidden')) {
        closeCartSheet();
      } else if (!fridgeSheet.classList.contains('hidden')) {
        closeFridgeSheet();
      } else if (!contactSheet.classList.contains('hidden')) {
        closeContactSheet();
      }
    }
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(err => {
    console.error('Service Worker registration failed:', err);
  });
}
