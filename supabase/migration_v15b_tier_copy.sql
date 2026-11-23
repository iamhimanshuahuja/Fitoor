-- v15b: drop the seeded home-page lines that only repeated the chat count (the card already shows it).
-- Lines the super admin has since edited are kept.
update public.ai_tiers set blurb = null
where blurb in ('Everything in Fitoor. 3 AI chat logs a day.', 'Everything in Fitoor. 19 AI chat logs a day.', 'Everything in Fitoor. 50 AI chats a day + Ask AI anywhere.');
select 'v15b ok' as status;
