// YuktiHire Extension Popup — Universal job detection

const APP_URL = "https://yuktihire.com"
const $ = (sel) => document.querySelector(sel)

function showState(stateId) {
  document.querySelectorAll(".state").forEach(el => el.classList.add("hidden"))
  $(stateId)?.classList.remove("hidden")
}

function setAuthBadge(ok) {
  const badge = $("#auth-status")
  if (ok) { badge.textContent = "Connected"; badge.className = "auth-badge ok" }
  else { badge.textContent = "Not signed in"; badge.className = "auth-badge err" }
}

async function init() {
  showState("#loading-state")

  // 1. Check auth
  const authResult = await sendMessage({ type: "CHECK_AUTH" })
  if (!authResult.ok) { setAuthBadge(false); showState("#login-state"); return }
  setAuthBadge(true)

  // 2. Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:")) {
    showNoJob("This is a browser page, not a job site.")
    return
  }

  // 3. Check if already tracked
  const checkResult = await sendMessage({ type: "CHECK_URL", url: tab.url })
  if (checkResult.ok && checkResult.data?.tracked) {
    showAlreadySaved(checkResult.data)
    return
  }

  // 4. Extract job data from page
  try {
    const jobData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" })

    if (jobData && jobData.title && jobData.confidence > 0) {
      showJobDetected(jobData, tab.url)
    } else if (jobData && jobData.pageType === "job") {
      // Page looks like a job but couldn't extract title — show manual with hints
      showNoJob("This looks like a job page but we couldn't extract the title. Save it manually below.")
      if (jobData.company) $("#manual-company").value = jobData.company
    } else {
      showNoJob("We couldn't detect a job on this page. You can save it manually.")
    }
  } catch {
    showNoJob("Unable to read this page. Save manually below.")
  }
}

function showNoJob(reason) {
  $("#no-job-reason").textContent = reason
  showState("#no-job-state")
}

async function showJobDetected(data, url) {
  // Capture full page text as description fallback
  let fullDesc = data.description || ""
  if (!fullDesc || fullDesc.length < 50) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body?.innerText?.slice(0, 10000) || "",
        })
        if (results?.[0]?.result) fullDesc = results[0].result
      }
    } catch {}
  }

  // Title & company
  $("#job-title").textContent = data.title || "Untitled"
  $("#job-company").textContent = data.company || "Unknown"
  $("#job-logo").textContent = (data.company || "?").charAt(0).toUpperCase()

  // Location
  const locEl = $("#job-location")
  if (data.location) { locEl.textContent = data.location; locEl.classList.remove("hidden") }
  else { locEl.classList.add("hidden") }

  // Source
  const srcEl = $("#job-source")
  srcEl.textContent = data.matched_extractor || data.source_domain || ""

  // Detection info badge
  const infoEl = $("#detection-info")
  if (data.confidence >= 80) {
    infoEl.textContent = "✓ High confidence detection"
    infoEl.className = "detection-badge high"
  } else if (data.confidence >= 40) {
    infoEl.textContent = "~ Partial detection — review details"
    infoEl.className = "detection-badge medium"
  } else {
    infoEl.textContent = "? Low confidence — please verify"
    infoEl.className = "detection-badge low"
  }

  // Description preview
  const descEl = $("#job-desc-preview")
  if (data.description && data.description.length > 20) {
    descEl.textContent = data.description.slice(0, 150) + "..."
    descEl.style.display = "block"
  } else {
    descEl.style.display = "none"
  }

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
        extracted_description: fullDesc.slice(0, 10000),
        source_domain: data.source_domain,
      },
    })
    if (result.ok) { showSuccess(result.data) }
    else { showError(result.error) }
  }

  // Apply button — save + open URL
  $("#apply-btn").onclick = async () => {
    await sendMessage({
      type: "CAPTURE_JOB",
      data: {
        url: url,
        page_title: data.pageTitle,
        extracted_title: data.title,
        extracted_company: data.company,
        extracted_description: fullDesc.slice(0, 10000),
        source_domain: data.source_domain,
      },
    })
    window.open(url, "_blank")
  }

  // Links
  $("#dashboard-link").href = `${APP_URL}/dashboard/jobs`
  $("#tailor-link").href = `${APP_URL}/dashboard/tailor`

  showState("#job-detected-state")
}

function showAlreadySaved(data) {
  $("#saved-title").textContent = data.title || "—"
  $("#saved-company").textContent = data.company || "—"
  $("#saved-stage").textContent = `Status: ${(data.stage || "Saved").replace(/_/g, " ")}`
  $("#saved-dashboard-link").href = `${APP_URL}/dashboard/jobs`
  $("#saved-tailor-link").href = `${APP_URL}/dashboard/tailor`
  showState("#already-saved-state")
}

function showSuccess(data) {
  $("#success-link").href = `${APP_URL}/dashboard/jobs`
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

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  $("#login-btn").onclick = async () => {
    // Open login page. After login, user comes back and clicks extension again.
    // The popup will then prompt for manual token entry.
    chrome.tabs.create({ url: `${APP_URL}/auth/login` })
  }

  // Also add a manual token entry option for reliability
  const loginState = $("#login-state")
  if (loginState) {
    const tokenDiv = document.createElement("div")
    tokenDiv.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6"
    tokenDiv.innerHTML = `
      <p style="font-size:10px;color:#9ca3af;margin-bottom:6px">Or paste your access token:</p>
      <input id="token-input" class="form-input" placeholder="Paste Supabase access token" style="font-size:11px" />
      <button id="token-save-btn" class="btn btn-outline" style="margin-top:4px;font-size:11px;padding:6px">Connect</button>
      <p style="font-size:9px;color:#9ca3af;margin-top:4px">Get token: Open yuktihire.com → F12 → Console → type: (await supabase.auth.getSession()).data.session.access_token</p>
    `
    loginState.appendChild(tokenDiv)

    // Defer event listener to next tick
    setTimeout(() => {
      document.getElementById("token-save-btn")?.addEventListener("click", async () => {
        const token = document.getElementById("token-input")?.value?.trim()
        if (!token) return
        await sendMessage({ type: "SET_TOKEN", token, refresh: "", expires: 0 })
        init() // Re-check auth
      })
    }, 100)
  }

  // Manual save with editable fields
  $("#manual-save-btn")?.addEventListener("click", async () => {
    const title = $("#manual-title")?.value?.trim()
    const company = $("#manual-company")?.value?.trim()

    if (!title) { alert("Please enter a job title"); return }

    $("#manual-save-btn").disabled = true
    $("#manual-save-btn").textContent = "Saving..."

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const result = await sendMessage({
      type: "CAPTURE_JOB",
      data: {
        url: tab?.url || "",
        page_title: tab?.title || "",
        extracted_title: title,
        extracted_company: company || "Unknown",
        source_domain: tab?.url ? new URL(tab.url).hostname : "",
      },
    })
    if (result.ok) showSuccess(result.data)
    else {
      showError(result.error)
      $("#manual-save-btn").disabled = false
      $("#manual-save-btn").textContent = "Save Job"
    }
  })

  $("#retry-btn")?.addEventListener("click", init)
  init()
})
