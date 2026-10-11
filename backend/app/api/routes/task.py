from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.schemas import TaskPreset as TaskPresetResponse
from app.schemas import TaskPresetInput
from models import Home, TaskPreset as TaskPresetModel

router = APIRouter()

@router.post("/homes/{home_id}/task-presets", response_model=TaskPresetResponse, status_code=status.HTTP_201_CREATED)
def create_task_preset( home_id: UUID, body: TaskPresetInput, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar( select(Home).where(Home.id == home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    preset = TaskPresetModel( home_id=home_id, name=body.name, task_data=body.model_dump(mode="json"))
    db.add(preset)

    try:
        db.commit()
        db.refresh(preset)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException( status_code=status.HTTP_409_CONFLICT, detail="A task preset with this name already exists for this home") from exc
    except SQLAlchemyError:
        db.rollback()
        raise

    return TaskPresetResponse(preset_id=preset.id, **preset.task_data)

@router.get( "/homes/{home_id}/task-presets", response_model=list[TaskPresetResponse])
def get_task_presets( home_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar( select(Home).where(Home.id == home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    presets = db.scalars( select(TaskPresetModel).where(TaskPresetModel.home_id == home_id)).all()

    return [TaskPresetResponse(preset_id=preset.id, **preset.task_data) for preset in presets]


@router.put( "/homes/{home_id}/task-presets/{preset_id}", response_model=TaskPresetResponse)
def update_task_preset( home_id: UUID, preset_id: UUID, body: TaskPresetInput, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar( select(Home).where(Home.id == home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    preset = db.scalar( select(TaskPresetModel).where( TaskPresetModel.id == preset_id, TaskPresetModel.home_id == home_id))
    if preset is None:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail="Task preset not found")

    preset.name = body.name
    preset.task_data = body.model_dump(mode="json")

    try:
        db.commit()
        db.refresh(preset)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException( status_code=status.HTTP_409_CONFLICT, detail="A task preset with this name already exists for this home") from exc
    except SQLAlchemyError:
        db.rollback()
        raise

    return TaskPresetResponse(preset_id=preset.id, **preset.task_data)


@router.delete("/homes/{home_id}/task-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_preset(home_id: UUID, preset_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    home = db.scalar(select(Home).where(Home.id == home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    preset = db.scalar(select(TaskPresetModel).where(TaskPresetModel.id == preset_id, TaskPresetModel.home_id == home_id))
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task preset not found")

    try:
        db.delete(preset)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
