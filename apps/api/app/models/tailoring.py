import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, JSON, DateTime, ForeignKey, Enum as SAEnum, ARRAY, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class SessionStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class RecommendationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    IGNORED = "IGNORED"


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(String(500))
    company: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    analysis: Mapped[dict | None] = mapped_column(JSON)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tailoring_sessions: Mapped[list["TailoringSession"]] = relationship("TailoringSession", back_populates="job_description")
    applications: Mapped[list["JobApplication"]] = relationship("JobApplication", back_populates="job_description")


class TailoringSession(Base):
    __tablename__ = "tailoring_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[str] = mapped_column(String, ForeignKey("resumes.id"), index=True)
    job_desc_id: Mapped[str] = mapped_column(String, ForeignKey("job_descriptions.id"))
    match_score: Mapped[int | None] = mapped_column(Integer)
    passes_completed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[SessionStatus] = mapped_column(SAEnum(SessionStatus), default=SessionStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    resume: Mapped["Resume"] = relationship("Resume", back_populates="tailoring_sessions")
    job_description: Mapped["JobDescription"] = relationship("JobDescription", back_populates="tailoring_sessions")
    recommendations: Mapped[list["Recommendation"]] = relationship("Recommendation", back_populates="session", cascade="all, delete-orphan")
    ats_score: Mapped["AtsScore"] = relationship("AtsScore", back_populates="session", uselist=False, cascade="all, delete-orphan")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("tailoring_sessions.id", ondelete="CASCADE"), index=True)
    section: Mapped[str] = mapped_column(String(100), nullable=False)
    field: Mapped[str | None] = mapped_column(String(255))
    original: Mapped[str] = mapped_column(Text, nullable=False)
    suggested: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    status: Mapped[RecommendationStatus] = mapped_column(SAEnum(RecommendationStatus), default=RecommendationStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["TailoringSession"] = relationship("TailoringSession", back_populates="recommendations")


class AtsScore(Base):
    __tablename__ = "ats_scores"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("tailoring_sessions.id", ondelete="CASCADE"), unique=True)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    keyword_score: Mapped[int] = mapped_column(Integer, default=0)
    skills_score: Mapped[int] = mapped_column(Integer, default=0)
    experience_score: Mapped[int] = mapped_column(Integer, default=0)
    education_score: Mapped[int] = mapped_column(Integer, default=0)
    format_score: Mapped[int] = mapped_column(Integer, default=0)
    matched_keywords: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    missing_keywords: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    section_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    tips: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["TailoringSession"] = relationship("TailoringSession", back_populates="ats_score")
