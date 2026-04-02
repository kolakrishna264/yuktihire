import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, JSON, Boolean, DateTime, ForeignKey, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ResumeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    template_id: Mapped[str] = mapped_column(String(100), default="standard")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ResumeStatus] = mapped_column(SAEnum(ResumeStatus), default=ResumeStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="resumes")
    versions: Mapped[list["ResumeVersion"]] = relationship("ResumeVersion", back_populates="resume", cascade="all, delete-orphan")
    tailoring_sessions: Mapped[list["TailoringSession"]] = relationship("TailoringSession", back_populates="resume")
    exports: Mapped[list["Export"]] = relationship("Export", back_populates="resume")


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id: Mapped[str] = mapped_column(String, ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    label: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    session_id: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    resume: Mapped["Resume"] = relationship("Resume", back_populates="versions")
