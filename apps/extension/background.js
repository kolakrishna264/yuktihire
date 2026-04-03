// YuktiHire Extension — Background Service Worker
const API_BASE = "http://localhost:8000/api/v1"
const APP_URL = "http://localhost:3000"

// ── Token Management ──────────────────────────────────────────────────────

async function getToken() {
  const result = await chrome.storage.local.get(["yuktihire_token", "yuktihire_refresh", "yuktihire_expires"])
  const token = result.yuktihire_token
  const expires = result.yuktihire_expires || 0

  if (!token) return null

  // Check if expired (with 5 min buffer) — prompt re-login
  if (expires && Date.now() / 1000 > expires - 300) {
    console.log("[YuktiHire] Token expired, clearing")
    await clearTokens()
    return null
  }

  return token
}

async function storeTokens(accessToken, refreshToken, expiresAt) {
  await chrome.storage.local.set({
    yuktihire_token: accessToken,
    yuktihire_refresh: refreshToken || "",
    yuktihire_expires: expiresAt || 0,
  })
  console.log("[YuktiHire] Tokens stored")
}

async function clearTokens() {
  await chrome.storage.local.remove(["yuktihire_token", "yuktihire_refresh", "yuktihire_expires"])
}

// ── API Helper ────────────────────────────────────────────────────────────

async function apiCall(path, options = {}) {
  const token = await getToken()
  if (!token) throw new Error("Not authenticated")

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  if (resp.status === 401) {
    await clearTokens()
    throw new Error("Session expired. Please sign in again.")
  }

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(data.detail || `HTTP ${resp.status}`)
  }

  if (resp.status === 204) return null
  return resp.json()
}

// ── Message Handler ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_AUTH") {
    apiCall("/extension/status")
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "CHECK_URL") {
    apiCall(`/extension/check-url?url=${encodeURIComponent(msg.url)}`)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "CAPTURE_JOB") {
    apiCall("/extension/capture", { method: "POST", body: JSON.stringify(msg.data) })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "SET_TOKEN") {
    storeTokens(msg.token, msg.refresh, msg.expires)
      .then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === "LOGOUT") {
    clearTokens().then(() => sendResponse({ ok: true }))
    return true
  }

  return false
})
