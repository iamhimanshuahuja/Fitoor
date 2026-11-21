/**
 * Success toast with a motivating line. Call cheer('meal') etc. after a successful save; <CheerToast/> (App root) shows it.
 * Lines celebrate effort and consistency — never body size or weight numbers.
 */
export const CHEERS = {
  meal: ['🍛', 'Meal logged', ['Consistency beats perfection.', 'Every plate you track is a vote for the new you.', 'Awareness is the first rep.', 'Small steps, big glow-up.']],
  on_plan: ['🎯', 'On plan!', ['That’s the junoon 🔥', 'Plate on point. Stack another one.', 'One more win in the bank.']],
  weight: ['⚖️', 'Weigh-in saved', ['Watch the trend, not the day.', 'Progress is a line, not a dot.', 'Showing up is the hard part, and you did it.']],
  workout: ['💪', 'Workout saved', ['That’s how PRs are built.', 'Reps in the bank.', 'Future you is cheering.', 'Sweat today, strength tomorrow.']],
  lab: ['🧪', 'Report saved', ['Knowing your numbers is power.', 'Now you can track what really changes.']],
  period: ['🌸', 'Saved', ['Listening to your body is strength.', 'Be gentle with yourself today.']],
  juice_done: ['🧃', 'All juices done!', ['Total junoon. Proud of you.', 'Juice day complete. Rest up.']],
  chat: ['✨', 'Saved from chat', ['Logging made easy. Keep it flowing.', 'Done in seconds. That’s the vibe.']],
  photo: ['📸', 'Photo saved', ['Day 1 you will love seeing this later.', 'Proof of progress, locked in.']],
  profile: ['✅', 'Profile updated', ['You’re all set.', 'Fresh goals, fresh energy.']],
  habits_all: ['✅', 'All habits done!', ['Perfect day energy.', 'Habits stacked. That’s discipline.']],
  water: ['💧', 'Water goal hit', ['Hydrated and glowing.', 'Your body says thank you.']],
  update: ['✅', 'Updated', ['All set. Keep going.', 'Nice. Every detail helps your coach help you.']],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function cheerText(kind) {
  const [emoji, title, lines] = CHEERS[kind] || CHEERS.update;
  return { emoji, title, line: pick(lines) };
}

export function cheer(kind = 'update') {
  window.dispatchEvent(new CustomEvent('ft:cheer', { detail: { kind } }));
}
