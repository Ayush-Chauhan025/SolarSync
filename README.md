# SolarSync

## Live app

Try SolarSync at [solar-sync-phi.vercel.app](https://solar-sync-phi.vercel.app/).

SolarSync helps a household plan flexible appliance use around rooftop solar. Add a home energy profile and tasks, then preview a schedule that considers solar generation, baseline demand, task time windows, priorities, and the home's load limits.

It produces a suggested schedule; it does not control appliances. The scheduler uses OR-Tools CP-SAT. Solar estimates come from Open-Meteo's forecast API and the home's panel details.

## Stack

- Frontend: React, TypeScript, Vite, Supabase Auth
- API: FastAPI, SQLAlchemy, PostgreSQL on Supabase
- Scheduling: Google OR-Tools CP-SAT
- Solar forecast: Open-Meteo
- Local serverless workflow: AWS SAM CLI and Docker

## Run locally

You need Python 3.12, Node.js, and a Supabase project with PostgreSQL enabled.

### Backend

In PowerShell:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Add your Supabase URL, publishable/anon key, PostgreSQL session-pooler connection settings, and frontend origins to `backend/.env`. Keep real credentials out of Git. Apply the database migrations and start the API:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

The API and interactive docs are available at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

### Frontend

Open another PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Set the API URL and Supabase project URL and publishable/anon key in `frontend/.env`, then run:

```powershell
npm run dev
```

Vite prints the local frontend URL, usually `http://localhost:5173`.

## AWS SAM (local)

The backend includes a SAM template and Lambda adapter. To build and run the API in SAM's local Lambda environment, install AWS SAM CLI and Docker Desktop, then follow [backend/SAM_LOCAL.md](backend/SAM_LOCAL.md). This local workflow does not deploy AWS resources.

## Public demo deployment

See [DEPLOY.md](DEPLOY.md) for the free Render API and Vercel frontend setup.

## Project layout

```text
backend/
  app/api/routes/     FastAPI endpoints
  app/services/       Solar forecast and scheduling logic
  migrations/         Alembic database migrations
  lambda_handler.py   Lambda adapter for SAM
  template.yaml       SAM function and API routes
frontend/
  src/pages/          App screens
  src/components/     Shared UI components
  src/lib/            API, Supabase, and time helpers
```

## Current scope

SolarSync creates and saves daily schedules, stores reusable task presets, and reports the energy summary returned by the scheduler. Forecast availability depends on Open-Meteo; authentication and saved data depend on the configured Supabase project.

## License

Private project — source code is not licensed for public use.
