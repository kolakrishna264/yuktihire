// YuktiHire Extension — Background Service Worker
const API_BASE = "https://api.yuktihire.com/api/v1"
const APP_URL = "https://yuktihire.com"

// ── Token Management ──────────────────────────────────────────────────────

async function getToken() {
  // ALWAYS try cookie first — it has the freshest token
  try {
    const cookies = await chrome.cookies.getAll({ domain: "yuktihire.com" })
    const authCookie = cookies.find(c => c.name.includes("auth-token"))
    if (authCookie) {
      const raw = authCookie.value.startsWith("base64-") ? authCookie.value.slice(7) : authCookie.value
      const decoded = JSON.parse(atob(raw))
      if (decoded.access_token) {
        return decoded.access_token
      }
    }
  } catch (e) {
    console.log("[YuktiHire] Cookie read error:", e)
  }

  // Fallback to storage only if cookie unavailable
  const result = await chrome.storage.local.get(["yuktihire_token"])
  return result.yuktihire_token || null
}

async function storeTokens(accessToken, refreshToken, expiresAt) {
  // Always clean the token — remove surrounding quotes, whitespace
  const clean = (accessToken || "").replace(/^['"`\s]+|['"`\s]+$/g, "")
  await chrome.storage.local.set({
    yuktihire_token: clean,
    yuktihire_refresh: (refreshToken || "").replace(/^['"`\s]+|['"`\s]+$/g, ""),
    yuktihire_expires: expiresAt || 0,
  })
  console.log("[YuktiHire] Token stored:", clean.slice(0, 20) + "...")
}

async function clearTokens() {
  await chrome.storage.local.remove(["yuktihire_token", "yuktihire_refresh", "yuktihire_expires"])
}

// ── API Helper ────────────────────────────────────────────────────────────

async function apiCall(path, options = {}) {
  const token = await getToken()
  console.log("[YuktiHire] apiCall", path, "token:", token ? token.slice(0, 20) + "..." : "NULL")

  if (!token) throw new Error("Not authenticated")

  const url = `${API_BASE}${path}`
  console.log("[YuktiHire] Fetching:", url)

  const resp = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  console.log("[YuktiHire] Response:", resp.status, resp.statusText)

  if (resp.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }

  if (!resp.ok) {
    const text = await resp.text()
    console.log("[YuktiHire] Error body:", text)
    try {
      const data = JSON.parse(text)
      throw new Error(data.detail || `HTTP ${resp.status}`)
    } catch (e) {
      if (e.message.includes("HTTP")) throw e
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
    }
  }

  if (resp.status === 204) return null
  return resp.json()
}

// ── Message Handler ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_AUTH") {
    (async () => {
      try {
        // Try to get token from cookie directly
        let token = null
        const result = await chrome.storage.local.get(["yuktihire_token"])
        token = result.yuktihire_token

        if (!token) {
          // Read from yuktihire.com cookie
          const cookies = await chrome.cookies.getAll({ domain: "yuktihire.com" })
          console.log("[YuktiHire] All cookies:", cookies.map(c => c.name))
          const authCookie = cookies.find(c => c.name.includes("auth-token"))
          if (authCookie) {
            const raw = authCookie.value.startsWith("base64-") ? authCookie.value.slice(7) : authCookie.value
            const decoded = JSON.parse(atob(raw))
            token = decoded.access_token
            if (token) {
              await chrome.storage.local.set({ yuktihire_token: token })
              console.log("[YuktiHire] Token from cookie:", token.slice(0, 20) + "...")
            }
          }
        }

        if (!token) {
          sendResponse({ ok: false, error: "No token found" })
          return
        }

        // Skip API check — just confirm we have a token
        sendResponse({ ok: true, data: { authenticated: true } })
      } catch (e) {
        console.log("[YuktiHire] CHECK_AUTH error:", e.message)
        sendResponse({ ok: false, error: e.message })
      }
    })()
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
    // Strip quotes that may wrap the token from console paste
    const cleanToken = (msg.token || "").replace(/^['"`]+|['"`]+$/g, "").trim()
    storeTokens(cleanToken, msg.refresh, msg.expires)
      .then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === "LOGOUT") {
    clearTokens().then(() => sendResponse({ ok: true }))
    return true
  }

  return false
})
