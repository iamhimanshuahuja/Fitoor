-- Default diet template (from the "Alkaline diet with high-protein breakfast and light dinners" chart).
-- Admin can copy this template to any user from the Admin > User > Diet plan screen.
insert into public.diet_plans (user_id, title, is_template, is_active, slots, guidelines)
select null, 'Alkaline diet — high-protein breakfast, light dinner', true, true,
'[
 {"key":"early_morning","label":"Early Morning","title":"Detox water",
  "items":["1 tsp mix — methi, cinnamon, saunf, jeera"],"avoid":[]},
 {"key":"before_breakfast","label":"Before Breakfast","title":"Herbal / green smoothie",
  "items":["Major greens (cucumber / bottle gourd / ash gourd) — 1 cup","Minor greens (coriander / mint / curry / paan / tulsi) — 5-10 leaves","Fruit — 1/2 apple / guava / peach / pear","Pinch of cinnamon and black salt","Blend to chutney consistency, add 1 cup water and lemon"],
  "avoid":["Milk tea","Coffee"]},
 {"key":"breakfast","label":"Breakfast","title":"High-protein breakfast",
  "items":["Besan chilla (veg / paneer stuffing)","Boiled / steamed sprout or chana salad — 1 bowl","Overnight soaked oats — 1 bowl","Avocado toast — 2 slices","Paneer paratha / dal paratha","Moong dal idli — veg fried / sambhar","Add green chutney daily"],
  "avoid":["Poha","Upma","Vermicelli","Breads","Macaroni"]},
 {"key":"lunch","label":"Lunch","title":"25% plate rule (divide plate in 4 parts)",
  "items":["Salads","Cooked seasonal veg","Dal / chana / rajma / paneer / peanut curd","Rice or roti"],
  "avoid":["Large portions"]},
 {"key":"evening","label":"Evening","title":"Light snacks",
  "items":["Tea — green / black / coffee / saunf water / rosemary / chamomile","Nuts — soaked 10 almonds + 3 walnuts","Mixed seeds — 1-2 tsp","If still hungry: handful of makhana / roasted chana / peanuts"],
  "avoid":["Tea with biscuits","Namkeens","Bakery"]},
 {"key":"dinner","label":"Dinner","title":"Light dinner",
  "items":["Veg soup","Moong dal soup","Boiled / sautéed veggies","Quinoa pulao (if very hungry)"],
  "avoid":["Heavy meals","Pizza","Pasta","Rice","Paratha"]},
 {"key":"bedtime","label":"Post Dinner / Bed time","title":"Lukewarm water",
  "items":["Lukewarm water"],"avoid":["Coffee"]}
]'::jsonb,
array['Maintain proper hydration','Do not skip meals','Maintain 12 hr fasting gap from dinner to breakfast','Daily walk and climb stairs','Practice NOD as shared — 2 times (morning and before bedtime)','Avoid refined products / breads / outside eating']
where not exists (select 1 from public.diet_plans where is_template and title like 'Alkaline diet%');
