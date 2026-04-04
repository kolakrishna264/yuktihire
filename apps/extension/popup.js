// YuktiHire Extension — Universal AI Job Assistant

const APP_URL = "https://yuktihire.com"
const $ = (sel) => document.querySelector(sel)

function showState(id) {
  document.querySelectorAll(".state").forEach(el => el.classList.add("hidden"))
  $(id)?.classList.remove("hidden")
}

function setAuthBadge(ok) {
  const b = $("#auth-status")
  if (ok) { b.textContent = "Connected"; b.className = "auth-badge ok" }
  else { b.textContent = "Not signed in"; b.className = "auth-badge err" }
}

function showStatus(msg, type = "info") {
  const el = $("#status-msg")
  el.textContent = msg
  el.className = `status-msg ${type}`
  el.classList.remove("hidden")
}

function sendMessage(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, r => resolve(r || { ok: false, error: "No response" }))
  })
}

// Store page data globally so all buttons can use it
let pageData = null
let currentTabId = null

async function init() {
  showState("#loading-state")

  // 1. Auth check
  const auth = await sendMessage({ type: "CHECK_AUTH" })
  if (!auth.ok) {
    setAuthBadge(false)
    showState("#login-state")
    return
  }
  setAuthBadge(true)

  // 2. Get tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) {
    showState("#main-panel")
    showStatus("Open a job page to get started", "info")
    $("#manual-section").classList.remove("hidden")
    return
  }
  currentTabId = tab.id

  // 3. Show main panel immediately — all buttons always visible
  showState("#main-panel")

  // 4. Try to extract job data (non-blocking for the UI)
  try {
    pageData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" }).catch(() => null)
    if (pageData?.title && pageData.confidence > 0) {
      // Show job info
      $("#job-info").classList.remove("hidden")
      $("#job-title").textContent = pageData.title
      $("#job-company").textContent = pageData.company || "Unknown"
      $("#job-logo").textContent = (pageData.company || "?").charAt(0).toUpperCase()
      if (pageData.location) {
        $("#job-location").textContent = pageData.location
        $("#job-location").classList.remove("hidden")
      }
      $("#job-source").textContent = pageData.source_domain || ""
    }
  } catch {
    pageData = { url: tab.url, pageTitle: tab.title, source_domain: new URL(tab.url).hostname, description: "" }
  }

  // 5. Check if already saved
  try {
    const check = await sendMessage({ type: "CHECK_URL", url: tab.url })
    if (check.ok && check.data?.tracked) {
      $("#saved-badge-area").classList.remove("hidden")
      $("#save-btn").textContent = "✓ Saved"
      $("#save-btn").disabled = true
    }
  } catch {}

  // 6. If page has forms, show copilot analysis
  try {
    const analysis = await chrome.tabs.sendMessage(tab.id, { type: "GET_FORM_ANALYSIS" }).catch(() => null)
    if (analysis?.totalFields > 0) {
      $("#copilot-section").classList.remove("hidden")
      $("#field-summary").innerHTML = `
        <span class="stat ready">${analysis.readyCount} ready</span>
        <span class="stat ai">${analysis.needsAiCount} AI</span>
        <span class="stat input">${analysis.needsInputCount} input</span>
        ${analysis.fileUploadCount ? `<span class="stat file">${analysis.fileUploadCount} files</span>` : ""}
      `
      $("#field-list").innerHTML = (analysis.fields || []).slice(0, 15).map(f => `
        <div class="field-item">
          <div class="dot ${f.fillStatus === 'ready' ? 'ready' : f.fillStatus === 'needs_ai' ? 'ai' : 'input'}"></div>
          <span class="label">${(f.label || f.fieldType || "").slice(0, 40)}</span>
          <span class="badge ${f.confidence}">${f.confidence}</span>
        </div>
      `).join("")
    }
  } catch {}

  // Tab switching
  document.querySelectorAll(".copilot-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".copilot-tab").forEach(t => t.classList.remove("active"))
      tab.classList.add("active")
      document.querySelectorAll(".copilot-content").forEach(c => c.classList.add("hidden"))
      $(`#copilot-${tab.dataset.tab}`)?.classList.remove("hidden")
    })
  })
}

// ── Button handlers ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Login
  $("#login-btn").onclick = () => chrome.tabs.create({ url: `${APP_URL}/auth/login` })

  // Token paste
  setTimeout(() => {
    $("#token-save-btn")?.addEventListener("click", async () => {
      const token = $("#token-input")?.value?.trim()
      if (!token) return
      await sendMessage({ type: "SET_TOKEN", token, refresh: "", expires: 0 })
      init()
    })
  }, 100)

  // Back button (from success state)
  $("#back-btn")?.addEventListener("click", init)
  $("#retry-btn")?.addEventListener("click", init)

  // ── SAVE JOB ──────────────────────────────────────────────────────────
  $("#save-btn")?.addEventListener("click", async () => {
    const btn = $("#save-btn")
    btn.disabled = true
    btn.innerHTML = "💾 Saving..."

    // Get description from page
    let desc = pageData?.description || ""
    if ((!desc || desc.length < 50) && currentTabId) {
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => document.body?.innerText?.slice(0, 10000) || "",
        })
        if (r?.[0]?.result) desc = r[0].result
      } catch {}
    }

    const title = $("#manual-title")?.value?.trim() || pageData?.title || pageData?.pageTitle || "Untitled"
    const company = $("#manual-company")?.value?.trim() || pageData?.company || ""

    const result = await sendMessage({
      type: "CAPTURE_JOB",
      data: {
        url: pageData?.url || "",
        page_title: pageData?.pageTitle || "",
        extracted_title: title,
        extracted_company: company,
        extracted_description: desc.slice(0, 10000),
        source_domain: pageData?.source_domain || "",
      },
    })

    if (result.ok) {
      btn.innerHTML = "✓ Saved"
      showStatus("Job saved to dashboard!", "success")
    } else {
      btn.disabled = false
      btn.innerHTML = "💾 Save Job"
      showStatus(result.error || "Save failed", "error")
    }
  })

  // ── FILL FORM (Fill Everything) ───────────────────────────────────────
  $("#autofill-btn")?.addEventListener("click", async () => {
    if (!currentTabId) { showStatus("Open a job page first", "info"); return }

    const btn = $("#autofill-btn")
    btn.disabled = true
    btn.innerHTML = "⚡ Filling..."
    const logs = []
    const logsEl = $("#fill-logs")
    if (logsEl) logsEl.innerHTML = ""

    // Step 1: Fill profile fields
    showStatus("Filling profile fields...", "info")
    const profile = await sendMessage({ type: "GET_AUTOFILL_DATA" })
    if (profile.ok) {
      const r = await chrome.tabs.sendMessage(currentTabId, { type: "FILL_SAFE_FIELDS", data: profile.data }).catch(() => ({ filled: [], skipped: [], failed: [] }))
      r?.filled?.forEach(f => logs.push(`✓ ${f.label}: ${f.value}`))
      r?.skipped?.forEach(f => logs.push(`— ${f.label}: ${f.reason}`))
    }

    // Step 2: Fill questions by searching the page
    showStatus("Filling dropdowns & questions...", "info")
    const pd = profile?.data || {}
    const questionAnswers = [
      // Authorization & sponsorship
      { q: "authorized to work", a: pd.workAuthorization || "Yes" },
      { q: "legally authorized", a: pd.workAuthorization || "Yes" },
      { q: "right to work", a: pd.workAuthorization || "Yes" },
      { q: "sponsorship", a: pd.sponsorship || "Yes" },
      { q: "employment visa", a: pd.sponsorship || "Yes" },
      { q: "h-1b", a: pd.sponsorship || "Yes" },
      { q: "visa sponsorship", a: pd.sponsorship || "Yes" },
      // Location
      { q: "located in the dfw", a: "Yes" },
      { q: "dfw area", a: "Yes" },
      { q: "your address", a: pd.address || "Arlington, Texas, United States" },
      { q: "address from which", a: pd.address || "Arlington, Texas, United States" },
      { q: "open to relocation", a: pd.relocation || "Yes" },
      { q: "open to working in-person", a: "Yes" },
      // Personal
      { q: "pronouns", a: pd.pronouns || "He/him/his" },
      { q: "gender", a: pd.gender || "Male" },
      { q: "hispanic", a: pd.hispanicLatino || "No" },
      { q: "veteran", a: pd.veteranStatus || "I am not a protected veteran" },
      { q: "disability", a: pd.disabilityStatus || "I do not want to answer" },
      // Application specific
      { q: "interviewed at", a: pd.interviewedBefore || "No" },
      { q: "interviewed before", a: pd.interviewedBefore || "No" },
      { q: "ai policy", a: pd.aiPolicyAcknowledge || "Yes" },
      { q: "earliest", a: pd.earliestStart || "2 weeks from offer" },
      { q: "start working", a: pd.earliestStart || "2 weeks from offer" },
      { q: "deadlines", a: "No specific deadlines" },
      { q: "timeline consideration", a: "No specific timeline constraints" },
      // Consent
      { q: "text message", a: "Yes" },
      { q: "consent to receiving", a: "Yes" },
      { q: "sms", a: "Yes" },
    ]

    for (const qa of questionAnswers) {
      try {
        const r = await chrome.tabs.sendMessage(currentTabId, {
          type: "FIND_AND_FILL_QUESTION", question: qa.q, answer: qa.a
        }).catch(() => null)
        if (r?.ok) logs.push(`✓ ${qa.q}: ${qa.a}`)
      } catch {}
    }

    // Step 3: AI answers for open questions
    showStatus("Generating AI answers...", "info")
    try {
      const analysis = await chrome.tabs.sendMessage(currentTabId, { type: "GET_FORM_ANALYSIS" }).catch(() => ({ fields: [] }))
      const aiFields = (analysis?.fields || []).filter(f =>
        f.fillStatus === "needs_ai" || f.fieldType === "customQuestion" ||
        f.fieldType === "motivation" || f.fieldType === "openEnded"
      )
      for (const field of aiFields) {
        btn.innerHTML = `⚡ AI: ${(field.label || "").slice(0, 15)}...`
        const answer = await sendMessage({
          type: "GENERATE_ANSWER", data: { question: field.label || field.placeholder || "" }
        })
        if (answer.ok && answer.data?.answer) {
          await chrome.tabs.sendMessage(currentTabId, {
            type: "FILL_SINGLE_FIELD", selector: field.selector, value: answer.data.answer
          }).catch(() => null)
          logs.push(`✓ AI: ${(field.label || "").slice(0, 30)}`)
        }
      }
    } catch {}

    // Done
    const filledCount = logs.filter(l => l.startsWith("✓")).length
    btn.innerHTML = `✓ ${filledCount} filled`
    showStatus(`Filled ${filledCount} fields`, "success")

    // Show logs
    if (logsEl) {
      logsEl.innerHTML = logs.map(l => {
        const icon = l.startsWith("✓") ? "✓" : l.startsWith("✗") ? "✗" : "—"
        return `<div class="log-item"><span class="status-icon">${icon}</span> ${l.slice(2)}</div>`
      }).join("")
    }

    // Show copilot + switch to logs
    $("#copilot-section").classList.remove("hidden")
    document.querySelectorAll(".copilot-tab").forEach(t => t.classList.remove("active"))
    $('[data-tab="logs"]')?.classList.add("active")
    document.querySelectorAll(".copilot-content").forEach(c => c.classList.add("hidden"))
    $("#copilot-logs")?.classList.remove("hidden")
  })

  // ── TAILOR RESUME ─────────────────────────────────────────────────────
  $("#tailor-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard/tailor` })
  })

  // ── DASHBOARD ─────────────────────────────────────────────────────────
  $("#dashboard-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard/jobs` })
  })

  // ── MANUAL SAVE ───────────────────────────────────────────────────────
  $("#manual-save-btn")?.addEventListener("click", async () => {
    const title = $("#manual-title")?.value?.trim()
    if (!title) { alert("Enter a job title"); return }
    const btn = $("#manual-save-btn")
    btn.disabled = true; btn.textContent = "Saving..."
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const r = await sendMessage({
      type: "CAPTURE_JOB",
      data: { url: tab?.url || "", page_title: tab?.title || "", extracted_title: title,
        extracted_company: $("#manual-company")?.value?.trim() || "", source_domain: tab?.url ? new URL(tab.url).hostname : "" }
    })
    if (r.ok) showStatus("Saved!", "success")
    else { showStatus(r.error || "Failed", "error"); btn.disabled = false; btn.textContent = "Save Job" }
  })

  init()
})
