# Cooking for Cooked's

Welcome to Cooking for Cooked's! This website is a comprehensive recipe book where you can discover a variety of delicious recipes to try at home. From appetizers to desserts, find your next favorite dish!

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Service Worker](#service-worker)
- [Manifest](#manifest)
- [Contributing](#contributing)

## Features

- **Recipe Search**: Search for recipes using the search bar.
- **Category Filter**: Filter recipes by category.
- **Featured Recipe**: Highlighted featured recipe section.
- **Dark Mode**: Toggle between light and dark mode.
- **Responsive Design**: Mobile-friendly design.
- **Offline Support**: Service worker for offline capabilities.

## Installation

To run this project locally, follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/SC136/recipe-book.git
   ```

2. Navigate to the project directory:

   ```sh
   cd recipe-book
   ```

3. Open `index.html` in your browser to view the website.

## Usage

### HTML Structure

The main HTML structure is defined in the `index.html` file.

### CSS Styles

The styles for the website are defined in the `styles.css` file.

### JavaScript Functionality

The main JavaScript functionality is defined in the `main.js` file.

### Service Worker

The service worker, defined in the `service-worker.js` file, is used to cache resources for offline use.

### Manifest

The web app manifest, defined in the `manifest.json` file, provides metadata for the web application.

## Contributing

We welcome contributions from the community! To contribute, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with clear and descriptive messages.
4. Push your changes to your forked repository.
5. Open a pull request to the main repository with a detailed description of your changes.

Thank you for your contributions!

### Adding Recipes to the Site

To add a new recipe to the site, follow these steps:

1. **Update `recipes.js`:**

   - Open the `recipes.js` file.
   - Add a new recipe object to the `recipes` array with the following properties:
     - `title`: The name of the recipe.
     - `image`: The path to the recipe image.
     - `description`: A brief description of the recipe.
     - `ingredients`: A list of ingredients required for the recipe.
     - `instructions`: Step-by-step instructions on how to prepare the recipe.
     - `nutrition`: Nutritional information for the recipe.
     - `category`: The category of the recipe (e.g., breakfast, dessert).

2. **Add Recipe Image:**
   - Place the recipe image in the `images` folder.
   - Ensure the image path in the `recipes.js` file matches the location of the image in the `images` folder.

Example of adding a new recipe in `recipes.js`:

```javascript
const recipes = {
    recipe1: {
        title: 'Blueberry Pancakes',
        image: 'images/recipe.jpg',
        description: 'Fluffy pancakes loaded with fresh blueberries.',
        ingredients: [
            '1 cup of ingredient A',
            '2 tbsp of ingredient B',
            '3 pieces of ingredient C'
        ],
        instructions: 'Mix all ingredients together and cook for 20 minutes.',
        nutrition: 'Calories: 200, Protein: 10g, Fat: 5g, Carbs: 30g',
        category: 'breakfast'
    },
};
```
