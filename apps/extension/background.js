// YuktiHire Extension — Background Service Worker
const API_BASE = "https://api.yuktihire.com/api/v1"
const APP_URL = "https://yuktihire.com"

// ── Token Management ──────────────────────────────────────────────────────

async function getToken() {
  // Check storage first
  const result = await chrome.storage.local.get(["yuktihire_token"])
  if (result.yuktihire_token) return result.yuktihire_token
  return null
}

// Try to get token by injecting a script into yuktihire.com tab
async function fetchTokenFromTab() {
  try {
    // Find any open yuktihire.com tab
    const tabs = await chrome.tabs.query({ url: ["https://yuktihire.com/*", "https://www.yuktihire.com/*", "http://localhost:3000/*"] })
    if (!tabs.length) return null

    // Inject a script to read the cookie from the page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        try {
          const cookie = document.cookie
          const match = cookie.match(/sb-[^=]+-auth-token=base64-([^;]+)/)
          if (match) {
            const decoded = JSON.parse(atob(match[1]))
            return decoded.access_token || null
          }
        } catch {}
        return null
      },
    })

    if (results?.[0]?.result) {
      const token = results[0].result
      await storeTokens(token, "", 0)
      console.log("[YuktiHire] Token from tab injection:", token.slice(0, 20) + "...")
      return token
    }
  } catch (e) {
    console.log("[YuktiHire] Tab injection error:", e.message)
  }
  return null
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
  let token = await getToken()
  if (!token) token = await fetchTokenFromTab()
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
        let token = await getToken()

        // If no stored token, try reading from an open yuktihire.com tab
        if (!token) {
          token = await fetchTokenFromTab()
        }

        if (!token) {
          sendResponse({ ok: false, error: "Not authenticated" })
          return
        }

        // Verify token works
        try {
          const resp = await fetch(`${API_BASE}/extension/status`, {
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
          })
          if (resp.ok) {
            sendResponse({ ok: true, data: await resp.json() })
          } else {
            // Token expired — try refreshing from tab
            console.log("[YuktiHire] Token invalid, trying tab refresh...")
            await chrome.storage.local.remove(["yuktihire_token"])
            const freshToken = await fetchTokenFromTab()
            if (freshToken) {
              const resp2 = await fetch(`${API_BASE}/extension/status`, {
                headers: { "Authorization": `Bearer ${freshToken}`, "Content-Type": "application/json" }
              })
              if (resp2.ok) {
                sendResponse({ ok: true, data: await resp2.json() })
                return
              }
            }
            sendResponse({ ok: false, error: "Session expired. Open yuktihire.com and log in, then try again." })
          }
        } catch (e) {
          sendResponse({ ok: false, error: e.message })
        }
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

  if (msg.type === "GET_AUTOFILL_DATA") {
    apiCall("/extension/autofill-data")
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "GENERATE_ANSWER") {
    apiCall("/answers/generate", {
      method: "POST",
      body: JSON.stringify({
        question: msg.data.question,
        tone: "professional",
      }),
    })
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
