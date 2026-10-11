# Run the API locally with SAM

## Requirements

- AWS SAM CLI
- Docker Desktop running
- The Supabase and PostgreSQL settings used by the backend

## Prepare local settings

Put the Supabase and PostgreSQL settings in `backend/.env`. Keep real credentials out of Git; `.env` is ignored. The variable names are declared in `template.yaml`, and SAM overrides those empty local defaults with values from `.env`.

## Build and run

From the `backend` directory:

```powershell
sam validate --template-file template.yaml
sam build --use-container --template-file template.yaml
sam local start-api --env-vars .env
```

SAM starts the API at `http://127.0.0.1:3000`. Open `http://127.0.0.1:3000/docs` to inspect the routes. You can also call `http://127.0.0.1:3000/health/db`; it should return `{"status":"ok"}` when the database connection works. Set the frontend's `VITE_API_BASE_URL` to `http://127.0.0.1:3000` to use this API from the local frontend.

`sam local start-api` runs the Lambda handler in a Docker container and exposes it through a local HTTP server. These commands do not create Lambda or API Gateway resources in your AWS account. Avoid `sam deploy` for local-only use.
