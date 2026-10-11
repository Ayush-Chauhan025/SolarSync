# SolarSync frontend

Responsive React + TypeScript starter for the SolarSync home-energy scheduler.

## Start locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in the Supabase project URL, Supabase anon key, and API base URL.
3. Run `npm install` and then `npm run dev`.

The Supabase anon key is intended for browser use. Never put a Supabase service-role key in a frontend environment variable.

## Project map

- `src/components/` — sidebar, app shell, chart, and section components.
- `src/pages/HomePage.tsx` — public landing page at `/`.
- `src/pages/AuthPage.tsx` — sign-in and sign-up form layouts at `/login` and `/signup`.
- `src/pages/DashboardPage.tsx` — signed-in workspace layout at `/app`.
- `src/pages/PlaceholderPage.tsx` — empty states for schedule, appliances, energy profile, and notifications.
- `src/data/dashboard.ts` — mock values used only for the visual dashboard.
- `src/lib/api.ts` — API base URL placeholder; add your typed FastAPI request helper here.
- `src/lib/supabase.ts` — Supabase browser client placeholder.
- `src/types.ts` — shared frontend types.

The landing page and auth forms are UI scaffolds. Connect the forms to Supabase Auth and protect `/app` before deployment. The dashboard clearly labels its sample forecast, home profile, and schedule. API calls, schedule creation, and notifications are left for you to implement.
