-- Starter recipes for the public recipe book (Fitoor Kitchen). Safe to re-run: skips titles that already exist.
-- Steps are written in our own words; "Reference" links credit a well-known recipe site for the dish.
-- Nutrition is an approximate estimate per serving.

with admin as (select id from public.profiles where role = 'super_admin' order by created_at limit 1),
seed (title, summary, diet, tags, meal_types, prep_min, cook_min, servings, kcal, protein_g, carbs_g, fat_g, ingredients, steps, tips, source_name, source_url) as (values
(
  'Moong Dal Chilla (High-Protein Lentil Pancakes)',
  'Crisp, savoury pancakes made from soaked yellow moong dal. A filling high-protein breakfast with no flour and very little oil.',
  'veg', array['weight_loss','high_protein','low_gi','diabetes_friendly','pcos_friendly'], array['breakfast','snack'],
  10, 15, 2, 230, 14, 30, 5,
  '[{"qty":"1 cup","item":"yellow moong dal, soaked 2–4 hours and drained"},{"qty":"1 inch","item":"ginger"},{"qty":"1–2","item":"green chillies"},{"qty":"½ tsp","item":"cumin seeds"},{"qty":"¼ tsp","item":"turmeric"},{"qty":"to taste","item":"salt"},{"qty":"1 small","item":"onion, finely chopped"},{"qty":"2 tbsp","item":"fresh coriander, chopped"},{"qty":"¼ cup","item":"grated paneer (optional, for extra protein)"},{"qty":"1 tsp","item":"oil, for the pan"}]'::jsonb,
  array['Grind the soaked dal with ginger, green chillies, cumin and a few spoons of water into a smooth, pourable batter (like dosa batter).','Stir in turmeric, salt, onion and coriander.','Heat a non-stick tawa on medium. Wipe it with a few drops of oil.','Pour a ladle of batter in the centre and spread it into a thin circle. Sprinkle a little paneer on top if using.','Cook until the edges lift and the base is golden, about 2 minutes. Flip and cook 1 more minute.','Repeat with the rest of the batter. Serve hot with green chutney or curd.'],
  'Soak the dal the night before to make this a 15-minute breakfast. The batter keeps 2 days in the fridge.',
  'Swasthi''s Recipes (Indian Healthy Recipes)', 'https://www.indianhealthyrecipes.com/oats-green-gram-dosa/'
),
(
  'Moong Sprouts Salad',
  'A crunchy, tangy salad of lightly blanched moong sprouts with onion, tomato, cucumber and lemon. Ready in 10 minutes.',
  'veg', array['weight_loss','high_protein','no_cook','quick','diabetes_friendly'], array['lunch','snack'],
  10, 2, 2, 150, 9, 22, 2,
  '[{"qty":"1½ cups","item":"moong sprouts"},{"qty":"1 small","item":"onion, finely chopped"},{"qty":"1","item":"tomato, deseeded and chopped"},{"qty":"½","item":"cucumber, chopped"},{"qty":"1","item":"green chilli, finely chopped (optional)"},{"qty":"½ tsp","item":"roasted cumin powder"},{"qty":"½ tsp","item":"chaat masala"},{"qty":"to taste","item":"salt"},{"qty":"1 tbsp","item":"lemon juice"},{"qty":"2 tbsp","item":"fresh coriander, chopped"}]'::jsonb,
  array['Pour hot water over the sprouts, leave for 1–2 minutes, then drain. This softens them slightly and makes them easier to digest.','Add onion, tomato, cucumber and green chilli to the sprouts.','Sprinkle cumin powder, chaat masala and salt. Squeeze in the lemon juice.','Mix well, top with coriander and serve straight away.'],
  'Add a handful of roasted peanuts or pomegranate for crunch. Add salt just before serving so the salad doesn’t turn watery.',
  'Hebbar''s Kitchen', 'https://hebbarskitchen.com/sprout-salad-recipe-moong-bean-sprout/'
),
(
  'Light Palak Paneer (No Cream)',
  'Soft paneer in a bright green spinach gravy, made without cream and with very little oil. Pairs well with phulka or millet roti.',
  'veg', array['high_protein','low_gi','pcos_friendly','diabetes_friendly'], array['lunch','dinner'],
  15, 20, 3, 260, 15, 9, 18,
  '[{"qty":"1 large bunch (about 300 g)","item":"spinach (palak), washed"},{"qty":"200 g","item":"paneer, cubed"},{"qty":"1 tbsp","item":"oil or ghee"},{"qty":"1 tsp","item":"cumin seeds"},{"qty":"1","item":"onion, finely chopped"},{"qty":"1 tbsp","item":"ginger-garlic paste"},{"qty":"1–2","item":"green chillies"},{"qty":"1","item":"tomato, chopped"},{"qty":"½ tsp","item":"garam masala"},{"qty":"½ tsp","item":"kasuri methi, crushed"},{"qty":"to taste","item":"salt"},{"qty":"2 tbsp","item":"thick curd, whisked (optional, for creaminess)"}]'::jsonb,
  array['Blanch the spinach in boiling water for 2 minutes, then move it to cold water so it stays green. Blend with the green chillies into a smooth purée.','Heat oil in a pan, add cumin seeds and let them crackle. Add onion and cook until light golden.','Add ginger-garlic paste and cook for a minute, then add the tomato and cook until soft.','Pour in the spinach purée, salt and ½ cup water. Simmer for 4–5 minutes.','Add the paneer, garam masala and kasuri methi. Simmer 2 more minutes.','Turn off the heat and stir in the whisked curd, if using. Serve hot.'],
  'Don’t overcook the spinach after blending: it turns dark and loses flavour. Swap paneer for tofu to make it vegan.',
  'Dassana''s Veg Recipes', 'https://www.vegrecipesofindia.com/palak-paneer/'
),
(
  'Vegetable Masala Oats',
  'Savoury Indian-style oats cooked with vegetables and spices. A warm, fibre-rich breakfast or light dinner in one pot.',
  'veg', array['weight_loss','heart_healthy','quick','gut_health'], array['breakfast','dinner'],
  5, 15, 2, 210, 7, 32, 6,
  '[{"qty":"¾ cup","item":"rolled oats"},{"qty":"1 tsp","item":"oil"},{"qty":"½ tsp","item":"mustard or cumin seeds"},{"qty":"1 small","item":"onion, chopped"},{"qty":"1 tsp","item":"ginger, grated"},{"qty":"1","item":"green chilli, chopped"},{"qty":"1","item":"tomato, chopped"},{"qty":"1 cup","item":"mixed vegetables (carrot, beans, peas, capsicum), chopped"},{"qty":"¼ tsp","item":"turmeric"},{"qty":"½ tsp","item":"red chilli powder"},{"qty":"¼ tsp","item":"garam masala"},{"qty":"to taste","item":"salt"},{"qty":"2 cups","item":"water"},{"qty":"1 tsp","item":"lemon juice"},{"qty":"2 tbsp","item":"fresh coriander"}]'::jsonb,
  array['Heat oil in a pan and add the mustard or cumin seeds. When they splutter, add onion, ginger and green chilli and cook for 2 minutes.','Add the tomato and vegetables with turmeric, chilli powder and salt. Cook covered for 4–5 minutes until the vegetables are just tender.','Add the oats and stir for a minute.','Pour in the water and simmer, stirring now and then, until the oats are soft and thick, 3–5 minutes.','Stir in garam masala. Finish with lemon juice and coriander and serve hot.'],
  'Use rolled or steel-cut oats rather than instant flavoured packs, which are higher in salt. Stir in a spoon of roasted peanuts or a boiled egg for more protein.',
  'Swasthi''s Recipes (Indian Healthy Recipes)', 'https://www.indianhealthyrecipes.com/masala-oats-recipe/'
),
(
  'Egg Bhurji (Anda Bhurji)',
  'Spiced Indian scrambled eggs with onion, tomato and green chilli. High in protein and ready in 15 minutes.',
  'egg', array['high_protein','quick','low_gi','pcos_friendly'], array['breakfast','dinner'],
  5, 10, 2, 220, 14, 6, 15,
  '[{"qty":"4","item":"eggs"},{"qty":"1 tsp","item":"oil or butter"},{"qty":"½ tsp","item":"cumin seeds"},{"qty":"1","item":"onion, finely chopped"},{"qty":"1","item":"green chilli, chopped"},{"qty":"½ tsp","item":"ginger-garlic paste"},{"qty":"1","item":"tomato, finely chopped"},{"qty":"¼ tsp","item":"turmeric"},{"qty":"½ tsp","item":"red chilli powder"},{"qty":"¼ tsp","item":"garam masala or pav bhaji masala"},{"qty":"to taste","item":"salt"},{"qty":"2 tbsp","item":"fresh coriander"}]'::jsonb,
  array['Crack the eggs into a bowl with a pinch of salt and beat lightly.','Heat oil in a pan, add cumin seeds, then the onion and green chilli. Cook until the onion is soft.','Add ginger-garlic paste and the tomato with turmeric, chilli powder and salt. Cook until the tomato turns mushy.','Lower the heat and pour in the eggs. Leave for a few seconds, then keep scrambling gently until just set.','Sprinkle garam masala and coriander. Take off the heat while still soft; it keeps cooking in the pan.'],
  'For a lighter version use 2 whole eggs + 3 egg whites. Serve with multigrain toast or a phulka and salad.',
  'Swasthi''s Recipes (Indian Healthy Recipes)', 'https://www.indianhealthyrecipes.com/egg-bhurji-andhra-egg-porutu/'
),
(
  'Tandoori Chicken in the Oven or Air Fryer',
  'Smoky, yoghurt-marinated chicken cooked in the oven or air fryer: no tandoor and no deep frying. Lean, high-protein and great with salad.',
  'nonveg', array['high_protein','weight_loss','low_gi'], array['lunch','dinner'],
  15, 25, 3, 250, 32, 5, 11,
  '[{"qty":"500 g","item":"chicken (skinless legs or breast), with deep cuts"},{"qty":"1 tbsp","item":"lemon juice"},{"qty":"½ tsp","item":"salt"},{"qty":"1 tsp","item":"Kashmiri red chilli powder"},{"qty":"½ cup","item":"thick hung curd"},{"qty":"1 tbsp","item":"ginger-garlic paste"},{"qty":"1 tsp","item":"garam masala"},{"qty":"1 tsp","item":"coriander powder"},{"qty":"½ tsp","item":"cumin powder"},{"qty":"½ tsp","item":"kasuri methi, crushed"},{"qty":"1 tsp","item":"mustard oil or any oil"}]'::jsonb,
  array['Rub the chicken with lemon juice, salt and chilli powder. Rest for 15 minutes.','Mix the curd with ginger-garlic paste, spices, kasuri methi and oil. Coat the chicken well, pushing the marinade into the cuts.','Cover and refrigerate for at least 1 hour (overnight is best).','Oven: bake on a rack at 220 °C for 20–25 minutes, turning once. Air fryer: cook at 200 °C for 16–20 minutes, turning halfway.','Check the thickest piece is cooked through, then rest for 5 minutes. Serve with onion rings, lemon and mint chutney.'],
  'Use hung curd so the marinade sticks and chars. Skip the food colour: Kashmiri chilli gives the red.',
  'Swasthi''s Recipes (Indian Healthy Recipes)', 'https://www.indianhealthyrecipes.com/tandoori-chicken/'
))
insert into public.recipes (title, summary, diet, tags, meal_types, prep_min, cook_min, servings, kcal, protein_g, carbs_g, fat_g, ingredients, steps, tips, source_name, source_url, author_id, status)
select s.title, s.summary, s.diet, s.tags, s.meal_types, s.prep_min, s.cook_min, s.servings, s.kcal, s.protein_g, s.carbs_g, s.fat_g, s.ingredients, s.steps, s.tips, s.source_name, s.source_url, (select id from admin), 'public'
from seed s
where not exists (select 1 from public.recipes r where r.title = s.title);

select slug, diet, status from public.recipes order by created_at;
