// AUTO-COPIED from src/lib/juices.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".
// Juice feast program (from the coach's slides). Amounts depend on the eGFR group the coach assigns.
export const JUICE_GROUPS = {
  '90': { label: 'eGFR above 90', total: '3 litres of juices + smoothie' },
  '60': { label: 'eGFR 60–90', total: '1.5 litres of juices + smoothie' },
  '30': { label: 'eGFR 30–60', total: '750 ml of juices + smoothie' },
};

// amounts in ml per group, in schedule order
export const JUICES = [
  {
    key: 'red', name: 'Red juice', emoji: '🔴', time: '8:00 am', window: '8–9 am', ml: { 90: 500, 60: 250, 30: 150 },
    ingredients: ['800 g tomato (tamatar)', '250 g carrots (gajar)', '1 red capsicum (laal simla mirch)', '1 yellow capsicum (peeli simla mirch)', '1 piece ginger (adrak / ala)', 'Salt and pepper to taste (namak, kali mirch)'],
  },
  {
    key: 'smoothie_am', name: 'Green smoothie', emoji: '🥤', time: '9:30 am', window: '9:30 am', ml: { 90: 500, 60: 250, 30: 125 },
    ingredients: ['Major greens: cucumber / bottle gourd / ash gourd, 1 cup', 'Minor greens: coriander / mint / curry / paan / tulsi, 5–10 leaves', '½ apple / guava / peach / pear', 'Pinch of cinnamon and black salt', 'Blend to chutney consistency, add 1 cup water and lemon'],
  },
  {
    key: 'green1', name: 'Green juice 1', emoji: '🟢', time: '11:00 am', window: '11 am–12 pm', ml: { 90: 500, 60: 250, 30: 150 },
    ingredients: ['500 g ash gourd (kohala / petha)', '½ apple (seb / safarchand)', '4 big green capsicums (badi hari simla mirch)', '1 ridge gourd (tori / dodka)', '½ lemon juice (nimbu ka ras)', '1 piece ginger (adrak / ala)', 'Salt and pepper to taste'],
  },
  {
    key: 'green2', name: 'Green juice 2', emoji: '🟢', time: '1:30 pm', window: '1:30–2:30 pm', ml: { 90: 500, 60: 250, 30: 150 },
    alt: 'tangy',
    ingredients: ['700 g bottle gourd (lauki / dudhi)', '2 cups leafy greens: chakvat / bathua / cholai or any edible green', '1 cup coriander (hara dhania / kothimbir)', 'Lemon juice (nimbu ka ras)', '1 piece ginger (adrak / ala)', 'Salt and pepper to taste'],
  },
  {
    key: 'smoothie_pm', name: 'Green smoothie', emoji: '🥤', time: '4:30 pm', window: '4:30 pm', ml: { 90: 500, 60: 250, 30: 125 },
    ingredients: ['Same as the morning smoothie'],
  },
  {
    key: 'white', name: 'White juice', emoji: '⚪', time: '7:00 pm', window: '7–8 pm', ml: { 90: 500, 60: 250, 30: 150 },
    ingredients: ['500 g bottle gourd (dudhi / lauki)', '500 g cucumber (khira / kakdi)', 'Lemon juice (nimbu ka ras)', '1 piece ginger (adrak / ala)', 'Salt and pepper to taste'],
  },
];

export const TANGY = {
  key: 'tangy', name: 'Tangy juice', emoji: '🍋', window: '3:30–4:30 pm (instead of Green juice 2)',
  ingredients: ['600 g bottle gourd (lauki / dudhi)', '100 g cabbage (patta gobhi / paan kobi)', '4 cucumbers (khira / kakdi)', 'Lemon juice (nimbu ka ras)', '1 piece ginger (adrak / ala)', 'Salt and pepper to taste'],
};

export const PREP_RULES = [
  'Use vegetables with their peel or edible stem.',
  'Wash thoroughly in turmeric + salt water, then rinse well.',
  'Chop finely and blend.',
  'Strain through a fine muslin cloth or strainer.',
];

/** Suggest a group from an eGFR value (coach confirms). */
export const suggestGroup = (egfr) => (egfr == null ? null : egfr > 90 ? '90' : egfr >= 60 ? '60' : egfr >= 30 ? '30' : null);
