// YuktiHire Extension — Background Service Worker
const API_BASE = "https://api.yuktihire.com/api/v1"
const APP_URL = "https://yuktihire.com"

// ── Token Management ──────────────────────────────────────────────────────

async function getToken() {
  // Check storage first
  const result = await chrome.storage.local.get(["yuktihire_token"])
  if (result.yuktihire_token) {
    // Verify token isn't expired by checking length (valid JWTs are 100+ chars)
    if (result.yuktihire_token.length > 50) return result.yuktihire_token
  }

  // Auto-fetch from yuktihire.com tab
  const freshToken = await fetchTokenFromTab()
  if (freshToken) return freshToken

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

        if (!token) {
          sendResponse({ ok: false, error: "Not authenticated. Open yuktihire.com and sign in." })
          return
        }

        // Trust the token — don't verify with API (saves time, prevents false negatives)
        // If token is expired, individual API calls will get 401 and we handle it there
        sendResponse({ ok: true, data: { authenticated: true } })
      } catch (e) {
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

  if (msg.type === "OPEN_POPUP") {
    // Can't open popup programmatically in MV3, but we can open the side panel or a new window
    chrome.action.openPopup().catch(() => {
      // Fallback: open as a small window
      chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 400,
        height: 600,
        top: 100,
        left: screen.width - 420,
      })
    })
    sendResponse({ ok: true })
    return false
  }

  if (msg.type === "QUICK_TAILOR") {
    apiCall("/tailor/quick", {
      method: "POST",
      body: JSON.stringify(msg.data),
    })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "GET_RESUMES") {
    apiCall("/extension/resumes")
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "TAILOR_STATUS") {
    apiCall(`/extension/tailor-status/${msg.sessionId}`)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "UPDATE_JD") {
    apiCall("/extension/update-jd", {
      method: "POST",
      body: JSON.stringify(msg.data),
    })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "DOWNLOAD_RESUME") {
    // Open download URL in new tab (browser handles the download)
    const format = msg.format || "pdf"
    const resumeId = msg.resumeId
    getToken().then(token => {
      if (!token) { sendResponse({ ok: false, error: "Not authenticated" }); return }
      // Use fetch to get the file, then create a blob URL
      fetch(`${API_BASE}/extension/export?resume_id=${resumeId}&format=${format}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(resp => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          return resp.blob()
        })
        .then(blob => {
          const url = URL.createObjectURL(blob)
          chrome.downloads.download({
            url,
            filename: `resume.${format}`,
            saveAs: true,
          }, () => {
            sendResponse({ ok: true })
            URL.revokeObjectURL(url)
          })
        })
        .catch(err => sendResponse({ ok: false, error: err.message }))
    })
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
