import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Plan(str, enum.Enum):
    FREE = "FREE"
    PRO = "PRO"
    PRO_ANNUAL = "PRO_ANNUAL"
    TEAM = "TEAM"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    plan: Mapped[Plan] = mapped_column(SAEnum(Plan), default=Plan.FREE)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    profile: Mapped["Profile"] = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    resumes: Mapped[list["Resume"]] = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    job_applications: Mapped[list["JobApplication"]] = relationship("JobApplication", back_populates="user", cascade="all, delete-orphan")
    saved_jobs: Mapped[list["SavedJob"]] = relationship("SavedJob", back_populates="user", cascade="all, delete-orphan")
    subscription: Mapped["Subscription"] = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    usage_limit: Mapped["UsageLimit"] = relationship("UsageLimit", back_populates="user", uselist=False, cascade="all, delete-orphan")
    exports: Mapped[list["Export"]] = relationship("Export", back_populates="user", cascade="all, delete-orphan")
