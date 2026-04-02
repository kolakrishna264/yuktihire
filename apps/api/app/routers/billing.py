from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, Plan
from app.models.billing import UsageLimit, Subscription, BillingEvent
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = sub_result.scalar_one_or_none()

    return {
        "plan": current_user.plan,
        "isPro": current_user.plan != Plan.FREE,
        "status": sub.status if sub else "ACTIVE",
        "cancelAtPeriodEnd": sub.cancel_at_period_end if sub else False,
        "currentPeriodEnd": sub.current_period_end if sub else None,
    }


@router.post("/checkout")
async def create_checkout_session(
    current_user: User = Depends(get_current_user),
):
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured yet. Please contact support."
        )

    import stripe
    stripe.api_key = settings.stripe_secret_key

    price_id = settings.stripe_pro_monthly_price_id
    if not price_id:
        raise HTTPException(503, "Stripe price ID not configured")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/dashboard/settings/billing?success=1",
        cancel_url=f"{settings.frontend_url}/dashboard/settings/billing",
        client_reference_id=str(current_user.id),
        customer_email=current_user.email,
        metadata={"user_id": str(current_user.id)},
    )
    return {"url": session.url}


@router.post("/portal")
async def create_customer_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Billing is not configured yet.")

    import stripe
    stripe.api_key = settings.stripe_secret_key

    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = sub_result.scalar_one_or_none()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(400, "No active subscription found")

    portal = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.frontend_url}/dashboard/settings/billing",
    )
    return {"url": portal.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(503, "Billing not configured")

    import stripe
    stripe.api_key = settings.stripe_secret_key

    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(body, sig, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid webhook signature")

    # Record the event
    existing = await db.execute(
        select(BillingEvent).where(BillingEvent.stripe_event_id == event["id"])
    )
    if existing.scalar_one_or_none():
        return {"received": True}  # already processed

    billing_event = BillingEvent(
        stripe_event_id=event["id"],
        event_type=event["type"],
        payload=dict(event),
    )
    db.add(billing_event)

    # Handle subscription events
    if event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
        sub_data = event["data"]["object"]
        user_id = sub_data.get("metadata", {}).get("user_id")

        if user_id:
            billing_event.user_id = user_id

            sub_result = await db.execute(
                select(Subscription).where(Subscription.user_id == user_id)
            )
            sub = sub_result.scalar_one_or_none()
            if sub:
                sub.stripe_customer_id = sub_data.get("customer")
                sub.stripe_subscription_id = sub_data.get("id")
                sub.status = sub_data.get("status", "ACTIVE").upper()
                sub.cancel_at_period_end = sub_data.get("cancel_at_period_end", False)

                from datetime import datetime
                if sub_data.get("current_period_start"):
                    sub.current_period_start = datetime.fromtimestamp(sub_data["current_period_start"])
                if sub_data.get("current_period_end"):
                    sub.current_period_end = datetime.fromtimestamp(sub_data["current_period_end"])

                # Upgrade user plan
                user_result = await db.execute(select(User).where(User.id == user_id))
                user = user_result.scalar_one_or_none()
                if user and sub_data.get("status") == "active":
                    user.plan = Plan.PRO

                # Upgrade usage limits
                usage_result = await db.execute(
                    select(UsageLimit).where(UsageLimit.user_id == user_id)
                )
                usage = usage_result.scalar_one_or_none()
                if usage and sub_data.get("status") == "active":
                    usage.tailoring_max = 999
                    usage.ats_scans_max = 999
                    usage.exports_max = 999
                    usage.resumes_max = 10

    elif event["type"] == "customer.subscription.deleted":
        sub_data = event["data"]["object"]
        user_id = sub_data.get("metadata", {}).get("user_id")

        if user_id:
            billing_event.user_id = user_id
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.plan = Plan.FREE

            usage_result = await db.execute(
                select(UsageLimit).where(UsageLimit.user_id == user_id)
            )
            usage = usage_result.scalar_one_or_none()
            if usage:
                usage.tailoring_max = 3
                usage.ats_scans_max = 5
                usage.exports_max = 2
                usage.resumes_max = 1

    await db.commit()
    return {"received": True}
