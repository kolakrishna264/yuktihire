const API_BASE = "http://localhost:8000/api/v1"  // Change to production URL for release
const APP_URL = "http://localhost:3000"  // Change to https://yuktihire.com for release

// Get stored auth token
async function getToken() {
  const result = await chrome.storage.local.get(["yuktihire_token"])
  return result.yuktihire_token || null
}

// API call helper
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

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(data.detail || `HTTP ${resp.status}`)
  }

  if (resp.status === 204) return null
  return resp.json()
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_AUTH") {
    apiCall("/extension/status")
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true  // async response
  }

  if (msg.type === "CHECK_URL") {
    apiCall(`/extension/check-url?url=${encodeURIComponent(msg.url)}`)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "CAPTURE_JOB") {
    apiCall("/extension/capture", {
      method: "POST",
      body: JSON.stringify(msg.data),
    })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === "SET_TOKEN") {
    chrome.storage.local.set({ yuktihire_token: msg.token })
    sendResponse({ ok: true })
    return false
  }

  if (msg.type === "LOGOUT") {
    chrome.storage.local.remove(["yuktihire_token"])
    sendResponse({ ok: true })
    return false
  }
})
