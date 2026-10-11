# Run the API locally with SAM

## Requirements

- AWS SAM CLI
- Docker Desktop running
- The Supabase and PostgreSQL settings used by the backend

## Prepare local settings

Open PowerShell in `backend`, copy the environment template, and add your development settings:

```powershell
Copy-Item sam-env.example.json sam-env.json
```

Keep your real credentials in `sam-env.json`. Git ignores this file.

## Build and run

From the `backend` directory:

```powershell
sam validate --template-file template.yaml
sam build --use-container --template-file template.yaml
sam local start-api --env-vars sam-env.json
```

SAM starts the API at `http://127.0.0.1:3000`. Open `http://127.0.0.1:3000/docs` to inspect the routes. You can also call `http://127.0.0.1:3000/health/db`; it should return `{"status":"ok"}` when the database connection works. Set the frontend's `VITE_API_BASE_URL` to `http://127.0.0.1:3000` to use this API from the local frontend.

`sam local start-api` runs the Lambda handler in a Docker container and exposes it through a local HTTP server. These commands do not create Lambda or API Gateway resources in your AWS account. Avoid `sam deploy` for local-only use.
