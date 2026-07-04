import { store } from './store.js';
import { idbGet, idbSet } from './idb.js';

// Helper to parse full meal details and return a lightweight feed item
function processFullMeals(meals) {
  const newRecipes = {};
  const feedItems = [];

  if (meals && Array.isArray(meals)) {
    meals.forEach(meal => {
      const ingredients = [];
      for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && ingredient.trim() !== '') {
          const formattedMeasure = measure ? measure.trim() : '';
          ingredients.push(`${formattedMeasure} ${ingredient}`.trim());
        }
      }

      newRecipes[meal.idMeal] = {
        title: meal.strMeal || 'Unknown Recipe',
        image: meal.strMealThumb || '',
        instructions: meal.strInstructions || '',
        category: meal.strCategory || 'Other',
        ingredients: ingredients
      };

      feedItems.push({
        id: meal.idMeal,
        title: meal.strMeal,
        image: meal.strMealThumb,
        category: meal.strCategory || 'Other'
      });
    });
  }

  // Merge full details into store cache
  store.setRecipes({ ...store.state.recipes, ...newRecipes });
  return feedItems;
}

export async function fetchCategories(signal) {
  const cached = await idbGet('categories');
  if (cached) {
    store.setCategories(cached);
    return;
  }
  try {
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php', { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.categories && Array.isArray(data.categories)) {
      const cats = data.categories.map(c => c.strCategory).sort();
      idbSet('categories', cats);
      store.setCategories(cats);
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Error fetching categories:', err);
  }
}

export async function fetchRandomFeed(signal) {
  try {
    const letters = 'bcdefghiklmnoprstvw';
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${randomLetter}`, { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    const feed = processFullMeals(data.meals);
    store.setFeed(feed);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error loading random feed:', err);
      store.setFeed([]);
    }
  }
}

export async function fetchSearch(query, signal) {
  const cacheKey = `search_${query}`;
  const cached = await idbGet(cacheKey);
  if (cached) {
    store.setFeed(cached);
    return;
  }
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    const feed = processFullMeals(data.meals);
    idbSet(cacheKey, feed);
    store.setFeed(feed);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error searching recipes:', err);
      store.setFeed([]);
    }
  }
}

export async function fetchByCategory(category, signal) {
  const cacheKey = `cat_${category}`;
  const cached = await idbGet(cacheKey);
  if (cached) {
    store.setFeed(cached);
    return;
  }
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`, { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    const feedItems = [];
    if (data.meals && Array.isArray(data.meals)) {
      data.meals.forEach(meal => {
        feedItems.push({
          id: meal.idMeal,
          title: meal.strMeal,
          image: meal.strMealThumb,
          category: category // Filter endpoint doesn't return category, but we know it
        });
      });
    }
    
    idbSet(cacheKey, feedItems);
    store.setFeed(feedItems);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error fetching category:', err);
      store.setFeed([]);
    }
  }
}

export async function fetchRecipeById(id, signal) {
  // If we already have the full details cached in memory, skip fetch
  if (store.state.recipes[id]) return store.state.recipes[id];
  
  // Try IDB cache
  const cachedRecipe = await idbGet(`recipe_${id}`);
  if (cachedRecipe) {
    store.setRecipes({ ...store.state.recipes, [id]: cachedRecipe });
    return cachedRecipe;
  }

  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`, { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    processFullMeals(data.meals);
    
    // Save the fully processed recipe to IDB
    if (store.state.recipes[id]) {
      idbSet(`recipe_${id}`, store.state.recipes[id]);
    }
    
    return store.state.recipes[id];
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Error fetching recipe details:', err);
    return null;
  }
}

export async function fetchByIngredients(ingredientsArray, signal) {
  try {
    const fetchPromises = ingredientsArray.map(async (ing) => {
      const formattedIng = ing.toLowerCase().replace(/\s+/g, '_');
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${formattedIng}`, { signal });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.meals && Array.isArray(data.meals) ? data.meals.map(m => m.idMeal) : [];
    });

    const results = await Promise.all(fetchPromises);
    
    if (results.some(ids => ids.length === 0)) {
      store.setFeed([]);
      return;
    }

    let intersection = results[0];
    for (let i = 1; i < results.length; i++) {
      intersection = intersection.filter(id => results[i].includes(id));
    }

    if (!intersection || intersection.length === 0) {
      store.setFeed([]);
      return;
    }
    
    const feedItems = await Promise.all(intersection.map(async id => {
      const r = await fetchRecipeById(id, signal);
      if (!r) return null;
      return { id, title: r.title, image: r.image, category: r.category };
    }));
    store.setFeed(feedItems.filter(Boolean));
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error fetching by ingredients:', err);
      store.setFeed([]);
    }
  }
}
