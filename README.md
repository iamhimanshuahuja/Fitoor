

## Deploy to Netlify

1. Push this folder to your new Git repo (`.env`, logs and `node_modules` are git-ignored — check `git status` before the first commit).
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings come from `netlify.toml` (`npm ci && npm run build`, publish `dist`, Node 22).
3. Netlify → Site configuration → **Environment variables**, add only:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = the publishable/anon key
   Never add the AI key, service-role key, DB password or access token — AI keys live in Supabase secrets.
4. Deploy. Then in **Supabase → Authentication → URL Configuration**:
   - Site URL = `https://<your-site>.netlify.app` (or your custom domain)
   - Redirect URLs: add `https://<your-site>.netlify.app/**` (keep `http://localhost:5173/**` for local dev)
5. Open the site, sign in, and on a phone use **Add to Home Screen** to install it as an app.
