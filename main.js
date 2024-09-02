import { recipes } from './recipes.js';

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

console.log('main.js loaded');

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    console.log('Initializing app');
    generateRecipeCards();
    addFeaturedRecipe();
    initDarkMode();
    setupEventListeners();
    setupNavigation();
    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
}

function setupEventListeners() {
    document.getElementById('search-bar').addEventListener('input', filterRecipes);
    document.getElementById('category-filter').addEventListener('change', filterRecipes);
}

function generateRecipeCards() {
    const recipesContainer = document.getElementById('recipes');
    recipesContainer.innerHTML = '';

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                observer.unobserve(img);
            }
        });
    }, { rootMargin: "0px 0px 50px 0px" });

    Object.keys(recipes).forEach(recipeId => {
        const recipe = recipes[recipeId];
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.setAttribute('data-category', recipe.category);

        card.innerHTML = `
            <img data-src="${recipe.image}" alt="${recipe.title}" loading="lazy">
            <h3>${recipe.title}</h3>
            <p>${recipe.description.substring(0, 50)}...</p>
            <button class="view-recipe-btn" data-recipe-id="${recipeId}">View Recipe</button>
        `;

        const img = card.querySelector('img');
        observer.observe(img);

        recipesContainer.appendChild(card);
    });

    document.querySelectorAll('.view-recipe-btn').forEach(button => {
        button.addEventListener('click', function () {
            const recipeId = this.getAttribute('data-recipe-id');
            viewRecipe(recipeId);
        });
    });

    console.log('Recipe cards generated');
}

function setupNavigation() {
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('show');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            // Hide recipe details if they're visible
            if (document.getElementById('recipe-details').style.display === 'block') {
                hideRecipeDetails();
            }

            // Scroll to the target section
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
                navMenu.classList.remove('show');
            }

            // Additional logic for home and recipes links
            if (targetId === 'home') {
                document.getElementById('featured-recipe').style.display = 'block';
                document.getElementById('recipes').style.display = 'flex';
                document.getElementById('recipes-title').style.display = 'block';
            } else if (targetId === 'recipes') {
                document.getElementById('recipes').style.display = 'flex';
                document.getElementById('recipes-title').style.display = 'block';
            }
        });
    });
}

function viewRecipe(recipeId) {
    console.log('Viewing recipe:', recipeId);
    const recipe = recipes[recipeId];
    if (!recipe) {
        console.error('Recipe not found');
        alert('Sorry, there was an error loading the recipe. Please try again.');
        return;
    }

    document.getElementById('recipes-title').style.display = 'none';
    document.getElementById('recipes').style.display = 'none';
    const recipeDetails = document.getElementById('recipe-details');
    recipeDetails.style.display = 'block';
    recipeDetails.innerHTML = '';

    const content = `
        <h2 id="recipe-title">${recipe.title}</h2>
        <img id="recipe-image" src="${recipe.image}" alt="${recipe.title}" loading="lazy">
        <p id="recipe-description">${recipe.description}</p>
        <h3>Ingredients:</h3>
        <ul id="recipe-ingredients">
            ${recipe.ingredients.map(ingredient => `<li>${ingredient}</li>`).join('')}
        </ul>
        <h3>Instructions:</h3>
        <p id="recipe-instructions">${recipe.instructions}</p>
        <p id="recipe-nutrition">${recipe.nutrition}</p>
    `;
    recipeDetails.innerHTML = content;

    const favoriteButton = document.createElement('button');
    favoriteButton.id = 'favorite-button';
    favoriteButton.onclick = () => toggleFavorite(recipeId);
    recipeDetails.appendChild(favoriteButton);
    updateFavoriteButton(recipeId);

    const printButton = document.createElement('button');
    printButton.textContent = 'Print Recipe';
    printButton.onclick = printRecipe;
    recipeDetails.appendChild(printButton);

    // const shareButton = document.createElement('button');
    // shareButton.textContent = 'Share Recipe';
    // shareButton.onclick = shareRecipe;
    // recipeDetails.appendChild(shareButton);

    addCookingTimer();

    const backButton = document.createElement('button');
    backButton.textContent = 'Back to Recipes';
    backButton.onclick = hideRecipeDetails;
    recipeDetails.appendChild(backButton);

    console.log('Recipe details populated, back button added');
}

// Modify the hideRecipeDetails function
function hideRecipeDetails() {
    console.log('Hiding recipe details');
    document.getElementById('recipes-title').style.display = 'block';
    document.getElementById('recipes').style.display = 'flex';
    document.getElementById('recipe-details').style.display = 'none';
    document.getElementById('recipes').scrollIntoView({ behavior: 'smooth' });
}

function filterRecipes() {
    const searchValue = document.getElementById('search-bar').value.toLowerCase();
    const categoryValue = document.getElementById('category-filter').value;

    document.querySelectorAll('.recipe-card').forEach(card => {
        const title = card.querySelector('h3').innerText.toLowerCase();
        const category = card.getAttribute('data-category');

        if ((title.includes(searchValue) || searchValue === '') &&
            (category === categoryValue || categoryValue === 'all')) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function toggleFavorite(recipeId) {
    if (typeof localStorage === 'undefined') {
        console.warn('localStorage is not available');
        return;
    }

    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    const index = favorites.indexOf(recipeId);

    if (index === -1) {
        favorites.push(recipeId);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteButton(recipeId);
}

function updateFavoriteButton(recipeId) {
    if (typeof localStorage === 'undefined') {
        console.warn('localStorage is not available');
        return;
    }

    const favoriteButton = document.getElementById('favorite-button');
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    if (favorites.includes(recipeId)) {
        favoriteButton.innerHTML = '❤ Remove from Favorites';
        favoriteButton.classList.add('favorited');
    } else {
        favoriteButton.innerHTML = '❤ Add to Favorites';
        favoriteButton.classList.remove('favorited');
    }
}

function addFeaturedRecipe() {
    const featuredRecipeId = Object.keys(recipes)[Math.floor(Math.random() * Object.keys(recipes).length)];
    const featuredRecipe = recipes[featuredRecipeId];

    const featuredSection = document.getElementById('featured-recipe');
    featuredSection.innerHTML = `
        <h2>Featured Recipe</h2>
        <div class="featured-recipe-card">
            <img src="${featuredRecipe.image}" alt="${featuredRecipe.title}">
            <div class="featured-recipe-content">
                <h3>${featuredRecipe.title}</h3>
                <p>${featuredRecipe.description}</p>
                <button class="view-recipe-btn" data-recipe-id="${featuredRecipeId}">View Recipe</button>
            </div>
        </div>
    `;

    featuredSection.querySelector('.view-recipe-btn').addEventListener('click', function () {
        const recipeId = this.getAttribute('data-recipe-id');
        viewRecipe(recipeId);
        window.scrollBy(0, 500);
    });

    // Set initial style based on current theme
    updateFeaturedRecipeStyle();
}

function printRecipe() {
    const recipeDetails = document.getElementById('recipe-details').cloneNode(true);
    recipeDetails.querySelectorAll('button').forEach(button => button.remove());

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Print Recipe</title>');
    printWindow.document.write('<link rel="stylesheet" href="styles.css">');
    printWindow.document.write('</head><body>');
    printWindow.document.write(recipeDetails.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function addCookingTimer() {
    const timerSection = document.createElement('div');
    timerSection.id = 'cooking-timer';
    timerSection.innerHTML = `
        <h3>Cooking Timer</h3>
        <input type="number" id="timer-minutes" min="1" max="120" value="5">
        <button id="start-timer-btn">Start Timer</button>
        <div id="timer-display"></div>
    `;
    document.getElementById('recipe-details').appendChild(timerSection);

    document.getElementById('start-timer-btn').addEventListener('click', startTimer);
}

function startTimer() {
    const minutes = parseInt(document.getElementById('timer-minutes').value);
    let seconds = minutes * 60;
    const timerDisplay = document.getElementById('timer-display');

    const countDown = setInterval(() => {
        const minutesLeft = Math.floor(seconds / 60);
        const secondsLeft = seconds % 60;
        timerDisplay.textContent = `${minutesLeft}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;

        if (seconds === 0) {
            clearInterval(countDown);
            timerDisplay.textContent = "Time's up!";
            alert("Timer finished!");
        }
        seconds--;
    }, 1000);
}

// function shareRecipe() {
//     try {
//         const recipeUrl = window.location.href;
//         const shareText = `Check out this delicious recipe: ${recipeUrl}`;

//         if (navigator.share) {
//             navigator.share({
//                 title: 'Share Recipe',
//                 text: shareText,
//                 url: recipeUrl,
//             })
//                 .then(() => console.log('Successful share'))
//                 .catch((error) => {
//                     console.error('Error sharing:', error);
//                     fallbackShare(recipeUrl);
//                 });
//         } else {
//             fallbackShare(recipeUrl);
//         }
//     } catch (error) {
//         console.error('Error in shareRecipe:', error);
//         alert('Sorry, there was an error sharing the recipe. Please try again.');
//     }
// }

function fallbackShare(recipeUrl) {
    const result = prompt('Copy this link to share the recipe:', recipeUrl);
    if (result !== null) {
        alert('Link copied to clipboard!');
    }
}

function initDarkMode() {
    const toggleButton = document.getElementById('toggle-dark-mode');

    toggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const currentMode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

        toggleButton.textContent = currentMode === 'dark' ? '🌞' : '🌚';
        localStorage.setItem('theme', currentMode);

        // Update featured recipe
        updateFeaturedRecipeStyle();
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleButton.textContent = '🌞';
    }

    // Initial update of featured recipe style
    updateFeaturedRecipeStyle();
}

function updateFeaturedRecipeStyle() {
    const featuredRecipeCard = document.querySelector('.featured-recipe-card');
    if (featuredRecipeCard) {
        if (document.body.classList.contains('dark-mode')) {
            featuredRecipeCard.style.backgroundColor = '#333';
            featuredRecipeCard.style.color = '#f0f0f0';
        } else {
            featuredRecipeCard.style.backgroundColor = '#fff5e6';
            featuredRecipeCard.style.color = '#333';
        }
    }
}

// Make necessary functions globally available
Object.assign(window, {
    viewRecipe,
    hideRecipeDetails,
    filterRecipes,
    startTimer,
    toggleFavorite,
    printRecipe,
    // shareRecipe
});

console.log('Global assignments completed');
