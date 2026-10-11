from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.schemas import HomeEnergy, SolarForecastResponse
from app.services.solar_forecast import SolarForecastUnavailable, fetch_solar_forecast
from models import Home

router = APIRouter()


@router.get("/homes/{home_id}/solar-forecast", response_model=SolarForecastResponse)
async def get_home_solar_forecast(home_id: UUID, forecast_date: date | None = None, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar(select(Home).where(Home.id == home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    settings = HomeEnergy.model_validate(home.settings)
    if forecast_date is None:
        forecast_date = datetime.now(ZoneInfo(settings.location.timezone)).date()

    try:
        return await fetch_solar_forecast(settings, forecast_date)
    except SolarForecastUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
