from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.schemas import HomeEnergy, HomeListResponse, HomeProfileResponse
from models import Home

router = APIRouter()


@router.get("/homes", response_model=HomeListResponse)
def list_homes(db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    homes = db.scalars(select(Home).where(Home.user_id == user_id).order_by(Home.created_at.asc())).all()
    return {"homes": [{"home_id": home.id, "settings": home.settings} for home in homes]}


@router.post("/homes", response_model=HomeProfileResponse)
def create_home_energy_profile( body: HomeEnergy, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = Home(user_id=user_id, settings=body.model_dump(mode="json"))

    try:
        db.add(home)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return {
        "status": "ok",
        "body": {
            "home_id": home.id,
            "settings": home.settings
        },
    }


@router.get("/homes/{home_id}", response_model=HomeProfileResponse)
def get_home_energy_profile( home_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar(select(Home).where( Home.id == home_id, Home.user_id == user_id))

    if home is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    return {
        "status": "ok",
        "body": {
            "home_id": home.id,
            "settings": home.settings
        }
    }


@router.put("/homes/{home_id}", response_model=HomeProfileResponse)
def update_home_energy_profile( home_id: UUID, body: HomeEnergy, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar( select(Home).where( Home.id == home_id, Home.user_id == user_id))

    if home is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    home.settings = body.model_dump(mode="json")

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return {
        "status": "ok",
        "body": {
            "home_id": home.id,
            "settings": home.settings,
        },
    }
