export const recipes = {
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
    recipe2: {
        title: 'Grilled Salmon Salad',
        image: 'images/recipe.jpg',
        description: 'A healthy salad featuring grilled salmon and mixed greens.',
        ingredients: [
            '1 cup of ingredient D',
            '2 tbsp of ingredient E',
            '3 pieces of ingredient F'
        ],
        instructions: 'Mix all ingredients together and cook for 30 minutes.',
        nutrition: 'Calories: 250, Protein: 15g, Fat: 7g, Carbs: 40g',
        category: 'dessert'
    },
    recipe3: {
        title: 'Chocolate Lava Cake',
        image: 'images/recipe.jpg',
        description: 'Decadent chocolate cake with a gooey molten center.',
        ingredients: [
            '1 cup of ingredient G',
            '2 tbsp of ingredient H',
            '3 pieces of ingredient I'
        ],
        instructions: 'Mix all ingredients together and cook for 30 minutes.',
        nutrition: 'Calories: 250, Protein: 15g, Fat: 7g, Carbs: 40g',
        category: 'dessert'
    }
    // add more recipes as needed
};

console.log('Recipes loaded:', Object.keys(recipes).length);
