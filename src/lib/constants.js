// Meal slots follow the diet chart columns
export const SLOTS = [
  { key: 'early_morning', emoji: '🌅', label: 'Early Morning', short: 'Wake up', time: '06:30' },
  { key: 'before_breakfast', emoji: '🥤', label: 'Before Breakfast', short: 'Smoothie', time: '07:30' },
  { key: 'breakfast', emoji: '🥞', label: 'Breakfast', short: 'Breakfast', time: '09:00' },
  { key: 'lunch', emoji: '🍛', label: 'Lunch', short: 'Lunch', time: '13:30' },
  { key: 'evening', emoji: '☕', label: 'Evening', short: 'Snacks', time: '17:00' },
  { key: 'dinner', emoji: '🥣', label: 'Dinner', short: 'Dinner', time: '20:00' },
  { key: 'bedtime', emoji: '🌙', label: 'Bed time', short: 'Bed time', time: '22:30' },
  { key: 'other', emoji: '✨', label: 'Other / extra', short: 'Extra', time: '' },
];
export const slotLabel = (k) => SLOTS.find((s) => s.key === k)?.label || k;

// Feature flags (keep in sync with supabase/schema.sql)
export const FEATURES = [
  { key: 'diet', label: 'Diet plan', hint: 'See the assigned diet chart' },
  { key: 'meals', label: 'Meal logging', hint: 'Log each meal by slot' },
  { key: 'meal_photos', label: 'Meal photos', hint: 'Upload meal photos from camera' },
  { key: 'weight', label: 'Weight tracking', hint: 'Daily weight + waist' },
  { key: 'habits', label: 'Daily habits', hint: 'Checklist from the diet chart' },
  { key: 'gym', label: 'Gym / workouts', hint: 'Exercises, sets, machines' },
  { key: 'supplements', label: 'Supplements', hint: 'Whey, pre-workout, etc.' },
  { key: 'labs', label: 'Lab reports', hint: 'Upload & compare blood tests' },
  { key: 'ai', label: 'AI features', hint: 'Scale reading, calorie & machine detection, lab import' },
];

export const HABITS = [
  { key: 'detox_water', label: 'Detox water (methi, saunf, jeera)' },
  { key: 'green_smoothie', label: 'Green smoothie' },
  { key: 'green_chutney', label: 'Green chutney with breakfast' },
  { key: 'nuts', label: '10 almonds + 3 walnuts' },
  { key: 'seeds', label: 'Mixed seeds 1-2 tsp' },
  { key: 'walk', label: 'Walk / climbed stairs' },
  { key: 'nod', label: 'NOD practice ×2' },
  { key: 'fasting12', label: '12 hr gap dinner → breakfast' },
];

export const SUPPLEMENTS = [
  { key: 'whey', label: 'Whey protein' },
  { key: 'pre_workout', label: 'Pre-workout' },
  { key: 'l_carnitine', label: 'L-carnitine' },
  { key: 'multivitamin', label: 'Multivitamin' },
];

export const MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'cardio'];
export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'cardio_machine', 'other'];
export const DAY_LABELS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Cardio', 'Rest / walk'];

export const pretty = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
