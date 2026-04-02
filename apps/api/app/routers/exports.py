from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, Plan
from app.models.resume import Resume
from app.models.billing import Export, ExportFormat, UsageLimit

router = APIRouter(prefix="/exports", tags=["exports"])


class ExportRequest(BaseModel):
    resume_id: str
    format: ExportFormat
    template_id: Optional[str] = "standard"
    filename: Optional[str] = None


@router.post("")
async def create_export(
    data: ExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check DOCX gated to Pro
    if data.format == ExportFormat.DOCX and current_user.plan == Plan.FREE:
        raise HTTPException(
            status_code=403,
            detail={"message": "DOCX export requires Pro plan", "upgradeRequired": True}
        )

    # Check export limit
    limit_result = await db.execute(select(UsageLimit).where(UsageLimit.user_id == current_user.id))
    limits = limit_result.scalar_one_or_none()
    is_pro = current_user.plan in [Plan.PRO, Plan.PRO_ANNUAL, Plan.TEAM]

    if limits and not is_pro and limits.exports_used >= limits.exports_max:
        raise HTTPException(
            status_code=403,
            detail={"message": "Monthly export limit reached", "upgradeRequired": True}
        )

    # Validate resume
    res_result = await db.execute(
        select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id)
    )
    resume = res_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    filename = data.filename or f"{resume.name.replace(' ', '_')}.{data.format.value.lower()}"

    export = Export(
        user_id=current_user.id,
        resume_id=data.resume_id,
        format=data.format,
        filename=filename,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(export)

    if limits:
        limits.exports_used += 1

    await db.flush()

    # Generate synchronously for now (move to background in V2)
    if data.format == ExportFormat.PDF:
        from app.services.export.pdf_gen import generate_pdf
        file_bytes = await generate_pdf(resume.content, data.template_id or "standard")
        export.file_url = f"export:{export.id}"  # placeholder
        await db.flush()
        return StreamingResponse(
            iter([file_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    elif data.format == ExportFormat.DOCX:
        from app.services.export.docx_gen import generate_docx
        file_bytes = await generate_docx(resume.content)
        export.file_url = f"export:{export.id}"
        await db.flush()
        return StreamingResponse(
            iter([file_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    raise HTTPException(400, f"Unsupported format: {data.format}")


@router.get("")
async def list_exports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Export)
        .where(Export.user_id == current_user.id)
        .order_by(Export.created_at.desc())
        .limit(20)
    )
    exports = result.scalars().all()
    return {"exports": [
        {"id": e.id, "resumeId": e.resume_id, "format": e.format,
         "filename": e.filename, "createdAt": e.created_at}
        for e in exports
    ]}
