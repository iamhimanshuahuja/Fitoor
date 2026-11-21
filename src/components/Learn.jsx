import { Card } from './ui';

// Short cards based on the coach's program slides. General guidance only.
const CARDS = [
  {
    emoji: '🍽️', title: 'The 50 / 25 / 25 plate', tone: 'lime',
    body: 'Fill half your plate with vegetables and salad, a quarter with protein (dal, paneer, chana, rajma, tofu), and a quarter with whole grains (roti, millets, brown rice). Fibre and protein first keep you full and your energy steady.',
  },
  {
    emoji: '🌱', title: 'Eat more alkaline foods', tone: 'lav',
    list: ['Sprouts', 'Salads', 'Herbal / green smoothies'],
    body: 'Full of minerals, vitamins and fibre. Aim to have at least one of these at every main meal.',
  },
  {
    emoji: '🔥', title: 'Cut down acidic & inflammatory foods', tone: 'chilli',
    list: ['Milk and milk products', 'Tea and coffee', 'Sugar, jaggery, honey', 'Alcohol', 'Animal products'],
  },
  {
    emoji: '🍞', title: 'Swap high-GI breakfasts', tone: 'haldi',
    body: 'A typical Indian breakfast can be ~80% carbs and only 20% protein. These spike sugar fast and are low in fibre:',
    list: ['Poha, rava upma', 'Idli, white-rice dosa, white rice', 'Bread, cornflakes / wheat flakes', 'Paratha'],
    after: 'Try besan chilla, moong dal idli, sprouts chaat or overnight oats instead.',
  },
  {
    emoji: '📈', title: 'What raises insulin (more fat storage)', tone: 'chilli',
    list: ['High carbohydrates', 'High calories', 'Frequent meals and snacking', 'Sitting all day', 'Empty calories (sugar, refined snacks)'],
  },
  {
    emoji: '📉', title: 'What lowers insulin (more fat burning)', tone: 'lime',
    list: ['Fewer refined carbs', 'Sensible portions', 'A 12-hour gap from dinner to breakfast', 'Exercise and daily walks', 'Nutrient-dense foods that fill you up with less'],
  },
  {
    emoji: '🧩', title: 'Diet habits linked to insulin resistance', tone: 'sky',
    list: ['An acidic, inflammatory diet', 'Refined fats', 'Too many grains and refined carbs', 'Too few micronutrients'],
  },
];

export default function Learn() {
  return (
    <>
      <div className="learn-grid">
        {CARDS.map((c) => (
          <Card key={c.title} className={`learn-card tone-${c.tone}`}>
            <div className="learn-emoji" aria-hidden>{c.emoji}</div>
            <h3>{c.title}</h3>
            {c.body && <p>{c.body}</p>}
            {c.list && <ul>{c.list.map((x) => <li key={x}>{x}</li>)}</ul>}
            {c.after && <p className="learn-after">{c.after}</p>}
          </Card>
        ))}
      </div>
      <p className="small muted">From your coach's program. General guidance, not medical advice; follow your coach and doctor for your own plan.</p>
    </>
  );
}
