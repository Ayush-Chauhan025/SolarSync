# Deploy SolarSync

SolarSync can run as a Vercel frontend, a Render API, and a Supabase auth/database project. The steps below publish the app without deploying AWS resources.

## Prepare the repository

Push the project to GitHub with `render.yaml`, `backend/.python-version`, and `frontend/vercel.json` included. Keep real `.env` files and `backend/sam-env.json` out of Git.

## Create the API service

In Render, choose **New → Blueprint**, connect this repository, and create the `solarsync-api` service defined in the root `render.yaml`.

In the service's **Environment** settings, enter the values from `backend/.env`:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase publishable/anon key |
| `user` | Username shown for the Supabase Session Pooler |
| `password` | Supabase database password |
| `host` | Session Pooler host |
| `port` | Session Pooler port |
| `dbname` | Database name, usually `postgres` |
| `CORS_ALLOWED_ORIGINS` | Vercel site origin; set after deploying the frontend |

Use the **Session Pooler** connection details from Supabase's database settings. Do not use a service-role key for `SUPABASE_KEY`.

After Render finishes deploying, open `https://YOUR-API.onrender.com/docs` and `https://YOUR-API.onrender.com/health/db` to check the API and database connection.

## Publish the frontend

In Vercel, import the same GitHub repository and set **Root Directory** to `frontend`. Use `npm run build` as the build command and `dist` as the output directory.

Add these environment variables in the Vercel project settings before deploying:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Render API origin, such as `https://solarsync-api.onrender.com` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

Once Vercel gives you the site URL, set that origin as Render's `CORS_ALLOWED_ORIGINS`. In Supabase **Authentication → URL Configuration**, set the **Site URL** to the Vercel origin and add it to **Redirect URLs**. Save the Render change and redeploy if needed.

## Free service notes

Render's free web service goes idle after 15 minutes without requests. The first request after that may take about a minute while it starts again. Its local files are temporary, so persistent app data must stay in Supabase.
