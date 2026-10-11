from datetime import date, datetime, time, timedelta, timezone
import logging
from math import isfinite

import httpx

from app.schemas import HomeEnergy, SolarForecastResponse, SolarSystem

AZIMUTH_CONVERSION = {
    "N": 180.0,
    "NE": -135.0,
    "E": -90.0,
    "SE": -45.0,
    "S": 0.0,
    "SW": 45.0,
    "W": 90.0,
    "NW": 135.0,
}

DEFAULT_SYSTEM_PERFORMANCE_RATIO = 0.8
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
logger = logging.getLogger(__name__)


class SolarForecastUnavailable(Exception):
    pass

def get_panel_azimuth(panel_direction: str) -> float:
    try:
        return AZIMUTH_CONVERSION[panel_direction]
    except KeyError as exc:
        raise ValueError(f"Unsupported panel direction: {panel_direction}") from exc
    

def estimate_ac_generation_kw(irradiance_w_m2: float, solar_system: SolarSystem) -> float:
    if not isfinite(irradiance_w_m2) or irradiance_w_m2 < 0:
        raise ValueError("irradiance_w_m2 must be a finite, non-negative value")

    performance_ratio = solar_system.system_performance_ratio
    if performance_ratio is None:
        performance_ratio = DEFAULT_SYSTEM_PERFORMANCE_RATIO

    estimated_dc_kw = solar_system.rated_capacity_kwp * irradiance_w_m2 / 1000
    estimated_ac_kw = estimated_dc_kw * performance_ratio
    return min(estimated_ac_kw, solar_system.max_inverter_output_kw)


async def fetch_solar_forecast(home: HomeEnergy, forecast_date: date) -> SolarForecastResponse:
    next_date = forecast_date + timedelta(days=1)
    params = {
        "latitude": home.location.latitude,
        "longitude": home.location.longitude,
        "hourly": "global_tilted_irradiance",
        "tilt": home.solar_system.panel_tilt_degrees,
        "azimuth": get_panel_azimuth(home.solar_system.panel_direction),
        "timezone": home.location.timezone,
        "start_date": forecast_date.isoformat(),
        "end_date": next_date.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
            payload = response.json()
        times = payload["hourly"]["time"]
        irradiance_values = payload["hourly"]["global_tilted_irradiance"]
        irradiance_by_time = {
            datetime.fromisoformat(timestamp): irradiance
            for timestamp, irradiance in zip(times, irradiance_values, strict=True)
        }
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Open-Meteo returned HTTP %s: %s",
            exc.response.status_code,
            exc.response.text[:500],
        )
        raise SolarForecastUnavailable("Could not fetch a valid solar forecast") from exc
    except httpx.HTTPError as exc:
        logger.warning("Open-Meteo request failed (%s)", type(exc).__name__)
        raise SolarForecastUnavailable("Could not fetch a valid solar forecast") from exc
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Open-Meteo returned invalid forecast data (%s): %s", type(exc).__name__, exc)
        raise SolarForecastUnavailable("Could not fetch a valid solar forecast") from exc

    day_start = datetime.combine(forecast_date, time.min)
    generation_kw = []
    for half_hour_index in range(48):
        hour_end = day_start + timedelta(hours=half_hour_index // 2 + 1)
        irradiance_w_m2 = irradiance_by_time.get(hour_end)
        if irradiance_w_m2 is None:
            raise SolarForecastUnavailable("Solar forecast is missing hourly irradiance data")
        try:
            generation_kw.append(estimate_ac_generation_kw(float(irradiance_w_m2), home.solar_system))
        except (TypeError, ValueError) as exc:
            raise SolarForecastUnavailable("Solar forecast contains invalid irradiance data") from exc

    return SolarForecastResponse(
        solar_generation_kw=generation_kw,
        estimated_total_generation_kwh=sum(generation_kw) * 0.5,
        provider="Open-Meteo",
        attribution="Weather forecast data by Open-Meteo (CC BY 4.0)",
        fetched_at=datetime.now(timezone.utc),
    )