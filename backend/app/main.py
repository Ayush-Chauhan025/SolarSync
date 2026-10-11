import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.routes.auth import router as auth_routes
from app.api.routes.forecast import router as forecast_routes
from app.api.routes.home import router as home_routes
from app.api.routes.schedule import router as schedule_routes
from app.api.routes.task import router as task_routes

from app.database import get_db

app = FastAPI()

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_routes)
app.include_router(forecast_routes)
app.include_router(home_routes)
app.include_router(schedule_routes)
app.include_router(task_routes)

@app.get("/health/db")
def health(db: Session = Depends(get_db)):
    
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
