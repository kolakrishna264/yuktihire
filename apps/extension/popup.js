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

      // If we have a full description, ensure it's stored as JD for tailoring
      if (desc && desc.length > 100 && result.data?.trackerId) {
        sendMessage({
          type: "UPDATE_JD",
          data: { tracker_id: result.data.trackerId, description: desc.slice(0, 10000) }
        }).catch(() => {})
      }
    } else {
      btn.disabled = false
      btn.innerHTML = "💾 Save Job"
      showStatus(result.error || "Save failed", "error")
    }
  })

  // ── FILL FORM — 4-Phase Intelligent Engine ────────────────────────
  $("#autofill-btn")?.addEventListener("click", async () => {
    if (!currentTabId) { showStatus("Open a job page first", "info"); return }

    const btn = $("#autofill-btn")
    btn.disabled = true
    const logs = []
    const logsEl = $("#fill-logs")
    if (logsEl) logsEl.innerHTML = ""

    // ── PHASE 1: Load profile data ──
    btn.innerHTML = "⚡ Loading profile..."
    showStatus("Loading your profile...", "info")
    const profile = await sendMessage({ type: "GET_AUTOFILL_DATA" })
    if (!profile.ok) {
      showStatus("Could not load profile data", "error")
      btn.disabled = false; btn.innerHTML = "⚡ Fill Form"; return
    }
    const pd = profile.data || {}

    // ── PHASE 2: Engine fill — scan, classify, resolve, fill all deterministic fields ──
    btn.innerHTML = "⚡ Scanning form..."
    showStatus("Scanning and filling form fields...", "info")

    let engineResult = { filled: [], needsAI: [], needsAsync: [], skipped: [], total: 0 }
    try {
      engineResult = await chrome.tabs.sendMessage(currentTabId, {
        type: "ENGINE_FILL_ALL", data: pd
      }).catch(() => engineResult)
    } catch {}

    // If main frame has no form, try iframes
    if (!engineResult?.total && !engineResult?.filled?.length) {
      try {
        const ifrResults = await chrome.scripting.executeScript({
          target: { tabId: currentTabId, allFrames: true },
          func: (profileData) => {
            if (typeof YuktiEngine !== "undefined") return YuktiEngine.fillAll(profileData)
            return { filled: [], needsAI: [], needsAsync: [], total: 0 }
          },
          args: [pd],
        })
        for (const fr of (ifrResults || [])) {
          if (fr.result?.filled?.length || fr.result?.needsAI?.length) {
            engineResult = fr.result; break
          }
        }
      } catch {}
    }

    engineResult?.filled?.forEach(f => logs.push(`✓ ${f.label}: ${f.value} [${f.source}]`))

    // ── PHASE 3: Fill custom dropdowns (async — click, wait, select) ──
    if (engineResult?.needsAsync?.length) {
      btn.innerHTML = `⚡ Dropdowns (${engineResult.needsAsync.length})...`
      showStatus("Filling custom dropdowns...", "info")
      for (const asyncField of engineResult.needsAsync) {
        try {
          const r = await chrome.tabs.sendMessage(currentTabId, {
            type: "ENGINE_FILL_ASYNC", selector: asyncField.selector, value: asyncField.value
          }).catch(() => null)
          if (r?.ok) logs.push(`✓ ${asyncField.label.slice(0, 40)}: ${r.selected || asyncField.value}`)
          await new Promise(res => setTimeout(res, 300))
        } catch {}
      }
    }

    // ── PHASE 4: AI fill — every remaining empty field gets an AI answer ──
    if (engineResult?.needsAI?.length) {
      showStatus(`AI answering ${engineResult.needsAI.length} questions...`, "info")

      for (const field of engineResult.needsAI) {
        const label = field.label || ""
        if (!label) continue
        btn.innerHTML = `⚡ AI: ${label.slice(0, 18)}...`

        // Build smart prompt based on field category
        let prompt = label
        if (field.helperText) prompt += "\n\nContext: " + field.helperText.slice(0, 300)

        // For selects with options, ask AI to pick
        if (field.options?.length > 0) {
          prompt = `For the question "${label}", pick the BEST option. Options: ${field.options.join(", ")}. Reply with ONLY the exact option text.`
          if (field.helperText) prompt += `\nContext: ${field.helperText.slice(0, 200)}`
        }

        // For open-ended / motivation, give richer context
        if (field.category === "motivation" || field.category === "behavioral" || field.category === "technical" || field.category === "openEnded") {
          prompt = `Answer this job application question professionally (200-400 words if open-ended, 1-2 sentences if short):\n\n"${label}"\n\nContext: ${field.helperText?.slice(0, 300) || "No additional context."}`
        }

        try {
          const answer = await sendMessage({ type: "GENERATE_ANSWER", data: { question: prompt } })
          if (answer.ok && answer.data?.answer) {
            const value = answer.data.answer.trim()
            let fillOk = false

            // Fill based on input type
            if (field.inputType === "nativeSelect" || field.inputType === "customSelect") {
              const r = await chrome.tabs.sendMessage(currentTabId, {
                type: "ENGINE_FILL_ASYNC", selector: field.selector, value: value
              }).catch(() => null)
              fillOk = r?.ok
              // Fallback: try native select fill
              if (!fillOk) {
                const r2 = await chrome.tabs.sendMessage(currentTabId, {
                  type: "ENGINE_FILL_BY_SELECTOR", selector: field.selector, value: value
                }).catch(() => null)
                fillOk = r2?.ok
              }
            } else {
              const r = await chrome.tabs.sendMessage(currentTabId, {
                type: "ENGINE_FILL_BY_SELECTOR", selector: field.selector, value: value
              }).catch(() => null)
              fillOk = r?.ok
            }

            if (fillOk) logs.push(`✓ AI: ${label.slice(0, 35)}`)
            else logs.push(`— AI: ${label.slice(0, 35)} (fill failed)`)
          }
        } catch {}

        await new Promise(res => setTimeout(res, 200))
      }
    }

    // ── PHASE 5: Final sweep — find any remaining empty fields ──
    let remaining = []
    try {
      remaining = await chrome.tabs.sendMessage(currentTabId, { type: "ENGINE_GET_EMPTY" }).catch(() => [])
      if (!Array.isArray(remaining)) remaining = []
    } catch {}

    if (remaining.length > 0) {
      btn.innerHTML = `⚡ Final sweep (${remaining.length})...`
      for (const field of remaining) {
        if (!field.label) continue
        btn.innerHTML = `⚡ ${field.label.slice(0, 18)}...`

        let prompt = field.label
        if (field.options?.length) {
          prompt = `Pick the best option for "${field.label}": ${field.options.join(", ")}. Reply ONLY with the option text.`
        }

        try {
          const answer = await sendMessage({ type: "GENERATE_ANSWER", data: { question: prompt } })
          if (answer.ok && answer.data?.answer) {
            const v = answer.data.answer.trim()
            if (field.inputType === "customSelect" || field.inputType === "nativeSelect") {
              await chrome.tabs.sendMessage(currentTabId, { type: "ENGINE_FILL_ASYNC", selector: field.selector, value: v }).catch(() => null)
            } else {
              await chrome.tabs.sendMessage(currentTabId, { type: "ENGINE_FILL_BY_SELECTOR", selector: field.selector, value: v }).catch(() => null)
            }
            logs.push(`✓ Sweep: ${field.label.slice(0, 35)}`)
          }
        } catch {}
        await new Promise(res => setTimeout(res, 200))
      }
    }

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
  let tailorResumeId = null
  let tailorSessionId = null

  $("#tailor-btn")?.addEventListener("click", async () => {
    const section = $("#tailor-section")
    section.classList.remove("hidden")
    $("#tailor-resume-select").classList.remove("hidden")
    $("#tailor-progress").classList.add("hidden")
    $("#tailor-results").classList.add("hidden")

    // Load resumes
    const r = await sendMessage({ type: "GET_RESUMES" })
    if (r.ok && r.data?.resumes?.length) {
      const sel = $("#resume-select")
      sel.innerHTML = r.data.resumes.map(res =>
        `<option value="${res.id}" ${res.isDefault ? "selected" : ""}>${res.name}${res.isDefault ? " (default)" : ""}</option>`
      ).join("")
      tailorResumeId = r.data.resumes.find(r => r.isDefault)?.id || r.data.resumes[0]?.id
      sel.onchange = () => { tailorResumeId = sel.value }
    } else {
      showStatus("No resumes found. Upload one first.", "error")
    }
  })

  $("#tailor-close")?.addEventListener("click", () => {
    $("#tailor-section").classList.add("hidden")
  })

  $("#start-tailor-btn")?.addEventListener("click", async () => {
    if (!tailorResumeId) { showStatus("Select a resume", "error"); return }

    // Get JD from page
    let jd = pageData?.description || ""
    if ((!jd || jd.length < 50) && currentTabId) {
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => document.body?.innerText?.slice(0, 15000) || "",
        })
        if (r?.[0]?.result) jd = r[0].result
      } catch {}
    }

    if (!jd || jd.length < 50) {
      showStatus("Could not extract job description from this page", "error")
      return
    }

    // Show progress
    $("#tailor-resume-select").classList.add("hidden")
    $("#tailor-progress").classList.remove("hidden")
    const progressBar = $("#tailor-progress-bar")
    progressBar.style.width = "10%"

    // Start tailoring
    const result = await sendMessage({
      type: "QUICK_TAILOR",
      data: { job_description: jd, resume_id: tailorResumeId },
    })

    if (!result.ok) {
      showStatus(result.error || "Tailoring failed", "error")
      $("#tailor-resume-select").classList.remove("hidden")
      $("#tailor-progress").classList.add("hidden")
      return
    }

    tailorSessionId = result.data?.sessionId
    tailorResumeId = result.data?.resumeId || tailorResumeId
    progressBar.style.width = "30%"

    // Poll for completion
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      progressBar.style.width = `${Math.min(30 + attempts * 5, 90)}%`

      const status = await sendMessage({ type: "TAILOR_STATUS", sessionId: tailorSessionId })
      if (!status.ok) {
        if (attempts > 30) {
          clearInterval(poll)
          showStatus("Tailoring timed out", "error")
          $("#tailor-progress").classList.add("hidden")
          $("#tailor-resume-select").classList.remove("hidden")
        }
        return
      }

      if (status.data?.status === "COMPLETED") {
        clearInterval(poll)
        progressBar.style.width = "100%"

        // Show results
        setTimeout(() => {
          $("#tailor-progress").classList.add("hidden")
          $("#tailor-results").classList.remove("hidden")

          const ats = status.data.atsScore
          if (ats) {
            $("#ats-score-value").textContent = ats.overall || "--"
            $("#score-breakdown").innerHTML = `
              <div class="score-row"><span>Keywords</span><span>${ats.keywords || "--"}%</span></div>
              <div class="score-row"><span>Skills</span><span>${ats.skills || "--"}%</span></div>
              <div class="score-row"><span>Experience</span><span>${ats.experience || "--"}%</span></div>
            `
          }
        }, 500)
      } else if (status.data?.status === "FAILED" || status.data?.status === "ERROR") {
        clearInterval(poll)
        showStatus("Tailoring failed. Try in dashboard.", "error")
        $("#tailor-progress").classList.add("hidden")
        $("#tailor-resume-select").classList.remove("hidden")
      }
    }, 2000)
  })

  // Download buttons
  $("#dl-pdf-btn")?.addEventListener("click", async () => {
    if (!tailorResumeId) return
    const btn = $("#dl-pdf-btn")
    btn.disabled = true; btn.textContent = "Generating..."
    const r = await sendMessage({ type: "DOWNLOAD_RESUME", resumeId: tailorResumeId, format: "pdf" })
    btn.disabled = false; btn.textContent = "Download PDF"
    if (!r.ok) showStatus(r.error || "PDF download failed", "error")
  })

  $("#dl-docx-btn")?.addEventListener("click", async () => {
    if (!tailorResumeId) return
    const btn = $("#dl-docx-btn")
    btn.disabled = true; btn.textContent = "Generating..."
    const r = await sendMessage({ type: "DOWNLOAD_RESUME", resumeId: tailorResumeId, format: "docx" })
    btn.disabled = false; btn.textContent = "Download Word"
    if (!r.ok) showStatus(r.error || "Word download failed", "error")
  })

  $("#open-tailor-dashboard")?.addEventListener("click", () => {
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
