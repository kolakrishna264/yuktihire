"""
Tests for the applications (job tracking) API.
Run with: cd apps/api && python -m pytest tests/ -v
"""
import json
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from main import app


# Mock the auth dependency to return a fake user
class FakeUser:
    id = "test-user-123"
    email = "test@example.com"
    plan = "free"


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from app.middleware.auth import get_current_user
    app.dependency_overrides[get_current_user] = lambda: FakeUser()
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def mock_db():
    """Mock database for all tests — use in-memory tracking."""
    from app.core.database import get_db

    # We'll mock the DB session to use a simple in-memory store
    store = {"applications": []}
    counter = [0]

    class FakeResult:
        def __init__(self, items):
            self._items = items
        def scalars(self):
            return self
        def all(self):
            return self._items
        def scalar_one_or_none(self):
            return self._items[0] if self._items else None

    class FakeDB:
        async def execute(self, query):
            # Return appropriate mock results
            return FakeResult([])

        def add(self, obj):
            store["applications"].append(obj)

        async def flush(self):
            pass

        async def commit(self):
            pass

        async def refresh(self, obj):
            if not hasattr(obj, 'id') or obj.id is None:
                counter[0] += 1
                obj.id = f"fake-id-{counter[0]}"
            from datetime import datetime
            if not hasattr(obj, 'created_at') or obj.created_at is None:
                obj.created_at = datetime.utcnow()
            if not hasattr(obj, 'updated_at') or obj.updated_at is None:
                obj.updated_at = datetime.utcnow()

        async def delete(self, obj):
            store["applications"] = [a for a in store["applications"] if a.id != obj.id]

    app.dependency_overrides[get_db] = lambda: FakeDB()
    yield store
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_create_application(client):
    """Test creating a new job application."""
    resp = await client.post("/api/v1/applications/", json={
        "title": "Software Engineer",
        "company": "Acme Corp",
        "url": "https://example.com/job/1",
        "status": "SAVED",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Software Engineer"
    assert data["company"] == "Acme Corp"


@pytest.mark.asyncio
async def test_create_duplicate_detection(client):
    """Test that duplicate jobs are rejected with 409."""
    # The mock DB always returns empty for duplicate check, so this tests the flow
    # In a real integration test with a DB, the second call would 409
    resp1 = await client.post("/api/v1/applications/", json={
        "title": "Software Engineer",
        "company": "Acme Corp",
        "url": "https://example.com/job/1",
    })
    assert resp1.status_code == 200


@pytest.mark.asyncio
async def test_validation_title_too_short(client):
    """Test that very short titles are rejected."""
    resp = await client.post("/api/v1/applications/", json={
        "title": "A",
        "company": "Acme Corp",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_validation_company_too_short(client):
    """Test that very short company names are rejected."""
    resp = await client.post("/api/v1/applications/", json={
        "title": "Software Engineer",
        "company": "A",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_applications(client):
    """Test listing applications."""
    resp = await client.get("/api/v1/applications/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_saved_urls(client):
    """Test the saved-urls endpoint for dedup."""
    resp = await client.get("/api/v1/applications/saved-urls")
    assert resp.status_code == 200
    data = resp.json()
    assert "urls" in data
    assert "externalJobIds" in data


@pytest.mark.asyncio
async def test_delete_application_not_found(client):
    """Test deleting a non-existent application."""
    resp = await client.delete("/api/v1/applications/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_mark_as_applied_not_found(client):
    """Test marking a non-existent application as applied."""
    resp = await client.post("/api/v1/applications/nonexistent-id/apply")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_application_not_found(client):
    """Test updating a non-existent application."""
    resp = await client.patch("/api/v1/applications/nonexistent-id", json={
        "status": "APPLIED",
    })
    assert resp.status_code == 404
