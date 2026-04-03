// YuktiHire Extension Popup

const APP_URL = "http://localhost:3000"  // Change to https://yuktihire.com for release

const $ = (sel) => document.querySelector(sel)

function showState(stateId) {
  document.querySelectorAll(".state").forEach(el => el.classList.add("hidden"))
  $(stateId).classList.remove("hidden")
}

function setAuthBadge(ok) {
  const badge = $("#auth-status")
  if (ok) {
    badge.textContent = "Connected"
    badge.className = "auth-badge ok"
  } else {
    badge.textContent = "Not signed in"
    badge.className = "auth-badge err"
  }
}

async function init() {
  showState("#loading-state")

  // 1. Check auth
  const authResult = await sendMessage({ type: "CHECK_AUTH" })
  if (!authResult.ok) {
    setAuthBadge(false)
    showState("#login-state")
    return
  }
  setAuthBadge(true)

  // 2. Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) {
    showState("#no-job-state")
    return
  }

  // 3. Check if URL is already tracked
  const checkResult = await sendMessage({ type: "CHECK_URL", url: tab.url })
  if (checkResult.ok && checkResult.data?.tracked) {
    showAlreadySaved(checkResult.data)
    return
  }

  // 4. Extract job data from page
  try {
    const jobData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" })
    if (jobData && jobData.title) {
      showJobDetected(jobData, tab.url)
    } else {
      showState("#no-job-state")
    }
  } catch {
    // Content script might not be loaded on this page
    showState("#no-job-state")
  }
}

function showJobDetected(data, url) {
  $("#job-title").textContent = data.title || "Untitled"
  $("#job-company").textContent = data.company || "Unknown company"
  $("#job-url").textContent = url.slice(0, 60) + (url.length > 60 ? "..." : "")

  // Save button
  $("#save-btn").onclick = async () => {
    $("#save-btn").disabled = true
    $("#save-btn").textContent = "Saving..."

    const result = await sendMessage({
      type: "CAPTURE_JOB",
      data: {
        url: url,
        page_title: data.pageTitle,
        extracted_title: data.title,
        extracted_company: data.company,
        extracted_description: data.description?.slice(0, 10000),
        source_domain: data.source_domain,
      },
    })

    if (result.ok) {
      showSuccess(result.data)
    } else {
      showError(result.error)
    }
  }

  // Apply button
  $("#apply-btn").onclick = async () => {
    // Save then open the job URL
    const result = await sendMessage({
      type: "CAPTURE_JOB",
      data: {
        url: url,
        page_title: data.pageTitle,
        extracted_title: data.title,
        extracted_company: data.company,
        extracted_description: data.description?.slice(0, 10000),
        source_domain: data.source_domain,
      },
    })
    window.open(url, "_blank")
  }

  // Links (hidden until save, but we'll show them)
  $("#dashboard-link").href = `${APP_URL}/dashboard/discover`
  $("#tailor-link").href = `${APP_URL}/dashboard/tailor`

  showState("#job-detected-state")
}

function showAlreadySaved(data) {
  $("#saved-title").textContent = data.title || "—"
  $("#saved-company").textContent = data.company || "—"
  $("#saved-stage").textContent = `Stage: ${(data.stage || "INTERESTED").replace(/_/g, " ")}`

  $("#saved-dashboard-link").href = `${APP_URL}/dashboard/tracker/${data.trackerId}`
  $("#saved-tailor-link").href = `${APP_URL}/dashboard/tailor?tracker=${data.trackerId}`

  showState("#already-saved-state")
}

function showSuccess(data) {
  if (data?.dashboardUrl) {
    $("#success-link").href = `${APP_URL}${data.dashboardUrl}`
  } else {
    $("#success-link").href = `${APP_URL}/dashboard/tracker`
  }
  showState("#success-state")
}

function showError(msg) {
  $("#error-msg").textContent = msg || "Please try again"
  showState("#error-state")
}

function sendMessage(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || { ok: false, error: "No response" })
    })
  })
}

// Login button
document.addEventListener("DOMContentLoaded", () => {
  $("#login-btn").onclick = () => {
    // Open the app's extension callback page — handles Supabase auth + sends token back
    chrome.tabs.create({ url: `${APP_URL}/auth/extension-callback` })
  }

  $("#manual-save-btn")?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) return
    const result = await sendMessage({
      type: "CAPTURE_JOB",
      data: { url: tab.url, page_title: tab.title, source_domain: new URL(tab.url).hostname },
    })
    if (result.ok) showSuccess(result.data)
    else showError(result.error)
  })

  $("#retry-btn")?.addEventListener("click", init)

  init()
})
