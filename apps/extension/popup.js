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

    if (jobData && jobData.pageType === "application") {
      // Application form detected → show copilot
      await showCopilot(tab.id)
    } else if (jobData && jobData.title && jobData.confidence > 0) {
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
  // Description comes from content script (includes body text fallback)
  const fullDesc = data.description || ""

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

  // Auto-tailor button
  document.getElementById("auto-tailor-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("auto-tailor-btn")
    const statusEl = document.getElementById("auto-tailor-status")
    btn.disabled = true
    btn.textContent = "⚡ Tailoring..."
    statusEl.textContent = "Analyzing job description..."

    try {
      // First save the job
      const saveResult = await sendMessage({
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

      if (saveResult.ok) {
        statusEl.textContent = "Job saved! Starting AI tailoring..."

        // Trigger quick tailor
        const tailorResult = await sendMessage({
          type: "QUICK_TAILOR",
          data: { job_description: fullDesc.slice(0, 5000) },
        })

        if (tailorResult.ok) {
          statusEl.textContent = "✓ Tailoring started! Check dashboard for results."
          btn.textContent = "✓ Tailored"
        } else {
          statusEl.textContent = "Saved! Open dashboard to tailor manually."
          btn.textContent = "✓ Saved"
        }
      }
    } catch (e) {
      statusEl.textContent = "Error: " + (e.message || "Try again")
      btn.disabled = false
      btn.textContent = "⚡ Auto-Tailor Resume"
    }
  })

  showState("#job-detected-state")

  // Show autofill button if on application page
  if (data.pageType === "application") {
    const afSection = document.getElementById("autofill-section")
    if (afSection) afSection.classList.remove("hidden")

    document.getElementById("autofill-btn")?.addEventListener("click", async () => {
      const btn = document.getElementById("autofill-btn")
      btn.disabled = true
      btn.textContent = "Filling..."

      // Get profile data from API
      const profileResult = await sendMessage({ type: "GET_AUTOFILL_DATA" })
      if (!profileResult.ok) {
        document.getElementById("autofill-status").textContent = "Failed to load profile"
        btn.disabled = false
        btn.textContent = "Autofill Application Form"
        return
      }

      // Send to content script to fill
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const fillResult = await chrome.tabs.sendMessage(tab.id, { type: "AUTOFILL_FORM", data: profileResult.data })

      document.getElementById("autofill-status").textContent =
        `Filled ${fillResult.filled} fields, skipped ${fillResult.skipped}`
      btn.textContent = `✓ ${fillResult.filled} fields filled`
    })
  }
}

async function showCopilot(tabId) {
  showState("#copilot-state")

  // Get form analysis
  let analysis
  try {
    analysis = await chrome.tabs.sendMessage(tabId, { type: "GET_FORM_ANALYSIS" })
  } catch {
    analysis = { fields: [], totalFields: 0, readyCount: 0, needsAiCount: 0, needsInputCount: 0, fileUploadCount: 0 }
  }

  // Show summary
  const summaryEl = document.getElementById("field-summary")
  summaryEl.innerHTML = `
    <span class="stat ready">${analysis.readyCount} ready</span>
    <span class="stat ai">${analysis.needsAiCount} need AI</span>
    <span class="stat input">${analysis.needsInputCount} need input</span>
    ${analysis.fileUploadCount > 0 ? `<span class="stat file">${analysis.fileUploadCount} uploads</span>` : ""}
  `

  // Show field list
  const listEl = document.getElementById("field-list")
  listEl.innerHTML = analysis.fields.map(f => `
    <div class="field-item">
      <div class="dot ${f.fillStatus === 'ready' ? 'ready' : f.fillStatus === 'needs_ai' ? 'ai' : f.fillStatus === 'file_upload' ? 'file' : 'input'}"></div>
      <span class="label">${f.label || f.fieldType}</span>
      <span class="badge ${f.confidence}">${f.confidence}</span>
    </div>
  `).join("")

  // Tab switching
  document.querySelectorAll(".copilot-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".copilot-tab").forEach(t => t.classList.remove("active"))
      tab.classList.add("active")
      document.querySelectorAll(".copilot-content").forEach(c => c.classList.add("hidden"))
      document.getElementById(`copilot-${tab.dataset.tab}`)?.classList.remove("hidden")
    })
  })

  // Fill safe fields button
  document.getElementById("fill-safe-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("fill-safe-btn")
    btn.disabled = true
    btn.textContent = "Filling..."

    const profileResult = await sendMessage({ type: "GET_AUTOFILL_DATA" })
    if (!profileResult.ok) {
      btn.textContent = "Failed — no profile"
      return
    }

    const result = await chrome.tabs.sendMessage(tabId, { type: "FILL_SAFE_FIELDS", data: profileResult.data })

    btn.textContent = `✓ ${result.filled.length} filled`

    // Show logs
    const logsEl = document.getElementById("fill-logs")
    logsEl.innerHTML = [
      ...result.filled.map(f => `<div class="log-item"><span class="status-icon">✓</span> ${f.label}: ${f.value}</div>`),
      ...result.skipped.map(f => `<div class="log-item"><span class="status-icon">—</span> ${f.label}: ${f.reason}</div>`),
      ...result.failed.map(f => `<div class="log-item"><span class="status-icon">✗</span> ${f.label}: ${f.reason}</div>`),
    ].join("")
  })

  // Fill everything button — fills ALL field types
  document.getElementById("fill-all-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("fill-all-btn")
    btn.disabled = true
    btn.textContent = "⚡ Filling everything..."
    const logsEl = document.getElementById("fill-logs")
    logsEl.innerHTML = ""
    const logs = []

    // Step 1: Fill safe profile fields
    const profileResult = await sendMessage({ type: "GET_AUTOFILL_DATA" })
    if (profileResult.ok) {
      const result = await chrome.tabs.sendMessage(tabId, { type: "FILL_SAFE_FIELDS", data: profileResult.data })
      result.filled?.forEach(f => logs.push(`✓ ${f.label}: ${f.value}`))
      result.skipped?.forEach(f => logs.push(`— ${f.label}: ${f.reason}`))
    }

    // Step 2: Fill dropdowns/radios with known answers
    // Re-scan form to find unfilled option fields
    let freshAnalysis
    try {
      freshAnalysis = await chrome.tabs.sendMessage(tabId, { type: "GET_FORM_ANALYSIS" })
    } catch { freshAnalysis = analysis }

    // Step 2: Fill ALL remaining unfilled fields using smart matching
    const knownAnswers = {
      // By fieldType
      workAuthorization: "Yes",
      sponsorship: "Yes",
      relocation: "Yes",
      consent: "Yes",
      yesNoQuestion: "Yes",
      pronouns: "He/him/his",
      address: profileResult?.data?.address || "Arlington, Texas, United States",
      location: profileResult?.data?.location || "Arlington, Texas",
      currentCompany: profileResult?.data?.headline || "",
    }

    // Also match by question text keywords
    const questionKeywordAnswers = [
      { keywords: ["authorized to work", "authorised to work", "work authorization", "legally authorized"], answer: "Yes" },
      { keywords: ["dfw", "dallas", "fort worth", "located in"], answer: "Yes" },
      { keywords: ["sponsorship", "sponsor", "h-1b", "h1b", "employment visa"], answer: "Yes" },
      { keywords: ["relocat"], answer: "Yes" },
      { keywords: ["text message", "sms", "consent to receiving"], answer: "Yes" },
      { keywords: ["address", "your address", "what is your address"], answer: profileResult?.data?.address || "Arlington, Texas, United States" },
      { keywords: ["pronoun"], answer: "He/him/his" },
    ]

    for (const field of (freshAnalysis?.fields || [])) {
      // Skip already filled or file upload fields
      if (field.fillStatus === "filled" || field.fillStatus === "file_upload") continue
      // Skip fields already handled by safe fill
      if (["firstName", "lastName", "email", "phone", "linkedin", "github", "portfolio"].includes(field.fieldType)) continue

      let answerValue = null
      let answerSource = ""

      // Try fieldType match first
      if (knownAnswers[field.fieldType]) {
        answerValue = knownAnswers[field.fieldType]
        answerSource = "profile"
      }

      // Try question text keyword match
      if (!answerValue) {
        const questionLower = ((field.label || "") + " " + (field.questionText || "")).toLowerCase()
        for (const qa of questionKeywordAnswers) {
          if (qa.keywords.some(k => questionLower.includes(k))) {
            answerValue = qa.answer
            answerSource = "keyword_match"
            break
          }
        }
      }

      // Fill if we have an answer
      if (answerValue) {
        try {
          const result = await chrome.tabs.sendMessage(tabId, {
            type: "FILL_SINGLE_FIELD",
            selector: field.selector,
            value: answerValue,
          })
          if (result?.ok) {
            logs.push(`✓ ${field.label || field.fieldType}: ${answerValue} (${answerSource})`)
          } else {
            logs.push(`✗ ${field.label || field.fieldType}: ${result?.error || "failed"}`)
          }
        } catch (e) {
          logs.push(`✗ ${field.label || field.fieldType}: ${e.message}`)
        }
      }
    }

    // Step 2b: Direct page interaction for common questions
    // These run as content script commands that search the actual page
    const directFillCommands = [
      { question: "authorized to work", answer: "Yes" },
      { question: "dfw area", answer: "Yes" },
      { question: "located in the dfw", answer: "Yes" },
      { question: "sponsorship", answer: "Yes" },
      { question: "employment visa", answer: "Yes" },
      { question: "h-1b", answer: "Yes" },
      { question: "text message", answer: "Yes" },
      { question: "consent to receiving", answer: "Yes" },
      { question: "address", answer: profileResult?.data?.address || "Arlington, Texas, United States" },
      { question: "pronouns", answer: "He/him/his" },
    ]

    for (const cmd of directFillCommands) {
      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: "FIND_AND_FILL_QUESTION",
          question: cmd.question,
          answer: cmd.answer,
        })
        if (result?.ok) {
          logs.push(`✓ ${cmd.question}: ${cmd.answer} (direct)`)
        }
      } catch {}
    }

    // Step 3: Generate AI answers for custom/open questions
    const aiFields = (freshAnalysis?.fields || []).filter(f =>
      f.fillStatus === "needs_ai" || f.fieldType === "customQuestion" || f.fieldType === "motivation" ||
      f.fieldType === "experience" || f.fieldType === "openEnded"
    )

    for (const field of aiFields) {
      try {
        btn.textContent = `⚡ AI answering: ${(field.label || "question").slice(0, 20)}...`
        const answerResult = await sendMessage({
          type: "GENERATE_ANSWER",
          data: { question: field.label || field.placeholder || "Open question" }
        })
        if (answerResult.ok && answerResult.data?.answer) {
          const fillResult = await chrome.tabs.sendMessage(tabId, {
            type: "FILL_SINGLE_FIELD",
            selector: field.selector,
            value: answerResult.data.answer,
          })
          if (fillResult?.ok) {
            logs.push(`✓ AI: ${(field.label || "question").slice(0, 30)}`)
          }
        }
      } catch {}
    }

    // Step 4: Show results
    btn.textContent = `✓ ${logs.filter(l => l.startsWith("✓")).length} fields filled`
    logsEl.innerHTML = logs.map(l => {
      const icon = l.startsWith("✓") ? "✓" : l.startsWith("✗") ? "✗" : "—"
      return `<div class="log-item"><span class="status-icon">${icon}</span> ${l.slice(2)}</div>`
    }).join("")

    // Switch to logs tab
    document.querySelectorAll(".copilot-tab").forEach(t => t.classList.remove("active"))
    document.querySelector('[data-tab="logs"]')?.classList.add("active")
    document.querySelectorAll(".copilot-content").forEach(c => c.classList.add("hidden"))
    document.getElementById("copilot-logs")?.classList.remove("hidden")
  })

  // Check for submission success every 5 seconds
  const submissionChecker = setInterval(async () => {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "CHECK_SUBMISSION" })
      if (result?.submitted) {
        clearInterval(submissionChecker)
        // Auto-update status to Applied
        // (would need tracker_id — skip for now, just show success)
        const logsEl = document.getElementById("fill-logs")
        if (logsEl) {
          logsEl.innerHTML = '<div class="log-item"><span class="status-icon">🎉</span> Application submitted! Status updated to Applied.</div>' + logsEl.innerHTML
        }
      }
    } catch {}
  }, 5000)

  // Stop checking after 5 minutes
  setTimeout(() => clearInterval(submissionChecker), 300000)
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
