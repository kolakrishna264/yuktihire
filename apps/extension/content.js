// YuktiHire Content Script — Universal job extraction + Auth

// ── Auto-auth: on ANY yuktihire.com page, send token to extension ────────
if (document.location.hostname.includes("yuktihire.com")) {
  // Read token from cookie and send to background
  function _sendTokenFromCookie() {
    try {
      var cookie = document.cookie
      var match = cookie.match(/sb-[^=]+-auth-token=base64-([^;]+)/)
      if (match) {
        var decoded = JSON.parse(atob(match[1]))
        if (decoded.access_token) {
          chrome.runtime.sendMessage({
            type: "SET_TOKEN",
            token: decoded.access_token,
            refresh: decoded.refresh_token || "",
            expires: decoded.expires_at || 0,
          })
        }
      }
    } catch (e) {}
  }

  // Send immediately and every 30 seconds (to refresh before expiry)
  _sendTokenFromCookie()
  setInterval(_sendTokenFromCookie, 30000)

  // Also handle the extension-callback page event
  if (document.location.pathname === "/auth/extension-callback") {
    window.addEventListener("yuktihire-auth", function(e) {
      var detail = e.detail
      if (detail && detail.access_token) {
        chrome.runtime.sendMessage({
          type: "SET_TOKEN",
          token: detail.access_token,
          refresh: detail.refresh_token || "",
          expires: detail.expires_at || 0,
        })
      }
    })
  }
}

// ── Persistent Assistant Panel ───────────────────────────────────────────
;(function() {
  if (location.hostname.includes("yuktihire.com")) return
  if (window !== window.top) return // Don't inject in iframes

  setTimeout(function() {
    var bodyText = (document.body?.innerText || "").toLowerCase()
    var url = location.href.toLowerCase()
    var jobSignals = ["job description", "responsibilities", "qualifications", "apply now", "apply for this", "submit application", "about the role", "what you'll do"]
    var isJobPage = jobSignals.filter(function(s) { return bodyText.includes(s) }).length >= 2
    var isCareerPage = url.includes("/jobs") || url.includes("/career") || url.includes("/apply") || url.includes("greenhouse") || url.includes("lever.co") || url.includes("workday") || url.includes("icims") || url.includes("myworkday")
    var hasForms = document.querySelectorAll("form").length > 0 || document.querySelectorAll("input[type='text'], input[type='email'], textarea").length >= 3

    if (isJobPage || isCareerPage || hasForms) injectPanel()
  }, 1500)

  function injectPanel() {
    if (document.getElementById("yh-assistant")) return

    var style = document.createElement("style")
    style.textContent = `
      #yh-assistant { position:fixed; top:80px; right:0; z-index:999998; font-family:system-ui,-apple-system,sans-serif; }
      #yh-assistant * { box-sizing:border-box; margin:0; padding:0; }
      #yh-tab { position:absolute; right:0; top:0; width:36px; height:80px; background:linear-gradient(135deg,#6c63ff,#8b5cf6); color:#fff; border-radius:10px 0 0 10px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:10px; font-weight:700; box-shadow:-2px 2px 12px rgba(108,99,255,0.3); transition:width 0.15s; writing-mode:vertical-rl; text-orientation:mixed; letter-spacing:1px; }
      #yh-tab:hover { width:40px; }
      #yh-dock { position:absolute; right:0; top:0; width:340px; background:#fff; border:1px solid #e5e7eb; border-right:none; border-radius:16px 0 0 16px; box-shadow:-4px 0 30px rgba(0,0,0,0.1); display:none; max-height:calc(100vh - 100px); overflow:hidden; flex-direction:column; }
      .yh-header { padding:10px 14px; background:linear-gradient(135deg,#6c63ff,#8b5cf6); color:#fff; display:flex; align-items:center; justify-content:space-between; }
      .yh-header-title { font-weight:700; font-size:13px; }
      .yh-minimize { cursor:pointer; font-size:16px; opacity:0.8; background:none; border:none; color:#fff; }
      .yh-minimize:hover { opacity:1; }
      .yh-job-ctx { padding:8px 14px; background:#f9fafb; border-bottom:1px solid #f3f4f6; font-size:11px; color:#6b7280; }
      .yh-job-ctx strong { color:#111827; font-size:12px; display:block; margin-bottom:2px; }
      .yh-actions { padding:10px 14px; display:grid; grid-template-columns:1fr 1fr; gap:6px; border-bottom:1px solid #f3f4f6; }
      .yh-btn { padding:8px 6px; border:1.5px solid #e5e7eb; border-radius:8px; background:#fff; cursor:pointer; font-size:10px; font-weight:600; color:#374151; transition:all 0.15s; text-align:center; }
      .yh-btn:hover { border-color:#c4b5fd; background:#faf9ff; }
      .yh-btn:disabled { opacity:0.5; cursor:not-allowed; }
      .yh-btn-primary { background:linear-gradient(135deg,#6c63ff,#8b5cf6); color:#fff; border-color:transparent; }
      .yh-btn-primary:hover { opacity:0.9; }
      .yh-progress { padding:8px 14px; border-bottom:1px solid #f3f4f6; }
      .yh-progress-bar { height:4px; background:#e5e7eb; border-radius:99px; overflow:hidden; margin-top:4px; }
      .yh-progress-fill { height:100%; background:linear-gradient(90deg,#6c63ff,#22c55e); border-radius:99px; transition:width 0.3s; width:0%; }
      .yh-stats { display:flex; gap:8px; font-size:10px; font-weight:600; margin-top:4px; }
      .yh-stat-ok { color:#22c55e; } .yh-stat-warn { color:#f59e0b; } .yh-stat-fail { color:#ef4444; }
      .yh-log-area { flex:1; overflow-y:auto; max-height:300px; padding:6px 14px; }
      .yh-log { padding:3px 0; font-size:10px; color:#6b7280; border-bottom:1px solid #f9fafb; display:flex; gap:4px; align-items:flex-start; }
      .yh-log-icon { flex-shrink:0; font-size:11px; }
      .yh-log-ok .yh-log-icon { color:#22c55e; }
      .yh-log-warn .yh-log-icon { color:#f59e0b; }
      .yh-log-fail .yh-log-icon { color:#ef4444; }
      .yh-status-msg { padding:6px 14px; font-size:10px; font-weight:500; text-align:center; }
      .yh-confidence { font-size:9px; font-weight:600; padding:1px 5px; border-radius:99px; margin-left:4px; }
      .yh-conf-high { background:#ecfdf5; color:#059669; }
      .yh-conf-medium { background:#ede9fe; color:#7c3aed; }
      .yh-conf-low { background:#fef3c7; color:#92400e; }
      .yh-conf-review { background:#fef2f2; color:#dc2626; }
      .yh-submit-bar { padding:10px 14px; background:#f0fdf4; border-top:1px solid #bbf7d0; display:none; text-align:center; }
      .yh-submit-bar p { font-size:11px; font-weight:600; color:#15803d; margin-bottom:6px; }
      .yh-submit-btns { display:flex; gap:6px; justify-content:center; }
      .yh-resume-hint { padding:6px 14px; background:#fffbeb; border-bottom:1px solid #fde68a; font-size:10px; color:#92400e; display:none; }
      .yh-ats-bar { padding:6px 14px; background:#f0f9ff; border-bottom:1px solid #bae6fd; font-size:10px; display:none; }
      .yh-ats-score { font-size:18px; font-weight:800; color:#6c63ff; }
    `
    document.head.appendChild(style)

    var panel = document.createElement("div")
    panel.id = "yh-assistant"
    panel.innerHTML = `
      <div id="yh-tab">Y H</div>
      <div id="yh-dock">
        <div class="yh-header">
          <span class="yh-header-title">YuktiHire Assistant</span>
          <button class="yh-minimize" id="yh-min">&minus;</button>
        </div>
        <div class="yh-job-ctx" id="yh-job-ctx">
          <strong id="yh-job-title">Detecting job...</strong>
          <span id="yh-job-company"></span>
        </div>
        <div class="yh-ats-bar" id="yh-ats-bar">
          ATS Match: <span class="yh-ats-score" id="yh-ats-score">--</span>%
          <button class="yh-btn" id="yh-auto-tailor" style="float:right;padding:3px 8px;font-size:9px">Auto Tailor</button>
        </div>
        <div class="yh-actions">
          <button class="yh-btn" id="yh-save">Save Job</button>
          <button class="yh-btn yh-btn-primary" id="yh-fill">Fill Everything</button>
          <button class="yh-btn" id="yh-tailor">Tailor Resume</button>
          <button class="yh-btn" id="yh-cover">Cover Letter</button>
          <button class="yh-btn" id="yh-download">Download Resume</button>
          <button class="yh-btn" id="yh-dash">Dashboard</button>
        </div>
        <div class="yh-resume-hint" id="yh-resume-hint">Attach your resume to the file input highlighted below</div>
        <div class="yh-progress" id="yh-progress" style="display:none">
          <div class="yh-status-msg" id="yh-status">Scanning form...</div>
          <div class="yh-progress-bar"><div class="yh-progress-fill" id="yh-bar"></div></div>
          <div class="yh-stats" id="yh-stats"></div>
        </div>
        <div class="yh-log-area" id="yh-logs"></div>
        <div class="yh-submit-bar" id="yh-submit-bar">
          <p>All required fields filled</p>
          <div class="yh-submit-btns">
            <button class="yh-btn" id="yh-review">Review Form</button>
            <button class="yh-btn yh-btn-primary" id="yh-submit-click">Submit Application</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(panel)

    // State
    var isOpen = false
    var tab = document.getElementById("yh-tab")
    var dock = document.getElementById("yh-dock")

    // Toggle
    tab.addEventListener("click", function() {
      isOpen = !isOpen
      dock.style.display = isOpen ? "flex" : "none"
      tab.style.display = isOpen ? "none" : "flex"
      if (isOpen) detectJob()
    })
    document.getElementById("yh-min").addEventListener("click", function() {
      isOpen = false
      dock.style.display = "none"
      tab.style.display = "flex"
    })

    // Detect job context
    function detectJob() {
      try {
        if (typeof extractJobData === "function") {
          var data = extractJobData()
          if (data.title) document.getElementById("yh-job-title").textContent = data.title
          if (data.company) document.getElementById("yh-job-company").textContent = data.company
        }
      } catch(e) {}
    }

    // ── Helpers ──
    function addLog(text, type, confidence) {
      var el = document.getElementById("yh-logs")
      var icon = type === "ok" ? "&#10003;" : type === "warn" ? "&#9888;" : type === "fail" ? "&#10007;" : "&#8226;"
      var confBadge = ""
      if (confidence) {
        var cls = "yh-conf-" + confidence
        confBadge = '<span class="yh-confidence ' + cls + '">' + confidence.toUpperCase() + '</span>'
      }
      el.innerHTML += '<div class="yh-log yh-log-' + type + '"><span class="yh-log-icon">' + icon + '</span><span style="flex:1">' + text + '</span>' + confBadge + '</div>'
      el.scrollTop = el.scrollHeight
    }
    function clearLogs() { document.getElementById("yh-logs").innerHTML = "" }
    function setStatus(text) { document.getElementById("yh-status").textContent = text }
    function setBar(pct) { document.getElementById("yh-bar").style.width = pct + "%" }
    function showProgress() { document.getElementById("yh-progress").style.display = "block" }
    function setStats(ok, warn, fail) {
      document.getElementById("yh-stats").innerHTML =
        '<span class="yh-stat-ok">' + ok + ' filled</span>' +
        '<span class="yh-stat-warn">' + warn + ' review</span>' +
        '<span class="yh-stat-fail">' + fail + ' failed</span>'
    }
    function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms) }) }
    function sendMsg(msg) { return new Promise(function(r) { chrome.runtime.sendMessage(msg, function(resp) { r(resp) }) }) }

    // ── Confidence mapping ──
    function getConfidence(source, category) {
      if (source === "profile") return "high"
      if (source === "rules") return "medium"
      if (category === "sensitive") return "review"
      if (source === "ai") return "low"
      return "medium"
    }

    // ── Resume upload detection ──
    function detectResumeInputs() {
      var fileInputs = document.querySelectorAll('input[type="file"]')
      var resumeInputs = []
      for (var i = 0; i < fileInputs.length; i++) {
        var fi = fileInputs[i]
        var container = fi.closest("[class*='field'], [class*='question'], [class*='upload']") || fi.parentElement
        var labelText = container ? (container.textContent || "").toLowerCase() : ""
        if (labelText.includes("resume") || labelText.includes("cv") || fi.accept?.includes("pdf") || fi.accept?.includes("doc")) {
          resumeInputs.push({ element: fi, type: "resume", label: "Resume/CV" })
        } else if (labelText.includes("cover letter")) {
          resumeInputs.push({ element: fi, type: "coverLetter", label: "Cover Letter" })
        }
      }
      return resumeInputs
    }

    function highlightResumeInputs() {
      var inputs = detectResumeInputs()
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i].element
        var container = el.closest("[class*='field'], [class*='upload']") || el.parentElement
        if (container) {
          container.style.outline = "3px solid #f59e0b"
          container.style.outlineOffset = "2px"
          container.style.borderRadius = "8px"
        }
      }
      if (inputs.length > 0) {
        document.getElementById("yh-resume-hint").style.display = "block"
      }
      return inputs
    }

    // ── Submit button detection ──
    function detectSubmitButton() {
      var selectors = [
        'button[type="submit"]', 'input[type="submit"]',
        'button[class*="submit"]', 'button[class*="apply"]',
        'a[class*="submit"]', 'a[class*="apply"]',
      ]
      var btn = null
      for (var s = 0; s < selectors.length; s++) {
        btn = document.querySelector(selectors[s])
        if (btn) return btn
      }
      // Text-based search
      var allBtns = document.querySelectorAll("button, input[type='submit'], a[role='button']")
      var submitWords = ["submit", "apply", "send application", "submit application"]
      for (var b = 0; b < allBtns.length; b++) {
        var text = (allBtns[b].textContent || allBtns[b].value || "").toLowerCase().trim()
        for (var w = 0; w < submitWords.length; w++) {
          if (text.includes(submitWords[w])) return allBtns[b]
        }
      }
      return null
    }

    function checkAllRequiredFilled() {
      if (typeof YuktiEngine === "undefined") return false
      var blocks = YuktiEngine.scan()
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].required && blocks[i].isEmpty) return false
      }
      return true
    }

    function showSubmitBar() {
      if (checkAllRequiredFilled()) {
        document.getElementById("yh-submit-bar").style.display = "block"
      }
    }

    // ── Multi-step form detection (MutationObserver) ──
    var lastFormHash = ""
    function getFormHash() {
      var inputs = document.querySelectorAll("input, select, textarea")
      return inputs.length + ":" + (inputs[0]?.name || "") + ":" + (inputs[inputs.length - 1]?.name || "")
    }

    // Watch for page changes (Next button clicks, multi-step forms)
    var observer = new MutationObserver(function() {
      var newHash = getFormHash()
      if (newHash !== lastFormHash && lastFormHash !== "") {
        // Form structure changed — new fields appeared
        addLog("New form section detected — ready to fill", "warn")
        document.getElementById("yh-fill").disabled = false
        document.getElementById("yh-fill").textContent = "Fill Everything"
      }
      lastFormHash = newHash
    })
    observer.observe(document.body, { childList: true, subtree: true })
    lastFormHash = getFormHash()

    // ── SAVE JOB ──
    document.getElementById("yh-save").addEventListener("click", function() {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
    })

    // ── FILL EVERYTHING (continuous loop with all features) ──
    document.getElementById("yh-fill").addEventListener("click", async function() {
      var btn = document.getElementById("yh-fill")
      btn.disabled = true
      btn.textContent = "Filling..."
      clearLogs()
      showProgress()
      document.getElementById("yh-submit-bar").style.display = "none"

      var totalFilled = 0, totalReview = 0, totalFailed = 0
      var startTime = Date.now()

      // Step 1: Get profile
      setStatus("Loading profile...")
      setBar(5)
      var profile = await sendMsg({ type: "GET_AUTOFILL_DATA" })
      if (!profile || !profile.ok) {
        addLog("Not authenticated — sign in at yuktihire.com first", "fail")
        btn.disabled = false; btn.textContent = "Fill Everything"; return
      }
      var pd = profile.data || {}
      // Safety: require minimum profile data
      if (!pd.firstName && !pd.email) {
        addLog("Profile incomplete — add your name and email at yuktihire.com/dashboard/profile", "fail")
        btn.disabled = false; btn.textContent = "Fill Everything"; return
      }
      addLog("Profile loaded: " + (pd.firstName || "") + " " + (pd.lastName || ""), "ok", "high")

      // Show autofill readiness score
      if (pd.readiness) {
        var r = pd.readiness
        addLog("Autofill readiness: " + r.score + "%", r.score >= 75 ? "ok" : "warn", r.score >= 75 ? "high" : "review")
        if (r.missing && r.missing.length > 0) {
          addLog("Missing: " + r.missing.join(", ") + " — set in Profile", "warn", "review")
        }
      }

      // Show metro area if detected
      if (pd.metroArea) {
        addLog("Metro area: " + pd.metroArea.toUpperCase(), "ok", "medium")
      }

      // Step 2: Detect resume upload fields
      var resumeInputs = highlightResumeInputs()
      if (resumeInputs.length > 0) {
        addLog("Resume upload detected — attach manually", "warn", "review")
        totalReview++
      }

      // Step 3: Continuous fill loop (up to 5 passes)
      var maxPasses = 5
      for (var pass = 1; pass <= maxPasses; pass++) {
        setStatus("Pass " + pass + "/" + maxPasses + " — scanning...")
        setBar(10 + (pass - 1) * 15)

        var result = null
        if (typeof YuktiEngine !== "undefined") {
          result = YuktiEngine.fillAll(profile.data)
        }
        if (!result) { addLog("Engine not loaded", "fail"); break }

        // Log filled with confidence
        var passFilled = 0
        result.filled.forEach(function(f) {
          var conf = getConfidence(f.source, "")
          var statusType = f.verified ? "ok" : "warn"
          addLog(f.label + ": " + f.value, statusType, conf)
          if (f.verified) passFilled++; else totalReview++
        })
        totalFilled += passFilled

        // Log review needed
        result.needsReview.forEach(function(r) {
          addLog(r.label + " — needs review", "warn", "review")
          totalReview++
        })

        // Fill async custom dropdowns
        for (var a = 0; a < result.needsAsync.length; a++) {
          var af = result.needsAsync[a]
          setStatus("Pass " + pass + " — dropdown: " + af.label.slice(0, 20))
          try {
            var asyncEl = document.querySelector(af.selector)
            if (asyncEl) {
              var ar = await YuktiEngine.fillAsync({ element: asyncEl, container: asyncEl.parentElement, inputType: "customSelect" }, af.value)
              if (ar.ok) { addLog(af.label.slice(0, 35) + ": " + (ar.selected || af.value), "ok", "medium"); totalFilled++ }
              else { addLog(af.label.slice(0, 35), "fail"); totalFailed++ }
            }
          } catch(e) { totalFailed++ }
          await sleep(300)
        }

        // AI fill
        for (var ai = 0; ai < result.needsAI.length; ai++) {
          var field = result.needsAI[ai]
          if (!field.label) continue
          setStatus("AI: " + field.label.slice(0, 25) + "...")
          setBar(Math.min(90, 10 + pass * 15 + ai * 3))

          var prompt = field.label
          if (field.options && field.options.length > 0) {
            prompt = 'Pick the BEST option for "' + field.label + '". Options: ' + field.options.join(", ") + '. Reply with ONLY the exact option text.'
          } else if (["motivation", "behavioral", "technical", "openEnded"].indexOf(field.category) !== -1) {
            prompt = 'Answer this job application question professionally (200-400 words if open-ended, 1-2 sentences if short):\n\n"' + field.label + '"'
            if (field.helperText) prompt += '\n\nContext: ' + field.helperText.slice(0, 300)
          }

          try {
            var answer = await sendMsg({ type: "GENERATE_ANSWER", data: { question: prompt } })
            if (answer?.ok && answer.data?.answer) {
              var val = answer.data.answer.trim()
              var el = document.querySelector(field.selector)
              if (el) {
                var fb = { element: el, container: el.parentElement, inputType: field.inputType, options: [], radioGroupName: null }
                var fr = YuktiEngine.fill(fb, val)
                var filled = fr.ok
                if (!filled && fr.reason === "needs_async") {
                  var ar2 = await YuktiEngine.fillAsync(fb, val)
                  filled = ar2.ok
                }
                if (filled) {
                  addLog("AI: " + field.label.slice(0, 30), "ok", "low"); totalFilled++
                  // Save to answer memory for reuse
                  if (typeof YuktiEngine !== "undefined" && field.label.length > 5) {
                    var qHash = YuktiEngine.hash(field.label)
                    sendMsg({ type: "SAVE_ANSWER_MEMORY", data: { question_hash: qHash, question_text: field.label, answer: val } })
                  }
                } else { addLog("AI: " + field.label.slice(0, 30), "fail"); totalFailed++ }
              }
            }
          } catch(e) { totalFailed++ }
          await sleep(200)
        }

        // Check for new fields
        if (pass < maxPasses) {
          await sleep(500)
          var newEmpty = typeof YuktiEngine !== "undefined" ? YuktiEngine.getEmptyBlocks() : []
          // Filter out file inputs from "empty" count
          newEmpty = newEmpty.filter(function(b) { return b.inputType !== "file" })
          if (newEmpty.length === 0) {
            addLog("All fields filled!", "ok", "high")
            break
          }
          addLog(newEmpty.length + " fields remaining — pass " + (pass + 1), "warn")
        }
      }

      // Final
      var endTime = Date.now()
      setBar(100)
      setStatus("Done — " + totalFilled + " filled")
      setStats(totalFilled, totalReview, totalFailed)
      btn.disabled = false
      btn.textContent = "Fill Everything"

      // Track autofill session for analytics
      sendMsg({
        type: "SAVE_AUTOFILL_SESSION",
        data: {
          portal_domain: location.hostname,
          job_title: document.getElementById("yh-job-title")?.textContent || "",
          company: document.getElementById("yh-job-company")?.textContent || "",
          fields_total: totalFilled + totalReview + totalFailed,
          fields_filled: totalFilled,
          fields_review: totalReview,
          fields_failed: totalFailed,
          fields_ai: 0,  // TODO: track separately
          fields_memory: 0,
          readiness_score: pd.readiness?.score || 0,
          duration_ms: endTime - startTime,
        }
      })

      // Check for submit readiness
      showSubmitBar()
    })

    // ── SUBMIT DETECTION ──
    document.getElementById("yh-review").addEventListener("click", function() {
      // Scroll to top of form
      var form = document.querySelector("form")
      if (form) form.scrollIntoView({ behavior: "smooth" })
      document.getElementById("yh-submit-bar").style.display = "none"
    })
    document.getElementById("yh-submit-click").addEventListener("click", function() {
      var submitBtn = detectSubmitButton()
      if (submitBtn) {
        submitBtn.scrollIntoView({ behavior: "smooth", block: "center" })
        submitBtn.style.outline = "3px solid #22c55e"
        submitBtn.style.outlineOffset = "2px"
        addLog("Submit button highlighted — click it to apply", "ok", "high")
      } else {
        addLog("Submit button not found — submit manually", "warn")
      }
      document.getElementById("yh-submit-bar").style.display = "none"
    })

    // ── AUTO TAILOR ──
    document.getElementById("yh-auto-tailor").addEventListener("click", async function() {
      var btn = document.getElementById("yh-auto-tailor")
      btn.disabled = true; btn.textContent = "Tailoring..."

      // Get JD from page
      var jd = (document.body?.innerText || "").slice(0, 15000)
      var result = await sendMsg({ type: "QUICK_TAILOR", data: { job_description: jd } })
      if (result?.ok) {
        addLog("Tailoring started — check dashboard for results", "ok", "medium")
        // Poll for ATS score
        var sessionId = result.data?.sessionId
        if (sessionId) {
          var polls = 0
          var pollInterval = setInterval(async function() {
            polls++
            if (polls > 30) { clearInterval(pollInterval); return }
            var status = await sendMsg({ type: "TAILOR_STATUS", sessionId: sessionId })
            if (status?.ok && status.data?.status === "COMPLETED") {
              clearInterval(pollInterval)
              if (status.data.atsScore) {
                document.getElementById("yh-ats-score").textContent = status.data.atsScore.overall || "--"
              }
              addLog("Tailoring complete! ATS: " + (status.data.atsScore?.overall || "N/A") + "%", "ok", "high")
              btn.disabled = false; btn.textContent = "Auto Tailor"
            }
          }, 2000)
        }
      } else {
        addLog("Tailoring failed — upload a resume first", "fail")
        btn.disabled = false; btn.textContent = "Auto Tailor"
      }
    })

    // ── Tailoring sync: show ATS score on load ──
    setTimeout(async function() {
      try {
        var status = await sendMsg({ type: "CHECK_AUTH" })
        if (status?.ok) {
          document.getElementById("yh-ats-bar").style.display = "block"
        }
      } catch(e) {}
    }, 2000)

    // ── OTHER BUTTONS ──
    document.getElementById("yh-tailor").addEventListener("click", function() {
      window.open("https://yuktihire.com/dashboard/tailor", "_blank")
    })
    document.getElementById("yh-cover").addEventListener("click", function() {
      window.open("https://yuktihire.com/dashboard/tailor", "_blank")
    })
    document.getElementById("yh-download").addEventListener("click", function() {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
    })
    document.getElementById("yh-dash").addEventListener("click", function() {
      window.open("https://yuktihire.com/dashboard/jobs", "_blank")
    })
  }
})()

// ── Universal Job Extraction Engine ──────────────────────────────────────
;(function () {
  "use strict"

  // ── Utility functions ──────────────────────────────────────────────────

  function getText(selector) {
    const el = document.querySelector(selector)
    return el ? el.innerText?.trim().replace(/\s+/g, " ").slice(0, 10000) : ""
  }

  function getAllText(selector) {
    const els = document.querySelectorAll(selector)
    for (const el of els) {
      const t = el.innerText?.trim()
      if (t && t.length > 3) return t.replace(/\s+/g, " ").slice(0, 10000)
    }
    return ""
  }

  function getMeta(name) {
    return (
      document.querySelector(`meta[property="${name}"]`)?.content ||
      document.querySelector(`meta[name="${name}"]`)?.content ||
      ""
    ).trim()
  }

  function getDomain() {
    return document.location.hostname.replace("www.", "")
  }

  // ── Layer 1: JSON-LD / schema.org JobPosting ───────────────────────────

  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        let data = JSON.parse(script.textContent)
        // Handle arrays
        if (Array.isArray(data)) data = data.find(d => d["@type"] === "JobPosting") || data[0]
        // Handle @graph
        if (data["@graph"]) data = data["@graph"].find(d => d["@type"] === "JobPosting") || data

        if (data["@type"] === "JobPosting") {
          const org = data.hiringOrganization || {}
          return {
            title: data.title || "",
            company: typeof org === "string" ? org : org.name || "",
            location: _extractLdLocation(data.jobLocation),
            description: _stripHtml(data.description || "").slice(0, 10000),
            salary: _extractLdSalary(data.baseSalary),
            employmentType: data.employmentType || "",
            datePosted: data.datePosted || "",
            url: data.url || document.location.href,
            source: "json-ld",
            confidence: 95,
          }
        }
      } catch {}
    }
    return null
  }

  function _extractLdLocation(loc) {
    if (!loc) return ""
    if (typeof loc === "string") return loc
    if (Array.isArray(loc)) return loc.map(l => _extractLdLocation(l)).filter(Boolean).join(", ")
    if (loc.address) {
      const a = loc.address
      return [a.streetAddress, a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ")
    }
    return loc.name || ""
  }

  function _extractLdSalary(sal) {
    if (!sal) return ""
    if (typeof sal === "string") return sal
    const val = sal.value
    if (!val) return ""
    if (val.minValue && val.maxValue) return `${val.unitText || ""} ${val.minValue}-${val.maxValue} ${sal.currency || ""}`.trim()
    if (val.value) return `${val.value} ${sal.currency || ""}`.trim()
    return ""
  }

  // ── Layer 2: OpenGraph / Meta tags ─────────────────────────────────────

  function extractFromMeta() {
    const title = getMeta("og:title") || getMeta("twitter:title") || ""
    const description = getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || ""
    const siteName = getMeta("og:site_name") || ""

    if (!title) return null

    // Check if this looks like a job page
    const jobKeywords = ["engineer", "developer", "analyst", "scientist", "manager", "designer", "architect", "lead", "senior", "junior", "intern", "director", "coordinator", "specialist", "consultant"]
    const titleLower = title.toLowerCase()
    const isLikelyJob = jobKeywords.some(k => titleLower.includes(k)) || titleLower.includes(" at ") || titleLower.includes(" - ")

    if (!isLikelyJob && description.length < 100) return null

    // Try to split "Title at Company" or "Title - Company"
    let jobTitle = title
    let company = siteName
    if (title.includes(" at ")) {
      const parts = title.split(" at ")
      jobTitle = parts[0].trim()
      company = parts.slice(1).join(" at ").trim() || company
    } else if (title.includes(" - ")) {
      const parts = title.split(" - ")
      jobTitle = parts[0].trim()
      if (!company) company = parts[parts.length - 1].trim()
    } else if (title.includes(" | ")) {
      const parts = title.split(" | ")
      jobTitle = parts[0].trim()
      if (!company) company = parts[parts.length - 1].trim()
    }

    return {
      title: jobTitle,
      company: company,
      description: description.slice(0, 5000),
      url: getMeta("og:url") || document.location.href,
      source: "meta",
      confidence: 60,
    }
  }

  // ── Layer 3: Platform-specific extractors (optimizations) ──────────────

  const PLATFORM_EXTRACTORS = {
    "linkedin.com": () => ({
      title: getText(".job-details-jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-unified-top-card__job-title, h1.t-24"),
      company: getText(".job-details-jobs-unified-top-card__company-name, .topcard__org-name-link, .jobs-unified-top-card__company-name"),
      location: getText(".job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet, .jobs-unified-top-card__bullet"),
      description: getText(".jobs-description__content, .jobs-box__html-content, .show-more-less-html__markup, #job-details"),
      source: "linkedin",
      confidence: 90,
    }),

    "greenhouse.io": () => ({
      title: getText("#header .app-title, .opening h1, [data-mapped='true'] h1, h1"),
      company: getText(".company-name, #header .company-name") || document.title.split(" at ").pop()?.split(" - ")[0]?.trim() || "",
      description: getText("#content .body, .opening .body, #app_body, .job-post-content, main, [id*='content'], [class*='content']") || getText("body")?.slice(0, 8000) || "",
      source: "greenhouse",
      confidence: 90,
    }),

    "lever.co": () => ({
      title: getText(".posting-headline h2, .section-wrapper h1, h1"),
      company: getText(".posting-headline .company") || document.title.split(" - ").pop()?.trim() || "",
      description: getText(".section-wrapper .content, .posting-page .content, [data-qa='job-description']"),
      source: "lever",
      confidence: 90,
    }),

    "myworkdayjobs.com": () => ({
      title: getText("[data-automation-id='jobPostingHeader'], h2.css-1vd41l, h1"),
      company: document.title.split(" - ").pop()?.trim() || "",
      description: getText("[data-automation-id='jobPostingDescription'], .css-cygeeu"),
      source: "workday",
      confidence: 85,
    }),

    "indeed.com": () => ({
      title: getText(".jobsearch-JobInfoHeader-title, h1.icl-u-xs-mb--xs, [data-testid='jobsearch-JobInfoHeader-title'], h1"),
      company: getText("[data-testid='inlineHeader-companyName'], .icl-u-lg-mr--sm, .jobsearch-InlineCompanyRating-companyHeader"),
      description: getText("#jobDescriptionText, .jobsearch-JobComponent-description, [data-testid='job-description']"),
      source: "indeed",
      confidence: 90,
    }),

    "smartrecruiters.com": () => ({
      title: getText("h1.job-title, h1"),
      company: getText(".company-name") || getMeta("og:site_name"),
      description: getText(".job-description, .job-sections"),
      source: "smartrecruiters",
      confidence: 85,
    }),

    "ashbyhq.com": () => ({
      title: getText("h1"),
      company: getMeta("og:site_name") || document.title.split(" - ").pop()?.trim() || "",
      description: getText("[data-testid='job-description'], .ashby-job-posting-description, main"),
      source: "ashby",
      confidence: 85,
    }),

    "jobs.apple.com": () => ({
      title: getText("#jdTitle, h1"),
      company: "Apple",
      description: getText("#jd-description, #job-description-section, main"),
      source: "apple",
      confidence: 90,
    }),

    "careers.google.com": () => ({
      title: getText("h2.p1N2lc, h1"),
      company: "Google",
      description: getText(".KwJkGe, [itemprop='description'], main"),
      source: "google",
      confidence: 90,
    }),

    "amazon.jobs": () => ({
      title: getText("h1.title, h1"),
      company: "Amazon",
      description: getText(".description, #job-description, main"),
      source: "amazon",
      confidence: 90,
    }),

    "careers.microsoft.com": () => ({
      title: getText("h1"),
      company: "Microsoft",
      description: getText(".job-description, [data-automationid='jobDescription'], main"),
      source: "microsoft",
      confidence: 90,
    }),
  }

  // ── Layer 4: Universal DOM extraction ──────────────────────────────────

  function extractFromDOM() {
    // Try multiple title strategies
    const title =
      getText("h1.job-title, h1.posting-headline, h1.position-title") ||
      getText("h1") ||
      getText("h2.job-title, h2.posting-title") ||
      document.title.split(" - ")[0]?.split(" | ")[0]?.split(" — ")[0]?.trim() ||
      ""

    // Try multiple company strategies
    const company =
      getText(".company-name, .employer-name, .hiring-company, [data-company]") ||
      getMeta("og:site_name") ||
      getText("a[href*='/company/'], a[href*='/employer/']") ||
      _extractCompanyFromTitle(document.title) ||
      getDomain().split(".")[0] ||
      ""

    // Try multiple location strategies
    const location =
      getText(".location, .job-location, [data-testid='location'], .office-location") ||
      getText("[class*='location'], [class*='Location']") ||
      ""

    // Try multiple description strategies — always get SOMETHING
    const description =
      getText(".job-description, .job-details, #job-description, .description-section") ||
      getText("[class*='description'], [class*='Description'], [data-testid*='description']") ||
      getText("main, article, [role='main']") ||
      (document.body?.innerText || "").slice(0, 8000) ||
      ""

    if (!title && !description) return null

    return {
      title: title.slice(0, 200),
      company: company.slice(0, 200),
      location: location.slice(0, 200),
      description: description.slice(0, 10000),
      source: "dom",
      confidence: title ? 50 : 20,
    }
  }

  function _extractCompanyFromTitle(pageTitle) {
    if (!pageTitle) return ""
    // "Role at Company" or "Role - Company" or "Role | Company"
    for (const sep of [" at ", " - ", " | ", " — "]) {
      if (pageTitle.includes(sep)) {
        return pageTitle.split(sep).pop()?.trim() || ""
      }
    }
    return ""
  }

  // ── Layer 5: Semantic heuristic fallback ───────────────────────────────

  function extractFromHeuristics() {
    const bodyText = document.body?.innerText || ""
    const lower = bodyText.toLowerCase()

    // Is this a job page at all?
    const jobSignals = [
      "job description", "responsibilities", "qualifications", "requirements",
      "about the role", "what you'll do", "what we're looking for", "apply now",
      "apply for this", "submit application", "years of experience",
      "full-time", "part-time", "remote", "hybrid", "salary",
    ]
    const signalCount = jobSignals.filter(s => lower.includes(s)).length

    if (signalCount < 2) return null // Not a job page

    // Extract title from first h1/h2 that looks like a role
    const headings = document.querySelectorAll("h1, h2")
    let title = ""
    const roleKeywords = ["engineer", "developer", "analyst", "scientist", "manager", "designer", "architect", "lead", "director", "coordinator", "specialist", "consultant", "intern", "associate"]
    for (const h of headings) {
      const t = h.innerText?.trim() || ""
      if (t.length > 5 && t.length < 150 && roleKeywords.some(k => t.toLowerCase().includes(k))) {
        title = t
        break
      }
    }
    if (!title) title = headings[0]?.innerText?.trim()?.slice(0, 150) || ""

    return {
      title: title,
      company: getMeta("og:site_name") || _extractCompanyFromTitle(document.title) || getDomain().split(".")[0] || "",
      description: bodyText.slice(0, 10000),
      source: "heuristic",
      confidence: 30,
    }
  }

  // ── Page classification ────────────────────────────────────────────────

  function classifyPage() {
    const url = document.location.href.toLowerCase()
    const bodyText = (document.body?.innerText || "").toLowerCase()

    // Application/form page
    const formSignals = ["submit application", "apply for this", "personal information", "upload resume", "cover letter"]
    const forms = document.querySelectorAll("form")
    const hasApplicationForm = forms.length > 0 && formSignals.some(s => bodyText.includes(s))
    if (hasApplicationForm) return "application"

    // Job listing page
    const jobSignals = ["job description", "responsibilities", "qualifications", "about the role", "what you'll do", "requirements", "apply now"]
    const jobCount = jobSignals.filter(s => bodyText.includes(s)).length
    if (jobCount >= 2) return "job"

    // Search results
    if (url.includes("/search") || url.includes("/jobs?") || url.includes("q=")) return "search"

    // Careers page
    if (url.includes("/career") || url.includes("/jobs") || url.includes("/openings")) return "careers"

    return "unknown"
  }

  // ── Main extraction pipeline ───────────────────────────────────────────

  function extractJobData() {
    const domain = getDomain()
    const pageType = classifyPage()
    let result = null
    let extractionMode = "none"

    // Layer 1: JSON-LD (highest quality)
    result = extractFromJsonLd()
    if (result && result.title) {
      extractionMode = "json-ld"
      return _finalize(result, domain, pageType, extractionMode)
    }

    // Layer 2: Platform-specific (if domain matches)
    for (const [key, extractor] of Object.entries(PLATFORM_EXTRACTORS)) {
      if (domain.includes(key)) {
        try {
          result = extractor()
          if (result && result.title) {
            extractionMode = `platform:${key}`
            return _finalize(result, domain, pageType, extractionMode)
          }
        } catch {}
      }
    }

    // Layer 3: Meta/OpenGraph
    result = extractFromMeta()
    if (result && result.title) {
      extractionMode = "meta"
      return _finalize(result, domain, pageType, extractionMode)
    }

    // Layer 4: DOM extraction
    result = extractFromDOM()
    if (result && result.title) {
      extractionMode = "dom"
      return _finalize(result, domain, pageType, extractionMode)
    }

    // Layer 5: Heuristic fallback
    result = extractFromHeuristics()
    if (result && result.title) {
      extractionMode = "heuristic"
      return _finalize(result, domain, pageType, extractionMode)
    }

    // Nothing found — return minimal data for manual save
    return {
      title: "",
      company: getMeta("og:site_name") || getDomain().split(".")[0] || "",
      description: "",
      location: "",
      url: document.location.href,
      pageTitle: document.title,
      source_domain: domain,
      pageType: pageType,
      extractionMode: "none",
      confidence: 0,
      matched_extractor: "none",
    }
  }

  function _finalize(result, domain, pageType, extractionMode) {
    return {
      title: (result.title || "").slice(0, 300),
      company: (result.company || "").slice(0, 200),
      description: (result.description || "").slice(0, 10000),
      location: (result.location || "").slice(0, 200),
      salary: result.salary || "",
      employmentType: result.employmentType || "",
      url: document.location.href,
      pageTitle: document.title,
      source_domain: domain,
      pageType: pageType,
      extractionMode: extractionMode,
      confidence: result.confidence || 50,
      matched_extractor: result.source || extractionMode,
    }
  }

  function _stripHtml(html) {
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    return tmp.textContent?.trim().replace(/\s+/g, " ") || ""
  }

  // ── Form Detection & Autofill Engine ────────────────────────────────────
  // Block-based form analyzer with multi-strategy fill

  // ── Utility: pattern matching helper ──────────────────────────────────

  function matches(text, patterns) {
    return patterns.some(function (p) { return text.includes(p) })
  }

  // ── 1. Form Block Analyzer ────────────────────────────────────────────

  function scanFormBlocks() {
    const blocks = []
    const seen = new Set()

    // Scan all visible interactive elements
    const inputs = document.querySelectorAll("input, textarea, select")
    for (const input of inputs) {
      if (input.type === "hidden" || input.type === "submit" || input.type === "button" || input.type === "reset") continue
      if (input.offsetParent === null && input.type !== "file") continue // skip invisible (allow file inputs that may be hidden behind a button)
      const uid = getUniqueSelector(input)
      if (seen.has(uid)) continue
      seen.add(uid)

      // Skip radio buttons — we handle them as groups below
      if (input.type === "radio") continue

      const block = analyzeBlock(input)
      if (block) blocks.push(block)
    }

    // Scan radio groups separately
    const radioGroups = new Map()
    document.querySelectorAll('input[type="radio"]').forEach(function (radio) {
      if (radio.offsetParent === null) return
      const groupName = radio.name || radio.getAttribute("aria-labelledby") || getUniqueSelector(radio)
      if (!radioGroups.has(groupName)) radioGroups.set(groupName, [])
      radioGroups.get(groupName).push(radio)
    })

    radioGroups.forEach(function (radios, groupName) {
      if (radios.length === 0) return
      const block = analyzeRadioGroup(radios, groupName)
      if (block) blocks.push(block)
    })

    return { blocks: blocks, formCount: document.querySelectorAll("form").length }
  }

  function analyzeBlock(input) {
    // Find the container div — walk up to a reasonable wrapper
    var container = findBlockContainer(input)

    // Extract question text from all available sources
    var questionText = extractQuestionText(input, container)

    // Determine input type
    var inputType = detectInputType(input)

    // Extract options for select elements
    var options = []
    if (inputType === "select" && input.tagName === "SELECT") {
      options = Array.from(input.options).map(function (o) { return o.text.trim() }).filter(function (t) { return t.length > 0 })
    }

    // Check for file input in the container (some forms wrap file inputs)
    var hasFileInput = inputType === "file" || (container && container.querySelector('input[type="file"]') !== null)

    var block = {
      selector: getUniqueSelector(input),
      container: container,
      questionText: questionText,
      inputName: input.name || "",
      inputId: input.id || "",
      placeholder: input.placeholder || "",
      inputType: inputType,
      options: options,
      hasFileInput: hasFileInput,
      required: input.required || input.getAttribute("aria-required") === "true" || (container && container.textContent.includes("*")),
      currentValue: input.value || "",
      isFilled: !!(input.value && input.value.trim().length > 0),
      tagName: input.tagName,
    }

    block.fieldType = classifyBlock(block)
    return block
  }

  function analyzeRadioGroup(radios, groupName) {
    var firstRadio = radios[0]
    var container = findBlockContainer(firstRadio)

    // For radio groups, the question text is usually above or in the container, not on the radio itself
    var questionText = ""
    if (container) {
      // Look for a legend, heading, label, or prominent text
      var legend = container.querySelector("legend, h3, h4, h5, h6, label, [class*='label'], [class*='question'], [class*='title']")
      if (legend) questionText = legend.textContent.trim()
      if (!questionText) {
        // Use the container text minus option text
        var optionTexts = radios.map(function (r) { return (r.closest("label")?.textContent || r.value || "").trim() })
        var fullText = container.textContent.trim()
        optionTexts.forEach(function (t) { fullText = fullText.replace(t, "") })
        questionText = fullText.replace(/\s+/g, " ").trim()
      }
    }
    if (!questionText) questionText = groupName

    // Extract option labels
    var options = radios.map(function (r) {
      var label = r.closest("label")
      return label ? label.textContent.trim() : r.value || ""
    }).filter(Boolean)

    var block = {
      selector: getUniqueSelector(firstRadio),
      container: container,
      questionText: questionText,
      inputName: groupName,
      inputId: firstRadio.id || "",
      placeholder: "",
      inputType: "radio",
      options: options,
      hasFileInput: false,
      required: firstRadio.required || firstRadio.getAttribute("aria-required") === "true",
      currentValue: radios.find(function (r) { return r.checked })?.value || "",
      isFilled: radios.some(function (r) { return r.checked }),
      tagName: "INPUT",
      radioElements: radios,
    }

    block.fieldType = classifyBlock(block)
    return block
  }

  function findBlockContainer(input) {
    // Walk up the DOM looking for a reasonable container
    // Typically a div, fieldset, or li that wraps label + input
    var el = input.parentElement
    var depth = 0
    while (el && depth < 6) {
      var tag = el.tagName
      if (tag === "FORM" || tag === "BODY" || tag === "HTML") break
      // A good container has a label or text and an input
      if ((tag === "DIV" || tag === "FIELDSET" || tag === "LI" || tag === "SECTION" || tag === "ARTICLE") &&
          el.querySelector("input, textarea, select") &&
          el.textContent.trim().length > el.querySelector("input, textarea, select")?.value?.length + 5) {
        return el
      }
      el = el.parentElement
      depth++
    }
    // Fallback: parent element
    return input.parentElement
  }

  function extractQuestionText(input, container) {
    var parts = []

    // 1. Explicit label via for attribute
    if (input.id) {
      var label = document.querySelector('label[for="' + CSS.escape(input.id) + '"]')
      if (label) parts.push(label.textContent.trim())
    }

    // 2. Wrapping label
    var parentLabel = input.closest("label")
    if (parentLabel) {
      var labelText = parentLabel.textContent.trim()
      // Remove the input value from the label text
      if (input.value) labelText = labelText.replace(input.value, "").trim()
      if (labelText) parts.push(labelText)
    }

    // 3. aria-label and aria-labelledby
    var ariaLabel = input.getAttribute("aria-label")
    if (ariaLabel) parts.push(ariaLabel)
    var ariaLabelledby = input.getAttribute("aria-labelledby")
    if (ariaLabelledby) {
      var ids = ariaLabelledby.split(/\s+/)
      ids.forEach(function (id) {
        var el = document.getElementById(id)
        if (el) parts.push(el.textContent.trim())
      })
    }

    // 4. Preceding sibling label or text element
    var prev = input.previousElementSibling
    if (prev) {
      if (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P" || prev.tagName === "DIV") {
        parts.push(prev.textContent.trim())
      }
    }

    // 5. Container heading or label (if container exists)
    if (container) {
      var heading = container.querySelector("h1, h2, h3, h4, h5, h6, legend, [class*='label'], [class*='question'], [class*='title'], [data-testid*='label']")
      if (heading && heading !== parentLabel) {
        parts.push(heading.textContent.trim())
      }
      // Also grab the FULL container text — for Rippling-style forms where
      // question text is in parent divs above the input
      var containerText = container.textContent || ""
      // Only use first 300 chars to avoid grabbing entire page
      var shortText = containerText.replace(/\s+/g, " ").trim().slice(0, 300)
      if (shortText.length > 10 && parts.length === 0) {
        parts.push(shortText)
      }
    }

    // 6. Walk UP the DOM tree to find question text in parent elements
    var parent = input.parentElement
    for (var i = 0; i < 5 && parent; i++) {
      // Look for direct text children or strong/p/span with question text
      var children = parent.children
      for (var j = 0; j < children.length; j++) {
        var child = children[j]
        if (child === input || child.contains(input)) continue
        var childTag = child.tagName
        if (childTag === "P" || childTag === "SPAN" || childTag === "DIV" || childTag === "H3" || childTag === "H4" || childTag === "STRONG") {
          var ct = child.textContent.trim()
          if (ct.length > 5 && ct.length < 300 && ct.includes("?")) {
            // This is likely a question
            parts.push(ct)
          }
        }
      }
      if (parts.length > 0) break
      parent = parent.parentElement
    }

    // 7. Placeholder as last resort
    if (input.placeholder) parts.push(input.placeholder)

    // Deduplicate and join
    var unique = []
    var seenLower = new Set()
    parts.forEach(function (p) {
      var clean = p.replace(/\s+/g, " ").slice(0, 500)
      var lower = clean.toLowerCase()
      if (clean && !seenLower.has(lower)) {
        seenLower.add(lower)
        unique.push(clean)
      }
    })
    return unique.join(" | ")
  }

  function detectInputType(input) {
    var tag = input.tagName
    if (tag === "SELECT") return "select"
    if (tag === "TEXTAREA") return "textarea"
    var type = (input.type || "text").toLowerCase()
    if (type === "checkbox") return "checkbox"
    if (type === "radio") return "radio"
    if (type === "file") return "file"
    if (type === "email") return "email"
    if (type === "tel") return "tel"
    if (type === "number") return "number"
    if (type === "url") return "url"
    if (type === "date") return "date"
    return "text"
  }

  // ── 2. Field Classifier ───────────────────────────────────────────────

  function classifyBlock(block) {
    var text = (block.questionText + " " + block.inputName + " " + block.inputId + " " + block.placeholder).toLowerCase()

    // Identity
    if (matches(text, ["first name", "firstname", "first_name", "fname", "given name", "given_name"])) return "firstName"
    if (matches(text, ["last name", "lastname", "last_name", "lname", "surname", "family name", "family_name"])) return "lastName"
    if (matches(text, ["full name", "your name", "candidate name", "fullname", "applicant name"]) && !text.includes("company")) return "fullName"

    // Contact
    if (matches(text, ["email"]) || block.inputType === "email") return "email"
    if (matches(text, ["phone", "mobile", "tel", "cell", "contact number"]) || block.inputType === "tel") return "phone"

    // Links
    if (text.includes("linkedin")) return "linkedin"
    if (text.includes("github")) return "github"
    if (matches(text, ["portfolio", "website", "personal site", "personal url", "personal website", "home page", "homepage"])) return "portfolio"

    // EEO / Demographics — MUST come EARLY to prevent misclassification
    // "relocation" contains "location", "gender" is near "race" on forms — order matters!
    if (matches(text, ["gender"]) && !text.includes("transgender")) return "gender"
    if (matches(text, ["hispanic", "latino", "latina", "latinx"])) return "ethnicity"
    if (matches(text, ["race", "ethnicity", "ethnic"]) && !text.includes("relocat")) return "ethnicity"
    if (matches(text, ["veteran"])) return "veteran"
    if (matches(text, ["disability", "disabled", "accommodation"])) return "disability"
    if (matches(text, ["pronouns"])) return "pronouns"

    // Authorization — must come before location keywords
    if (matches(text, ["authorized to work", "authorised to work", "legally authorized", "work authorization", "right to work", "eligible to work", "work in the u.s", "work in the us", "legally permitted", "employment eligibility"])) return "workAuthorization"
    if (matches(text, ["sponsorship", "sponsor", "visa", "h-1b", "h1b", "immigration", "require sponsorship", "need sponsorship", "require visa"])) return "sponsorship"
    // Relocation MUST come before "location" — "relocation" contains "location" substring!
    if (matches(text, ["relocat"])) return "relocation"

    // Location — only after relocation is handled
    if (matches(text, ["street address", "address line", "address from which"])) return "address"
    if (matches(text, ["city", "where are you", "located", "based in"])) return "location"
    // "location" keyword ONLY if NOT part of "relocation"
    if (text.includes("location") && !text.includes("relocat")) return "location"
    if (matches(text, ["state", "province", "region"])) return "state"
    if (matches(text, ["zip", "postal", "postcode", "zip code"])) return "zip"
    if (matches(text, ["country"])) return "country"

    // Work
    if (matches(text, ["current company", "current employer", "company name", "employer name"])) return "currentCompany"
    if (matches(text, ["current title", "current role", "job title", "current position"])) return "currentTitle"

    // Compensation
    if (matches(text, ["salary", "compensation", "expected pay", "desired salary", "pay expectation", "salary expectation"])) return "salary"
    if (matches(text, ["start date", "earliest start", "when can you start", "availability", "notice period", "available to start", "date available"])) return "availability"

    // Experience
    if (matches(text, ["years of experience", "how many years", "years experience", "total experience"])) return "yearsExperience"
    if (matches(text, ["education", "highest degree", "degree", "university", "school", "academic"])) return "education"

    // Files
    if (matches(text, ["resume", "cv", "résumé"]) && (block.inputType === "file" || block.hasFileInput)) return "resumeUpload"
    if (matches(text, ["cover letter"]) && (block.inputType === "file" || block.hasFileInput)) return "coverLetterUpload"

    // Consent / checkboxes
    if (matches(text, ["agree", "consent", "acknowledge", "terms", "privacy", "opt in", "opt-in", "sms", "text message", "subscribe", "mailing list", "marketing"])) return "consent"

    // Open-ended
    if (matches(text, ["why do you want", "why are you interested", "why this", "what interests"])) return "motivation"
    if (matches(text, ["tell us about", "describe your", "relevant experience", "briefly describe", "background"])) return "experience"
    if (matches(text, ["anything else", "additional information", "is there anything", "comments"])) return "openEnded"

    // Textarea = custom question
    if (block.inputType === "textarea") return "customQuestion"

    // Select or radio with yes/no options = likely authorization/sponsorship style question
    if ((block.inputType === "select" || block.inputType === "radio") && block.options && block.options.some(function (o) { return o.toLowerCase() === "yes" || o.toLowerCase() === "no" })) return "yesNoQuestion"

    return "unknown"
  }

  // ── 3. Unique Selector Generator ──────────────────────────────────────

  function getUniqueSelector(el) {
    // Strategy 1: ID
    if (el.id) {
      try { if (document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) return "#" + CSS.escape(el.id) } catch (e) {}
    }
    // Strategy 2: name attribute
    if (el.name) {
      var sel = el.tagName.toLowerCase() + '[name="' + el.name + '"]'
      try { if (document.querySelectorAll(sel).length === 1) return sel } catch (e) {}
    }
    // Strategy 3: data-testid or data-automation-id
    var testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id") || el.getAttribute("data-qa")
    if (testId) {
      var sel2 = '[data-testid="' + testId + '"]'
      try { if (document.querySelectorAll(sel2).length === 1) return sel2 } catch (e) {}
    }
    // Strategy 4: aria-label
    var ariaLabel = el.getAttribute("aria-label")
    if (ariaLabel) {
      var sel3 = el.tagName.toLowerCase() + '[aria-label="' + ariaLabel.replace(/"/g, '\\"') + '"]'
      try { if (document.querySelectorAll(sel3).length === 1) return sel3 } catch (e) {}
    }
    // Strategy 5: Build a path with nth-child
    var path = []
    var current = el
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase()
      if (current.id) {
        path.unshift("#" + CSS.escape(current.id))
        break
      }
      var parent = current.parentElement
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === current.tagName })
        if (siblings.length > 1) {
          var idx = siblings.indexOf(current) + 1
          tag += ":nth-of-type(" + idx + ")"
        }
      }
      path.unshift(tag)
      current = current.parentElement
    }
    return path.join(" > ")
  }

  // ── 4. Multi-Strategy Fill Functions ──────────────────────────────────

  function fillField(block, value) {
    try {
      var el = document.querySelector(block.selector)
      if (!el) return { ok: false, method: "none", error: "Element not found" }

      // Strategy A: Text / email / tel / textarea / number / url / date
      if (["text", "email", "tel", "textarea", "number", "url", "date"].indexOf(block.inputType) !== -1) {
        var result = tryTextFill(el, value, block)
        // If text fill worked on a searchable dropdown, try clicking the suggestion
        if (result.ok) {
          tryClickDropdownOption(el, value)
        }
        return result
      }

      // Strategy B: Select dropdown
      if (block.inputType === "select") {
        return trySelectFill(el, value, block)
      }

      // Strategy C: Radio buttons
      if (block.inputType === "radio") {
        return tryRadioFill(block.container, value, block)
      }

      // Strategy D: Checkbox
      if (block.inputType === "checkbox") {
        return tryCheckboxFill(el, value, block)
      }

      // Strategy E: Try as custom component — look for clickable options nearby
      var customResult = tryCustomComponentFill(el, value, block)
      if (customResult.ok) return customResult

      return { ok: false, method: "unsupported", error: "Input type " + block.inputType + " not supported" }
    } catch (e) {
      return { ok: false, method: "exception", error: e.message }
    }
  }

  // ── Custom React/Searchable dropdown handler ──────────────────────────

  function tryClickDropdownOption(inputEl, value) {
    /**
     * After typing in a searchable input, look for a dropdown/listbox
     * that appeared and click the best matching option.
     */
    setTimeout(function() {
      var valueLower = value.toLowerCase()
      // Look for visible dropdown lists near the input
      var selectors = [
        '[role="listbox"] [role="option"]',
        '[role="listbox"] li',
        'ul[class*="dropdown"] li',
        'ul[class*="menu"] li',
        'ul[class*="option"] li',
        'div[class*="dropdown"] div[class*="option"]',
        'div[class*="menu"] div[class*="item"]',
        '[data-testid*="option"]',
      ]

      for (var s = 0; s < selectors.length; s++) {
        var options = document.querySelectorAll(selectors[s])
        for (var i = 0; i < options.length; i++) {
          var optText = (options[i].textContent || "").trim().toLowerCase()
          if (optText.includes(valueLower) || valueLower.includes(optText.split(",")[0])) {
            // Check if this option is visible
            if (options[i].offsetParent !== null) {
              options[i].click()
              highlightField(options[i], "success")
              return true
            }
          }
        }
      }
    }, 500) // Wait 500ms for dropdown to render after typing
  }

  function tryCustomComponentFill(el, value, block) {
    /**
     * Handle custom React components that aren't native inputs.
     * Strategy: find the container, look for clickable options.
     */
    var container = block.container || el.closest("[class*='field'], [class*='form-group'], [class*='question']")
    if (!container) return { ok: false, method: "custom_no_container" }

    var valueLower = String(value).toLowerCase()

    // Look for radio-like clickable options in the container
    var clickables = container.querySelectorAll('[role="radio"], [role="option"], label, [class*="option"], [class*="choice"]')
    for (var i = 0; i < clickables.length; i++) {
      var text = (clickables[i].textContent || "").trim().toLowerCase()
      if (text === valueLower || text.includes(valueLower) ||
          (valueLower === "yes" && text.startsWith("yes")) ||
          (valueLower === "no" && text.startsWith("no"))) {
        clickables[i].click()
        highlightField(clickables[i], "success")
        // Also try clicking any inner input
        var innerInput = clickables[i].querySelector("input")
        if (innerInput) {
          innerInput.click()
          innerInput.checked = true
          innerInput.dispatchEvent(new Event("change", { bubbles: true }))
        }
        return { ok: true, method: "custom_click", selected: text }
      }
    }

    return { ok: false, method: "custom_no_match", error: "No matching option in container" }
  }

  function tryTextFill(el, value, block) {
    var strVal = String(value)

    // Strategy 1: Native value setter (works with React, Angular, Vue)
    var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    var setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    if (setter) {
      setter.call(el, strVal)
    } else {
      el.value = strVal
    }

    el.dispatchEvent(new Event("focus", { bubbles: true }))
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))

    // Verify
    if (el.value === strVal) {
      highlightField(el, "success")
      return { ok: true, method: "native_setter" }
    }

    // Strategy 2: Direct assignment with InputEvent
    el.value = strVal
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: strVal, inputType: "insertText" }))
    el.dispatchEvent(new Event("change", { bubbles: true }))

    if (el.value === strVal) {
      highlightField(el, "success")
      return { ok: true, method: "direct_assign" }
    }

    // Strategy 3: Key-by-key simulation
    el.focus()
    el.value = ""
    for (var i = 0; i < strVal.length; i++) {
      var char = strVal[i]
      el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }))
      el.value += char
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }))
      el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }))
    }
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))

    if (el.value && el.value.includes(strVal.slice(0, Math.min(5, strVal.length)))) {
      highlightField(el, "success")
      return { ok: true, method: "key_simulation" }
    }

    // Strategy 4: execCommand (for contenteditable-like fields)
    try {
      el.focus()
      el.select()
      document.execCommand("insertText", false, strVal)
      if (el.value === strVal) {
        highlightField(el, "success")
        return { ok: true, method: "execCommand" }
      }
    } catch (e) {}

    highlightField(el, "error")
    return { ok: false, method: "all_failed", error: "Value not applied after 4 strategies" }
  }

  function trySelectFill(el, value, block) {
    var valueLower = String(value).toLowerCase().trim()
    var options = Array.from(el.options)

    // Find best matching option — exact match first, then partial
    var match = null

    // Pass 1: exact text or value match
    match = options.find(function (o) {
      var t = o.text.toLowerCase().trim()
      var v = o.value.toLowerCase().trim()
      return t === valueLower || v === valueLower
    })

    // Pass 2: partial match
    if (!match) {
      match = options.find(function (o) {
        var t = o.text.toLowerCase().trim()
        return t.includes(valueLower) || valueLower.includes(t)
      })
    }

    // Pass 3: yes/no normalization
    if (!match) {
      match = options.find(function (o) {
        var t = o.text.toLowerCase().trim()
        var v = o.value.toLowerCase().trim()
        return (valueLower === "yes" && (t === "yes" || v === "yes" || v === "true" || t === "true")) ||
               (valueLower === "no" && (t === "no" || v === "no" || v === "false" || t === "false"))
      })
    }

    // Pass 4: Country code normalization (United States → US, +1, 1, etc.)
    if (!match && (valueLower === "united states" || valueLower === "us" || valueLower === "+1")) {
      match = options.find(function (o) {
        var t = o.text.toLowerCase().trim()
        var v = o.value.toLowerCase().trim()
        return t.includes("united states") || t.includes("+1") ||
               v === "us" || v === "usa" || v === "+1" || v === "1" || t === "us" ||
               t === "us (+1)" || t === "+1 (us)" || t.includes("united states") ||
               (v === "1" && t.includes("us"))
      })
      // If still no match, try to find option with value "US" or "1" (common in Greenhouse)
      if (!match) {
        match = options.find(function(o) {
          var v = o.value.trim()
          return v === "US" || v === "1" || v === "+1" || v === "us"
        })
      }
    }

    if (match) {
      // Use native setter approach for React compatibility
      var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      if (setter) {
        setter.call(el, match.value)
      } else {
        el.value = match.value
      }
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      highlightField(el, "success")
      return { ok: true, method: "select_option", selected: match.text }
    }

    highlightField(el, "error")
    return { ok: false, method: "select_no_match", error: 'No matching option for "' + value + '"', availableOptions: options.map(function (o) { return o.text }).slice(0, 10) }
  }

  function tryRadioFill(container, value, block) {
    var valueLower = String(value).toLowerCase().trim()
    // Find all radio inputs in the container or by name
    var radios = block.radioElements
    if (!radios || radios.length === 0) {
      radios = container
        ? Array.from(container.querySelectorAll('input[type="radio"]'))
        : Array.from(document.querySelectorAll('input[type="radio"][name="' + block.inputName + '"]'))
    }

    for (var i = 0; i < radios.length; i++) {
      var radio = radios[i]
      var labelEl = radio.closest("label")
      var labelText = labelEl ? labelEl.textContent.trim().toLowerCase() : (radio.value || "").toLowerCase()

      if (labelText === valueLower || labelText.includes(valueLower) || radio.value.toLowerCase() === valueLower ||
          (valueLower === "yes" && (labelText === "yes" || radio.value.toLowerCase() === "yes")) ||
          (valueLower === "no" && (labelText === "no" || radio.value.toLowerCase() === "no"))) {
        radio.checked = true
        radio.click()
        radio.dispatchEvent(new Event("change", { bubbles: true }))
        radio.dispatchEvent(new Event("input", { bubbles: true }))
        highlightField(labelEl || radio, "success")
        return { ok: true, method: "radio_click", selected: labelText }
      }
    }

    // Fallback: search ALL radio buttons on the page
    var allRadios = Array.from(document.querySelectorAll('input[type="radio"]'))
    for (var j = 0; j < allRadios.length; j++) {
      var r = allRadios[j]
      var lbl = r.closest("label")
      var lt = lbl ? lbl.textContent.trim().toLowerCase() : (r.value || "").toLowerCase()
      if ((valueLower === "yes" && lt.startsWith("yes")) ||
          (valueLower === "no" && lt.startsWith("no")) ||
          lt === valueLower || lt.includes(valueLower)) {
        // Check if this radio is near the question we're trying to answer
        var questionContainer = r.closest("[class*='question'], [class*='field'], [class*='form-group'], [class*='block']")
        if (questionContainer) {
          var containerText = questionContainer.textContent.toLowerCase()
          var blockQuestion = (block.questionText || "").toLowerCase()
          if (blockQuestion && containerText.includes(blockQuestion.slice(0, 30))) {
            r.checked = true
            r.click()
            r.dispatchEvent(new Event("change", { bubbles: true }))
            highlightField(r.closest("label") || r, "success")
            return { ok: true, method: "radio_global_search", selected: lt }
          }
        }
      }
    }

    // Last resort: try custom component fill on the container
    if (container) {
      return tryCustomComponentFill(container, value, block)
    }

    return { ok: false, method: "radio_no_match", error: 'No matching radio for "' + value + '"' }
  }

  function tryCheckboxFill(el, value, block) {
    var shouldCheck = value === true || value === "true" || value === "yes" || value === "Yes" || value === "1" || value === true
    if (el.checked !== shouldCheck) {
      el.click()
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
    highlightField(el, "success")
    return { ok: true, method: "checkbox_click", checked: el.checked }
  }

  // ── 5. Visual Feedback ────────────────────────────────────────────────

  function highlightField(el, status) {
    if (!el || !el.style) return
    var color = status === "success" ? "#22c55e" : status === "error" ? "#ef4444" : "#eab308"
    el.style.outline = "2px solid " + color
    el.style.outlineOffset = "2px"
    el.style.transition = "outline-color 0.3s ease"
    setTimeout(function () {
      if (el && el.style) {
        el.style.outline = ""
        el.style.outlineOffset = ""
      }
    }, 4000)
  }

  // ── 6. High-Level Functions (called by message listener) ──────────────

  function detectFormFields() {
    // Legacy-compatible wrapper around the block scanner
    var result = scanFormBlocks()
    var fields = result.blocks.map(function (block) {
      return {
        selector: block.selector,
        type: block.inputType,
        fieldType: block.fieldType,
        label: block.questionText,
        name: block.inputName || block.inputId || "",
        value: block.currentValue || "",
        placeholder: block.placeholder || "",
        required: block.required,
        options: block.options || [],
      }
    }).filter(function (f) { return f.fieldType && f.fieldType !== "unknown" })

    return { fields: fields, formCount: result.formCount }
  }

  function getFormAnalysis() {
    var result = scanFormBlocks()

    var analysis = result.blocks.map(function (block) {
      var fillStatus = "needs_input"
      var confidence = "low"

      // Fields we can always fill from profile
      var autoFillable = ["firstName", "lastName", "fullName", "email", "phone", "linkedin", "github", "portfolio", "location", "address", "currentCompany", "currentTitle"]
      if (autoFillable.indexOf(block.fieldType) !== -1) {
        fillStatus = "ready"
        confidence = "high"
      }

      // Fields that can be filled with known preferences
      var prefillable = ["workAuthorization", "sponsorship", "relocation", "salary", "availability", "yearsExperience", "education", "country", "state", "zip"]
      if (prefillable.indexOf(block.fieldType) !== -1) {
        fillStatus = "ready"
        confidence = "medium"
      }

      // Yes/No questions need user input or preferences
      if (block.fieldType === "yesNoQuestion") {
        fillStatus = "needs_input"
        confidence = "medium"
      }

      // Fields that need AI
      var aiFields = ["customQuestion", "motivation", "experience", "openEnded"]
      if (aiFields.indexOf(block.fieldType) !== -1) {
        fillStatus = "needs_ai"
        confidence = "medium"
      }

      // File uploads
      if (block.fieldType === "resumeUpload" || block.fieldType === "coverLetterUpload" || block.inputType === "file") {
        fillStatus = "file_upload"
        confidence = "medium"
      }

      // Consent checkboxes
      if (block.fieldType === "consent") {
        fillStatus = "needs_input"
        confidence = "low"
      }

      // EEO / demographic fields — skip by default
      var eeoFields = ["gender", "ethnicity", "veteran", "disability"]
      if (eeoFields.indexOf(block.fieldType) !== -1) {
        fillStatus = "eeo_optional"
        confidence = "low"
      }

      return {
        selector: block.selector,
        type: block.inputType,
        fieldType: block.fieldType,
        label: block.questionText,
        name: block.inputName || block.inputId || "",
        value: block.currentValue || "",
        placeholder: block.placeholder || "",
        required: block.required,
        options: block.options || [],
        fillStatus: fillStatus,
        confidence: confidence,
        filled: block.isFilled,
      }
    })

    // Filter out truly unknown fields with no question text
    analysis = analysis.filter(function (a) { return a.fieldType !== "unknown" || a.label.length > 0 })

    // Detect form steps
    var hasNextButton = !!document.querySelector("button[type='submit'], [data-testid*='next'], .btn-next, input[type='submit'], button[class*='next'], a[class*='next']")
    var hasSubmitButton = !!document.querySelector("input[value*='Submit'], input[value*='Apply'], button[type='submit']:last-of-type")
    var stepIndicators = document.querySelectorAll("[class*='step'], [class*='progress'], [aria-label*='step'], [class*='wizard'], [data-testid*='step']")

    return {
      fields: analysis,
      formCount: result.formCount,
      totalFields: analysis.length,
      readyCount: analysis.filter(function (f) { return f.fillStatus === "ready" }).length,
      needsAiCount: analysis.filter(function (f) { return f.fillStatus === "needs_ai" }).length,
      needsInputCount: analysis.filter(function (f) { return f.fillStatus === "needs_input" }).length,
      fileUploadCount: analysis.filter(function (f) { return f.fillStatus === "file_upload" }).length,
      eeoCount: analysis.filter(function (f) { return f.fillStatus === "eeo_optional" }).length,
      hasNextButton: hasNextButton,
      hasSubmitButton: hasSubmitButton,
      currentStep: stepIndicators.length > 0 ? "multi-step" : "single",
      pageType: classifyPage(),
    }
  }

  function fillSafeFields(profileData) {
    var results = { filled: [], failed: [], skipped: [] }
    var scanResult = scanFormBlocks()

    // ONLY safe text fields from profile — NO yes/no/option values here
    // Option-based fields (authorization, sponsorship) are handled by FIND_AND_FILL_QUESTION
    var safeMap = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      fullName: profileData.fullName || ((profileData.firstName || "") + " " + (profileData.lastName || "")).trim(),
      email: profileData.email,
      phone: profileData.phone,
      linkedin: profileData.linkedin,
      github: profileData.github,
      portfolio: profileData.portfolio,
      location: profileData.location || profileData.city,
      address: profileData.address || profileData.location,
      currentCompany: profileData.currentCompany || profileData.company || profileData.headline,
    }
    // DO NOT include: workAuthorization, sponsorship, relocation, consent, pronouns
    // Those are option-based and handled separately to avoid filling "Yes" into text fields

    for (var i = 0; i < scanResult.blocks.length; i++) {
      var block = scanResult.blocks[i]
      var value = safeMap[block.fieldType]

      // Skip unknown, consent, EEO, file uploads, AI-needed fields
      if (!value || block.fieldType === "unknown" || block.fieldType === "consent" ||
          block.fieldType === "resumeUpload" || block.fieldType === "coverLetterUpload" ||
          block.fieldType === "customQuestion" || block.fieldType === "motivation" ||
          block.fieldType === "experience" || block.fieldType === "openEnded" ||
          block.fieldType === "gender" || block.fieldType === "ethnicity" ||
          block.fieldType === "veteran" || block.fieldType === "disability") {
        if (!value) {
          results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "no value in profile" })
        } else {
          results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "field type requires manual input" })
        }
        continue
      }

      // Skip already filled fields
      if (block.isFilled && block.currentValue.trim().length > 0) {
        results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "already filled" })
        continue
      }

      // SAFETY NET: Even if classifier said this is a location/address field,
      // double-check the question text for EEO, sponsorship, relocation keywords
      var qText = (block.questionText || "").toLowerCase()
      var isEEOByText = ["hispanic", "latino", "latina", "ethnicity", "race", "gender", "veteran", "disability", "disabled", "sex", "pronouns", "accommodation", "eeo", "self-identification"].some(function(w) { return qText.includes(w) })
      if (isEEOByText) {
        results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "EEO field detected — skipping safe fill" })
        continue
      }
      // Also skip if question text mentions sponsorship, relocation, authorization (these need Yes/No, not text)
      var isOptionByText = ["sponsorship", "sponsor", "visa", "relocat", "authorized to work", "work authorization", "employment eligibility"].some(function(w) { return qText.includes(w) })
      if (isOptionByText && (block.fieldType === "location" || block.fieldType === "address")) {
        results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "Option question misclassified as location — skipping" })
        continue
      }

      // Guard: location/address values should ONLY go into text inputs, never selects or radios
      if ((block.fieldType === "location" || block.fieldType === "address") &&
          (block.inputType === "select" || block.inputType === "radio")) {
        results.skipped.push({ label: block.questionText, type: block.fieldType, reason: "address value cannot fill select/radio" })
        continue
      }

      var fillResult = fillField(block, value)
      if (fillResult.ok) {
        results.filled.push({ label: block.questionText, type: block.fieldType, value: String(value).slice(0, 30), method: fillResult.method })
      } else {
        results.failed.push({ label: block.questionText, type: block.fieldType, reason: fillResult.error, method: fillResult.method })
      }
    }

    return results
  }

  function fillSingleField(selector, value) {
    try {
      var el = document.querySelector(selector)
      if (!el) return { ok: false, error: "Element not found" }

      // Build a minimal block for the fill function
      var block = analyzeBlock(el) || {
        selector: selector,
        inputType: detectInputType(el),
        container: el.parentElement,
        inputName: el.name || "",
        inputId: el.id || "",
        questionText: "",
        placeholder: el.placeholder || "",
      }
      block.selector = selector

      // Try standard fill first
      var result = fillField(block, value)
      if (result.ok) return result

      // If standard fill failed, only try custom component fill within the IMMEDIATE container
      // DO NOT scan entire page — that causes cross-contamination between fields
      var valueLower = String(value).toLowerCase()
      if (valueLower === "yes" || valueLower === "no") {
        var searchContainer = el.closest("[class*='question'], [class*='field'], [class*='block'], [class*='group']")
        if (searchContainer && !filledElements.has(searchContainer)) {
          var clickResult = tryCustomComponentFill(searchContainer, value, block)
          if (clickResult.ok) return clickResult
        }
      }

      return result // Return original failure
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  function autofillForm(profileData) {
    var results = { filled: 0, failed: 0, skipped: 0, details: [] }
    var scanResult = scanFormBlocks()

    // Comprehensive value map — profile fields + options + AI answers
    var fieldMap = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      fullName: profileData.fullName || ((profileData.firstName || "") + " " + (profileData.lastName || "")).trim(),
      email: profileData.email,
      phone: profileData.phone,
      linkedin: profileData.linkedin,
      github: profileData.github,
      portfolio: profileData.portfolio,
      location: profileData.location || profileData.city,
      address: profileData.address || profileData.location,
      state: profileData.state,
      zip: profileData.zip || profileData.zipCode || profileData.postalCode,
      country: profileData.country,
      currentCompany: profileData.currentCompany || profileData.company || profileData.headline,
      currentTitle: profileData.currentTitle || profileData.title || profileData.jobTitle,
      workAuthorization: profileData.workAuthorization || profileData.authorized,
      sponsorship: profileData.sponsorship,
      relocation: profileData.relocation,
      salary: profileData.salary || profileData.desiredSalary,
      availability: profileData.availability || profileData.startDate,
      yearsExperience: profileData.yearsExperience || profileData.experience,
      education: profileData.education || profileData.degree,
      pronouns: profileData.pronouns,
    }

    // Also accept per-field overrides from AI answers passed in profileData.fieldAnswers
    var fieldAnswers = profileData.fieldAnswers || {}

    for (var i = 0; i < scanResult.blocks.length; i++) {
      var block = scanResult.blocks[i]

      // Check for a direct answer keyed by selector or field type
      var value = fieldAnswers[block.selector] || fieldAnswers[block.fieldType] || fieldMap[block.fieldType]

      // Skip file uploads
      if (block.inputType === "file" || block.fieldType === "resumeUpload" || block.fieldType === "coverLetterUpload") {
        results.skipped++
        results.details.push({ field: block.questionText, fieldType: block.fieldType, status: "skipped", reason: "file upload — handle separately" })
        continue
      }

      if (!value) {
        results.skipped++
        results.details.push({ field: block.questionText, fieldType: block.fieldType, status: "skipped", reason: "no value available" })
        continue
      }

      // Skip already filled unless we have an explicit override
      if (block.isFilled && block.currentValue.trim().length > 0 && !fieldAnswers[block.selector]) {
        results.skipped++
        results.details.push({ field: block.questionText, fieldType: block.fieldType, status: "skipped", reason: "already filled" })
        continue
      }

      var fillResult = fillField(block, value)
      if (fillResult.ok) {
        results.filled++
        results.details.push({ field: block.questionText, fieldType: block.fieldType, status: "filled", value: String(value).slice(0, 50), method: fillResult.method })
      } else {
        results.failed++
        results.details.push({ field: block.questionText, fieldType: block.fieldType, status: "failed", reason: fillResult.error, method: fillResult.method, availableOptions: fillResult.availableOptions })
      }
    }

    return results
  }

  function detectSubmissionSuccess() {
    var bodyText = (document.body?.innerText || "").toLowerCase()
    var successSignals = [
      "application submitted",
      "thank you for applying",
      "application received",
      "successfully submitted",
      "your application has been",
      "we received your application",
      "application complete",
      "thank you for your interest",
      "thanks for applying",
      "your submission has been received",
      "you have successfully applied",
      "application confirmation",
    ]
    return successSignals.some(function (s) { return bodyText.includes(s) })
  }

  // ── Message Listener ──────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === "EXTRACT_JOB") {
      var data = extractJobData()
      if (!data.description || data.description.length < 50) {
        data.description = (document.body?.innerText || "").slice(0, 10000)
      }
      sendResponse(data)
    }
    if (msg.type === "DETECT_FORM") {
      sendResponse(detectFormFields())
    }
    if (msg.type === "AUTOFILL_FORM") {
      sendResponse(autofillForm(msg.data))
    }
    if (msg.type === "GET_FORM_ANALYSIS") {
      sendResponse(getFormAnalysis())
    }
    if (msg.type === "FILL_SAFE_FIELDS") {
      if (typeof filledElements !== "undefined") filledElements.clear()
      sendResponse(fillSafeFields(msg.data))
    }
    if (msg.type === "FILL_SINGLE_FIELD") {
      sendResponse(fillSingleField(msg.selector, msg.value))
    }
    if (msg.type === "CHECK_SUBMISSION") {
      sendResponse({ submitted: detectSubmissionSuccess() })
    }

    // ── NEW ENGINE MESSAGES ──

    if (msg.type === "ENGINE_FILL_ALL") {
      // Phase 1: Scan + classify + fill deterministic/rule-based fields
      var inputCount = document.querySelectorAll('input, select, textarea').length
      if (inputCount < 2) return false
      if (typeof YuktiEngine === "undefined") { sendResponse({ filled: [], needsAI: [], needsAsync: [], total: 0 }); return }
      var result = YuktiEngine.fillAll(msg.data)
      sendResponse(result)
    }

    if (msg.type === "ENGINE_FILL_ASYNC") {
      // Phase 2: Fill a custom dropdown asynchronously
      if (typeof YuktiEngine === "undefined") { sendResponse({ ok: false }); return }
      var el = document.querySelector(msg.selector)
      if (!el) { sendResponse({ ok: false, reason: "element not found" }); return }
      var asyncBlock = { element: el, container: el.parentElement, inputType: "customSelect" }
      YuktiEngine.fillAsync(asyncBlock, msg.value).then(function(r) { sendResponse(r) })
      return true
    }

    if (msg.type === "ENGINE_FILL_BY_SELECTOR") {
      // Phase 3: Fill a specific field by selector (for AI answers)
      var target = document.querySelector(msg.selector)
      if (!target) { sendResponse({ ok: false }); return }
      var blockType = target.tagName === "SELECT" ? "nativeSelect" : target.tagName === "TEXTAREA" ? "longText" : "shortText"
      var fakeBlock = { element: target, container: target.parentElement, inputType: blockType, options: [], radioGroupName: null }
      if (typeof YuktiEngine !== "undefined") {
        var fr = YuktiEngine.fill(fakeBlock, msg.value)
        sendResponse(fr)
      } else {
        // Fallback
        try {
          target.value = msg.value
          target.dispatchEvent(new Event("input", { bubbles: true }))
          target.dispatchEvent(new Event("change", { bubbles: true }))
          sendResponse({ ok: true })
        } catch(e) { sendResponse({ ok: false }) }
      }
    }

    if (msg.type === "ENGINE_GET_EMPTY") {
      if (typeof YuktiEngine === "undefined") { sendResponse([]); return }
      var inputCount2 = document.querySelectorAll('input, select, textarea').length
      if (inputCount2 < 2) return false
      sendResponse(YuktiEngine.getEmptyBlocks())
    }

    // Legacy handlers — DISABLED to prevent contamination
    // All filling now goes through ENGINE_FILL_ALL / ENGINE_FILL_ASYNC / ENGINE_FILL_BY_SELECTOR
    if (msg.type === "FIND_AND_FILL_QUESTION" || msg.type === "UNIVERSAL_FILL") {
      sendResponse({ ok: false, reason: "deprecated — use ENGINE_FILL_ALL" })
      return false
    }
    return false
  })

  /**
   * Search the entire page for a question matching the given text,
   * then find the nearest form control and fill it with the answer.
   * This handles custom React forms where the scanner can't link questions to inputs.
   */
  // Track which DOM elements have been filled to prevent cross-contamination
  var filledElements = new Set()

  // EEO/demographic keywords — these fields must ONLY be filled by their exact question matcher
  var EEO_KEYWORDS = ["hispanic", "latino", "latina", "latinx", "ethnicity", "race", "gender", "sex",
    "veteran", "disability", "disabled", "accommodation", "pronouns", "sexual orientation",
    "protected class", "equal opportunity", "eeo", "voluntary self-identification"]

  // Protected question keywords — these should only be filled by their exact question, not by address/location
  var PROTECTED_QUESTION_KEYWORDS = EEO_KEYWORDS.concat([
    "sponsorship", "sponsor", "visa", "employment visa", "relocat", "authorized to work",
    "work authorization", "eligible to work", "in-person", "on-site", "ai policy"
  ])

  function isProtectedContext(element) {
    // Check if an element or its parent container (up 3 levels) contains protected keywords
    var node = element
    for (var up = 0; up < 4; up++) {
      if (!node) break
      var t = (node.textContent || "").toLowerCase()
      if (t.length < 500) {
        for (var k = 0; k < PROTECTED_QUESTION_KEYWORDS.length; k++) {
          if (t.includes(PROTECTED_QUESTION_KEYWORDS[k])) return true
        }
      }
      node = node.parentElement
    }
    return false
  }

  // Narrower check — only EEO keywords
  function isEEOContext(element) {
    var node = element
    for (var up = 0; up < 4; up++) {
      if (!node) break
      var t = (node.textContent || "").toLowerCase()
      if (t.length < 500) {
        for (var k = 0; k < EEO_KEYWORDS.length; k++) {
          if (t.includes(EEO_KEYWORDS[k])) return true
        }
      }
      node = node.parentElement
    }
    return false
  }

  function getSelectLabel(el) {
    var label = ""
    // Method 1: aria-label
    label = (el.getAttribute("aria-label") || "").toLowerCase()
    // Method 2: associated <label for="id">
    if (!label && el.id) {
      var assocLabel = document.querySelector("label[for='" + el.id + "']")
      if (assocLabel) label = (assocLabel.textContent || "").toLowerCase().trim()
    }
    // Method 3: parent <label>
    if (!label) {
      var parentLabel = el.closest("label")
      if (parentLabel) label = (parentLabel.textContent || "").toLowerCase().trim()
    }
    // Method 4: previous sibling text
    if (!label) {
      var prev = el.previousElementSibling
      while (prev && !label) {
        var pt = (prev.textContent || "").toLowerCase().trim()
        if (pt.length > 0 && pt.length < 100) { label = pt; break }
        prev = prev.previousElementSibling
      }
    }
    // Method 5: parent's first label/heading
    if (!label && el.parentElement) {
      var labels = el.parentElement.querySelectorAll("label, legend, span, p, h3, h4, h5, h6, strong")
      for (var li = 0; li < labels.length; li++) {
        var lt = (labels[li].textContent || "").toLowerCase().trim()
        if (lt.length > 0 && lt.length < 80 && !lt.includes("select")) { label = lt; break }
      }
    }
    // Method 6: Walk up to grandparent for label
    if (!label && el.parentElement && el.parentElement.parentElement) {
      var gp = el.parentElement.parentElement
      var gpLabels = gp.querySelectorAll("label, legend, h3, h4, strong")
      for (var gi = 0; gi < gpLabels.length; gi++) {
        var gt = (gpLabels[gi].textContent || "").toLowerCase().trim()
        if (gt.length > 0 && gt.length < 80) { label = gt; break }
      }
    }
    // Method 7: name/id
    if (!label) label = ((el.name || "") + " " + (el.id || "")).toLowerCase()
    return label
  }

  function findAndFillQuestion(questionKeyword, answer) {
    var keyword = questionKeyword.toLowerCase()
    var answerLower = answer.toLowerCase()

    // Determine if THIS question is an EEO question (so it's ALLOWED to fill EEO fields)
    var isEEOQuestion = EEO_KEYWORDS.some(function(k) { return keyword.includes(k) })

    // Determine if the answer is a long text (address, freeform) vs a short option (Yes/No/select value)
    // Long text answers should ONLY go into text inputs/textareas, NEVER selects/radios
    var isLongTextAnswer = answerLower.length > 10 && (answer.includes(",") || answer.includes(" ") && answerLower !== "i am not a protected veteran" && answerLower !== "i do not want to answer")

    // ── STRATEGY 0: Direct select/radio scan for EEO and option-based questions ──
    // For EEO questions and yes/no questions, directly scan ALL selects and radios on the page
    // and match by label/aria-label/nearby text. This bypasses the generic element search entirely.
    if (isEEOQuestion || answerLower === "yes" || answerLower === "no" || answerLower === "male" || answerLower === "female") {
      // Scan ALL selects (native + hidden) on the page
      var allSelects = document.querySelectorAll("select")
      for (var si = 0; si < allSelects.length; si++) {
        var sel = allSelects[si]
        if (filledElements.has(sel)) continue

        // Get this select's label via multiple methods
        var selLabel = getSelectLabel(sel)

        if (selLabel.includes(keyword)) {
          // For EEO keywords, verify this select is in the EEO section
          if (isEEOQuestion) {
            var inEEO = false
            var checkNode = sel
            for (var chk = 0; chk < 15; chk++) {
              if (!checkNode) break
              var chkText = (checkNode.textContent || "").toLowerCase()
              if (chkText.includes("self-identification") || chkText.includes("equal employment") ||
                  chkText.includes("eeo") || chkText.includes("government reporting") || chkText.includes("voluntary")) {
                inEEO = true; break
              }
              checkNode = checkNode.parentElement
            }
            if (!inEEO) continue  // Skip — this select is NOT in the EEO section
          }

          var fillResult = trySelectFill(sel, answer, { selector: "", inputType: "select" })
          if (fillResult.ok) {
            filledElements.add(sel)
            if (sel.parentElement) filledElements.add(sel.parentElement)
            return fillResult
          }
        }
      }

      // Also scan for Greenhouse-style custom selects (div-based dropdowns)
      // These are typically: <label>Question</label> + <div class="select">Select...</div>
      var customSelectors = [
        '[data-testid*="select"]', '[class*="select-trigger"]', '[class*="SelectTrigger"]',
        '[role="combobox"]', '[role="listbox"]', '[aria-haspopup="listbox"]',
        '[class*="chosen-container"]', '[class*="react-select"]', '[class*="css-"][class*="control"]'
      ]
      for (var cs = 0; cs < customSelectors.length; cs++) {
        var customEls = document.querySelectorAll(customSelectors[cs])
        for (var ce = 0; ce < customEls.length; ce++) {
          var customEl = customEls[ce]
          if (filledElements.has(customEl)) continue
          var customLabel = getSelectLabel(customEl)
          if (customLabel.includes(keyword)) {
            // Try clicking to open, then selecting the option
            customEl.click()
            // Wait for dropdown to appear
            var clickResult = { ok: false }
            setTimeout(function() {}, 100)  // Yield
            // Look for options in the dropdown
            var optionSels = '[role="option"], [class*="option"], [class*="menu"] [class*="item"], li[data-value]'
            var dropOptions = document.querySelectorAll(optionSels)
            for (var do2 = 0; do2 < dropOptions.length; do2++) {
              var optText = (dropOptions[do2].textContent || "").trim().toLowerCase()
              if (optText === answerLower || optText.includes(answerLower) || answerLower.includes(optText)) {
                dropOptions[do2].click()
                highlightField(customEl, "success")
                filledElements.add(customEl)
                if (customEl.parentElement) filledElements.add(customEl.parentElement)
                clickResult = { ok: true, method: "custom_select_direct", selected: optText, question: keyword }
                break
              }
            }
            if (clickResult.ok) return clickResult
            // If clicking didn't open a dropdown, try the hidden native select inside
            var hiddenSelect = customEl.parentElement && customEl.parentElement.querySelector("select")
            if (!hiddenSelect) hiddenSelect = customEl.querySelector("select")
            if (hiddenSelect) {
              var hResult = trySelectFill(hiddenSelect, answer, { selector: "", inputType: "select" })
              if (hResult.ok) {
                filledElements.add(hiddenSelect)
                filledElements.add(customEl)
                return hResult
              }
            }
          }
        }
      }

      // Also try radio button groups
      var allRadioGroups = {}
      var allRadios = document.querySelectorAll('input[type="radio"]')
      for (var ri = 0; ri < allRadios.length; ri++) {
        var rName = allRadios[ri].name || ("radio_" + ri)
        if (!allRadioGroups[rName]) allRadioGroups[rName] = []
        allRadioGroups[rName].push(allRadios[ri])
      }
      for (var groupName in allRadioGroups) {
        var groupRadios = allRadioGroups[groupName]
        if (groupRadios.some(function(r) { return filledElements.has(r) })) continue

        // Find the group's label text
        var groupContainer = groupRadios[0].closest("[class*='field'], [class*='question'], fieldset, [role='radiogroup']") || groupRadios[0].parentElement?.parentElement
        var groupLabel = ""
        if (groupContainer) {
          var headings = groupContainer.querySelectorAll("label, legend, h3, h4, span, p, strong")
          for (var hi = 0; hi < headings.length; hi++) {
            var ht = (headings[hi].textContent || "").toLowerCase().trim()
            if (ht.length > 0 && ht.length < 100 && !ht.includes(answerLower)) { groupLabel = ht; break }
          }
        }

        if (groupLabel.includes(keyword)) {
          for (var gi = 0; gi < groupRadios.length; gi++) {
            var radio = groupRadios[gi]
            var rLabel = radio.closest("label")
            var rText = (rLabel ? rLabel.textContent : radio.value || "").trim().toLowerCase()
            if ((answerLower === "yes" && rText.startsWith("yes")) ||
                (answerLower === "no" && (rText.startsWith("no") || rText === "no")) ||
                rText === answerLower || rText.includes(answerLower)) {
              radio.click()
              radio.checked = true
              radio.dispatchEvent(new Event("change", { bubbles: true }))
              highlightField(rLabel || radio, "success")
              groupRadios.forEach(function(r) { filledElements.add(r) })
              if (groupContainer) filledElements.add(groupContainer)
              return { ok: true, method: "direct_radio_scan", selected: rText, question: keyword }
            }
          }
        }
      }
    }
    // ── END STRATEGY 0 ──

    // Search for question text — prefer small, specific label elements over div containers
    var labelElements = document.querySelectorAll("label, legend, h3, h4, h5, h6, strong")
    var otherElements = document.querySelectorAll("p, span, div")
    // Search labels first (most specific), then other elements
    var allElements = Array.from(labelElements).concat(Array.from(otherElements))

    var bestMatch = null
    var bestScore = 0

    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i]
      // Use only the element's DIRECT text (not nested children for div/span)
      var directText = ""
      if (el.tagName === "DIV" || el.tagName === "SPAN") {
        // For divs/spans, prefer textContent but skip if it's a large container
        directText = (el.textContent || "").toLowerCase().trim()
        if (directText.length > 200) continue
        if (el.children.length > 6) continue
      } else {
        directText = (el.textContent || "").toLowerCase().trim()
      }
      if (!directText.includes(keyword)) continue
      if (directText.length > 300) continue

      // CRITICAL GUARD: If this is NOT an EEO question but the element is in an EEO context, SKIP IT
      if (!isEEOQuestion && isEEOContext(el)) continue

      // GUARD: If the answer is a long text (address), skip elements in protected contexts
      // This prevents "arlington, texas" from being filled into sponsorship/relocation/EEO fields
      if (isLongTextAnswer && isProtectedContext(el)) continue

      // Skip already-filled question blocks
      if (filledElements.has(el)) continue

      // Skip if inside a name/email/phone field area
      var nearbyInput = el.closest("label")?.querySelector("input")
      if (nearbyInput) {
        var inputIdent = (nearbyInput.name + nearbyInput.id + nearbyInput.type + (nearbyInput.placeholder || "")).toLowerCase()
        var protectedPatterns = ["first", "last", "name", "email", "phone", "tel", "fname", "lname", "resume", "cv", "linkedin", "github", "website", "portfolio"]
        if (protectedPatterns.some(function(w) { return inputIdent.includes(w) })) continue
      }

      // Score this match: shorter text = better (more specific), labels score higher
      var score = 1000 - directText.length
      if (el.tagName === "LABEL" || el.tagName === "LEGEND") score += 500
      if (el.tagName === "H3" || el.tagName === "H4" || el.tagName === "STRONG") score += 300
      if (el.tagName === "P") score += 200
      // Exact match bonus — the element text should closely match the keyword
      if (directText === keyword || directText.startsWith(keyword + "?") || directText.startsWith(keyword + " ")) score += 400
      // For EEO questions, STRONGLY prefer elements where the keyword is the MAIN text
      // This prevents "Race & Ethnicity Definitions" from matching "race" when we want the "Race" label
      if (isEEOQuestion) {
        // Penalize if the text is much longer than the keyword (means it's a heading or description)
        if (directText.length > keyword.length * 3) score -= 500
        // Bonus if the element has a nearby select/radio (it's actually a form label)
        var nearSibling = el.nextElementSibling
        if (nearSibling && (nearSibling.tagName === "SELECT" || nearSibling.querySelector && nearSibling.querySelector("select, input[type='radio']"))) {
          score += 600
        }
        var parentSel = el.parentElement && el.parentElement.querySelector("select, input[type='radio']")
        if (parentSel) score += 400
      }
      // Penalize elements with many children (containers)
      score -= el.children.length * 50

      if (score > bestScore) {
        bestScore = score
        bestMatch = el
      }
    }

    if (!bestMatch) return { ok: false, error: "Question not found on page: " + questionKeyword }

    var el = bestMatch

    // Walk up max 3 levels to find the question block container with inputs
    var container = el.parentElement
    for (var up = 0; up < 4; up++) {
      if (!container) break
      var inputs = container.querySelectorAll("select, input[type='radio'], input:not([type='hidden']):not([type='submit']):not([type='file']), textarea")
      if (inputs.length > 0 && inputs.length <= 8) break
      container = container.parentElement
    }
    if (!container) return { ok: false, error: "No input found for: " + questionKeyword }

    // Verify: the container should not already be claimed by a different question
    if (filledElements.has(container)) return { ok: false, error: "Field already filled for: " + questionKeyword }

    // CRITICAL: Double-check protection at the container level
    if (!isEEOQuestion) {
      var containerText = (container.textContent || "").toLowerCase()
      if (containerText.length < 1000) {
        for (var ek = 0; ek < EEO_KEYWORDS.length; ek++) {
          if (containerText.includes(EEO_KEYWORDS[ek])) {
            return { ok: false, error: "Skipped EEO field for: " + questionKeyword }
          }
        }
      }
    }
    // For long text answers (addresses), also check protected keywords at container level
    if (isLongTextAnswer) {
      var ctText = (container.textContent || "").toLowerCase()
      if (ctText.length < 1000) {
        for (var pk = 0; pk < PROTECTED_QUESTION_KEYWORDS.length; pk++) {
          if (ctText.includes(PROTECTED_QUESTION_KEYWORDS[pk])) {
            return { ok: false, error: "Skipped protected field for address: " + questionKeyword }
          }
        }
      }
    }

    // Strategy 1: Native <select> — ONLY for short option answers (Yes/No/select values), NOT for long text like addresses
    if (!isLongTextAnswer) {
      var searchAreas = [container, el.parentElement, el.nextElementSibling, el.parentElement?.nextElementSibling].filter(Boolean)
      for (var sa = 0; sa < searchAreas.length; sa++) {
        var select = searchAreas[sa].querySelector ? searchAreas[sa].querySelector("select") : null
        if (select && !filledElements.has(select)) {
          var result = trySelectFill(select, answer, { selector: "", inputType: "select" })
          if (result.ok) {
            filledElements.add(el)
            filledElements.add(container)
            filledElements.add(select)
            return result
          }
        }
      }
    }

    // Strategy 2: Radio buttons — ONLY for short option answers
    if (!isLongTextAnswer) {
      var radios = container.querySelectorAll('input[type="radio"]')
      if (radios.length === 0 && container.parentElement) {
        radios = container.parentElement.querySelectorAll('input[type="radio"]')
      }
      if (radios.length > 0) {
        for (var r = 0; r < radios.length; r++) {
          var radio = radios[r]
          if (filledElements.has(radio)) continue
          var lbl = radio.closest("label")
          var lblText = (lbl ? lbl.textContent : radio.value || "").trim().toLowerCase()
          if ((answerLower === "yes" && lblText.startsWith("yes")) ||
              (answerLower === "no" && (lblText.startsWith("no") || lblText === "no")) ||
              lblText === answerLower || lblText.includes(answerLower)) {
            radio.click()
            radio.checked = true
            radio.dispatchEvent(new Event("change", { bubbles: true }))
            highlightField(lbl || radio, "success")
            filledElements.add(el)
            filledElements.add(container)
            filledElements.add(radio)
            return { ok: true, method: "find_and_fill_radio", selected: lblText, question: keyword }
          }
        }
      }
    }

    // Strategy 3: Text input — NEVER fill protected identity fields
    var input = container.querySelector("input:not([type='radio']):not([type='checkbox']):not([type='hidden']):not([type='file']):not([type='submit'])")
    if (!input) input = container.querySelector("textarea")
    if (input && !filledElements.has(input)) {
      var inputId = ((input.name || "") + (input.id || "") + (input.placeholder || "") + (input.type || "")).toLowerCase()
      var isProtected = ["first", "last", "name", "email", "phone", "tel", "fname", "lname", "resume", "cv", "linkedin", "github", "website", "portfolio", "url", "city", "state", "zip", "country"].some(function(w) { return inputId.includes(w) })
      var alreadyFilled = input.value && input.value.trim().length > 0

      if (!isProtected && !alreadyFilled) {
        var textResult = tryTextFill(input, answer, { selector: getUniqueSelector(input), inputType: input.type || "text" })
        if (textResult.ok) {
          tryClickDropdownOption(input, answer)
          filledElements.add(el)
          filledElements.add(container)
          filledElements.add(input)
          return { ok: true, method: "find_and_fill_text", question: keyword }
        }
      }
    }

    // Strategy 4: Clickable option divs (custom UI components)
    var clickables = container.querySelectorAll('[role="option"], [role="radio"], [role="listbox"] [role="option"], [class*="option"], [class*="choice"]')
    for (var c = 0; c < clickables.length; c++) {
      if (filledElements.has(clickables[c])) continue
      var ct = (clickables[c].textContent || "").trim().toLowerCase()
      if ((answerLower === "yes" && ct.startsWith("yes")) || (answerLower === "no" && (ct.startsWith("no") || ct === "no")) || ct === answerLower || ct.includes(answerLower)) {
        clickables[c].click()
        highlightField(clickables[c], "success")
        filledElements.add(el)
        filledElements.add(container)
        filledElements.add(clickables[c])
        return { ok: true, method: "find_and_fill_click", selected: ct, question: keyword }
      }
    }

    return { ok: false, error: "Could not fill: " + questionKeyword }
  }

  // ── Async wrapper: handles custom React dropdowns (Greenhouse, Lever, etc.) ──
  function findAndFillQuestionAsync(questionKeyword, answer) {
    return new Promise(function(resolve) {
      // Step 1: Try synchronous fill
      var result = findAndFillQuestion(questionKeyword, answer)
      if (result.ok) { resolve(result); return }

      // Step 2: If sync failed, try async custom dropdown approach
      // Search for the question label on page
      var keyword = questionKeyword.toLowerCase()
      var answerLower = answer.toLowerCase()
      var allLabels = document.querySelectorAll("label, legend, h3, h4, h5, h6, strong, p, span")

      var targetLabel = null
      var bestScore = 0
      for (var i = 0; i < allLabels.length; i++) {
        var el = allLabels[i]
        var t = (el.textContent || "").toLowerCase().trim()
        if (t.length > 200 || !t.includes(keyword)) continue
        if (filledElements.has(el)) continue
        var score = 1000 - t.length
        if (el.tagName === "LABEL") score += 500
        if (t === keyword || t.startsWith(keyword + "?") || t.startsWith(keyword + " *")) score += 400
        if (score > bestScore) { bestScore = score; targetLabel = el }
      }

      if (!targetLabel) { resolve(result); return }

      // GUARD: For EEO questions, verify the label is in the EEO section of the form
      // (not near phone/address/name fields at the top)
      var isEEO = EEO_KEYWORDS.some(function(k) { return keyword.includes(k) })
      if (isEEO) {
        // Check if the label's parent section contains EEO section markers
        var sectionNode = targetLabel
        var inEEOSection = false
        for (var s = 0; s < 15; s++) {
          if (!sectionNode) break
          var sText = (sectionNode.textContent || "").toLowerCase()
          if (sText.includes("self-identification") || sText.includes("equal employment") ||
              sText.includes("equal opportunity") || sText.includes("eeo") ||
              sText.includes("government reporting") || sText.includes("voluntary")) {
            inEEOSection = true
            break
          }
          sectionNode = sectionNode.parentElement
        }
        if (!inEEOSection) { resolve(result); return }
      }

      // Walk up from label to find a field container
      var container = targetLabel.parentElement
      for (var up = 0; up < 5; up++) {
        if (!container) break
        // Check if container has a custom dropdown trigger
        var trigger = container.querySelector(
          '[class*="select__control"], [class*="css-"][class*="control"], ' +
          '[class*="SelectTrigger"], [class*="select-trigger"], ' +
          '[role="combobox"], [aria-haspopup="listbox"], ' +
          '[class*="chosen-container"], [class*="indicator"]'
        )
        if (trigger) break
        // Also check for native select we might have missed
        var nativeSelect = container.querySelector("select")
        if (nativeSelect && !filledElements.has(nativeSelect)) {
          var nResult = trySelectFill(nativeSelect, answer, { selector: "", inputType: "select" })
          if (nResult.ok) {
            filledElements.add(nativeSelect)
            filledElements.add(targetLabel)
            resolve(nResult)
            return
          }
        }
        container = container.parentElement
      }

      if (!container) { resolve(result); return }

      // Found a custom dropdown container — click to open
      var trigger = container.querySelector(
        '[class*="select__control"], [class*="css-"][class*="control"], ' +
        '[class*="SelectTrigger"], [class*="select-trigger"], ' +
        '[role="combobox"], [aria-haspopup="listbox"], ' +
        '[class*="chosen-container"], [class*="indicator"]'
      )
      // If no specific trigger, click the container's first clickable div
      if (!trigger) {
        trigger = container.querySelector('[class*="select"], [class*="dropdown"], [tabindex]')
      }
      if (!trigger) trigger = container

      // Click to open the dropdown
      trigger.click()
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

      // Wait for dropdown options to render
      setTimeout(function() {
        // Search for options anywhere on the page (dropdowns often render in portals)
        var optionSelectors = [
          '[class*="select__option"]', '[class*="option"]',
          '[role="option"]', '[role="listbox"] [role="option"]',
          '[class*="menu"] [class*="item"]', '[class*="MenuList"] > div',
          'li[id*="option"]', 'li[id*="react-select"]'
        ]
        var allOptions = document.querySelectorAll(optionSelectors.join(", "))

        var matched = false
        for (var oi = 0; oi < allOptions.length; oi++) {
          var opt = allOptions[oi]
          var optText = (opt.textContent || "").trim().toLowerCase()
          // Match: exact, starts with, or contains
          if (optText === answerLower ||
              optText.startsWith(answerLower) ||
              answerLower.startsWith(optText) ||
              optText.includes(answerLower) ||
              (answerLower === "yes" && optText.startsWith("yes")) ||
              (answerLower === "no" && (optText === "no" || optText.startsWith("no,"))) ||
              (answerLower === "male" && optText === "male") ||
              (answerLower === "female" && optText === "female") ||
              (answerLower === "asian" && optText === "asian") ||
              (answerLower.includes("not a protected veteran") && optText.includes("not a protected veteran")) ||
              (answerLower.includes("do not want to answer") && optText.includes("do not want to answer")) ||
              (answerLower.includes("do not have a disability") && optText.includes("do not have a disability"))) {
            opt.click()
            highlightField(trigger, "success")
            filledElements.add(trigger)
            filledElements.add(targetLabel)
            filledElements.add(container)
            matched = true
            resolve({ ok: true, method: "async_custom_dropdown", selected: optText, question: keyword })
            break
          }
        }

        if (!matched) {
          // Close the dropdown by pressing Escape
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
          resolve({ ok: false, error: "No matching option for: " + questionKeyword + " (tried " + allOptions.length + " options)" })
        }
      }, 400)  // 400ms wait for dropdown render
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNIVERSAL AUTOFILL — Works on ANY job portal (Greenhouse, Workday,
  // Lever, iCIMS, Taleo, Ashby, BambooHR, SmartRecruiters, etc.)
  //
  // Instead of searching for question text then hunting for inputs,
  // this scans ALL form controls first, reads their labels, and fills.
  // ═══════════════════════════════════════════════════════════════════════

  function universalFill(profileData) {
    return new Promise(async function(resolve) {
      var logs = { filled: [], skipped: [], failed: [] }
      if (typeof filledElements !== "undefined") filledElements.clear()

      // Build answer map from profile data
      var answers = buildAnswerMap(profileData)

      // ── STEP 1: Find every form control on the page ──
      var controls = findAllFormControls()

      // ── STEP 2: For each control, read its label and match to an answer ──
      for (var i = 0; i < controls.length; i++) {
        var ctrl = controls[i]
        if (filledElements.has(ctrl.element)) continue

        var label = ctrl.label.toLowerCase()
        if (!label || label.length < 2) { logs.skipped.push(label || "(no label)"); continue }

        // Find the best matching answer
        var match = matchLabelToAnswer(label, answers, ctrl.type)
        if (!match) { logs.skipped.push(label.slice(0, 40)); continue }

        // ── STEP 3: Fill the control ──
        var filled = false

        // Text inputs / textareas
        if (ctrl.type === "text" || ctrl.type === "email" || ctrl.type === "tel" ||
            ctrl.type === "url" || ctrl.type === "textarea" || ctrl.type === "number" || ctrl.type === "date") {
          if (ctrl.element.value && ctrl.element.value.trim().length > 0) {
            logs.skipped.push(label.slice(0, 40) + " (has value)")
            continue
          }
          var tr = tryTextFill(ctrl.element, match.value, { selector: "", inputType: ctrl.type })
          if (tr.ok) {
            tryClickDropdownOption(ctrl.element, match.value)
            filled = true
          }
        }

        // Native select
        if (ctrl.type === "select") {
          var sr = trySelectFill(ctrl.element, match.value, { selector: "", inputType: "select" })
          if (sr.ok) filled = true
          // Even if fill failed, mark country/phone selects as claimed so nothing else touches them
          if (match.key === "phone_country" || match.key === "country_text" || match.key.includes("country")) {
            filledElements.add(ctrl.element)
            if (ctrl.container) filledElements.add(ctrl.container)
          }
        }

        // Radio buttons
        if (ctrl.type === "radio") {
          var rr = tryRadioFill(ctrl.container, match.value, { selector: "", inputType: "radio" })
          if (rr.ok) filled = true
        }

        // Checkbox
        if (ctrl.type === "checkbox") {
          var cr = tryCheckboxFill(ctrl.element, match.value, { selector: "", inputType: "checkbox" })
          if (cr.ok) filled = true
        }

        // Custom dropdown (React-Select, MUI, Workday, etc.)
        if (ctrl.type === "custom-select" && !filled) {
          filled = await fillCustomDropdown(ctrl.element, ctrl.container, match.value)
          // Claim country custom-selects even if fill failed
          if (match.key.includes("country")) {
            filledElements.add(ctrl.element)
            if (ctrl.container) filledElements.add(ctrl.container)
          }
        }

        if (filled) {
          filledElements.add(ctrl.element)
          if (ctrl.container) filledElements.add(ctrl.container)
          logs.filled.push({ label: label.slice(0, 40), value: String(match.value).slice(0, 30), key: match.key })
          highlightField(ctrl.element, "success")
        } else {
          logs.failed.push(label.slice(0, 40))
        }

        // Small delay for React/Angular re-renders
        await sleep(100)
      }

      resolve(logs)
    })
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms) }) }

  // ── Find ALL form controls on the page ──
  function findAllFormControls() {
    var controls = []
    var seen = new Set()

    // 1. Native inputs, selects, textareas
    var elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), ' +
      'select, textarea'
    )
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i]
      if (!el.offsetParent && el.type !== "hidden") continue  // Skip invisible
      if (seen.has(el)) continue
      seen.add(el)

      var type = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" :
                 (el.type || "text")
      if (type === "file") continue  // Skip file uploads

      // For radio buttons, group them
      if (type === "radio") {
        var groupName = el.name
        if (!groupName || seen.has("radio:" + groupName)) continue
        seen.add("radio:" + groupName)
        var container = el.closest("[class*='field'], [class*='question'], fieldset, [role='radiogroup'], [class*='group']") || el.parentElement?.parentElement
        controls.push({
          element: el,
          container: container,
          type: "radio",
          label: readLabel(el, container),
        })
        continue
      }

      var container = el.closest("[class*='field'], [class*='question'], [class*='form-group'], [class*='formField'], [class*='row']") || el.parentElement
      controls.push({
        element: el,
        container: container,
        type: type,
        label: readLabel(el, container),
      })
    }

    // 2. Custom dropdowns (React-Select, MUI Select, Workday, etc.)
    var customSelectors = [
      '[role="combobox"]', '[role="listbox"]', '[aria-haspopup="listbox"]',
      '[class*="select__control"]', '[class*="css-"][class*="control"]',
      '[class*="SelectTrigger"]', '[class*="select-trigger"]',
      '[class*="chosen-container"]', '[class*="MuiSelect"]',
      '[class*="ant-select"]', '[class*="dropdown-toggle"]',
      '[data-automation-id*="select"]', '[data-automation-id*="dropdown"]'
    ]
    var customEls = document.querySelectorAll(customSelectors.join(", "))
    for (var j = 0; j < customEls.length; j++) {
      var cel = customEls[j]
      if (!cel.offsetParent) continue
      if (seen.has(cel)) continue
      // Skip if there's already a native select we found in same container
      var parentContainer = cel.closest("[class*='field'], [class*='question'], [class*='form-group']") || cel.parentElement
      var hasNativeSelect = parentContainer && parentContainer.querySelector("select")
      if (hasNativeSelect && seen.has(hasNativeSelect)) continue
      seen.add(cel)
      controls.push({
        element: cel,
        container: parentContainer,
        type: "custom-select",
        label: readLabel(cel, parentContainer),
      })
    }

    return controls
  }

  // ── Read label for ANY form control ──
  function readLabel(el, container) {
    var label = ""

    // 1. aria-label
    label = el.getAttribute("aria-label") || ""
    if (label) return label

    // 2. <label for="id">
    if (el.id) {
      var lbl = document.querySelector('label[for="' + el.id + '"]')
      if (lbl) return (lbl.textContent || "").trim()
    }

    // 3. aria-labelledby
    var lblBy = el.getAttribute("aria-labelledby")
    if (lblBy) {
      var lblEl = document.getElementById(lblBy)
      if (lblEl) return (lblEl.textContent || "").trim()
    }

    // 4. Wrapping <label>
    var parentLabel = el.closest("label")
    if (parentLabel) {
      // Get label text excluding the input's own value
      var clone = parentLabel.cloneNode(true)
      var inputs = clone.querySelectorAll("input, select, textarea")
      inputs.forEach(function(inp) { inp.remove() })
      label = (clone.textContent || "").trim()
      if (label) return label
    }

    // 5. Previous sibling label/span/p
    if (container) {
      var prev = el.previousElementSibling
      while (prev) {
        if (["LABEL", "SPAN", "P", "DIV", "H3", "H4", "H5", "STRONG", "LEGEND"].indexOf(prev.tagName) !== -1) {
          var pt = (prev.textContent || "").trim()
          if (pt.length > 0 && pt.length < 120) return pt
        }
        prev = prev.previousElementSibling
      }
    }

    // 6. Container's first heading/label element
    if (container) {
      var headings = container.querySelectorAll("label, legend, h3, h4, h5, h6, strong, [class*='label'], [class*='Label']")
      for (var hi = 0; hi < headings.length; hi++) {
        var ht = (headings[hi].textContent || "").trim()
        if (ht.length > 0 && ht.length < 120 && !ht.includes("Select")) return ht
      }
    }

    // 7. Placeholder
    if (el.placeholder) return el.placeholder

    // 8. name/id as last resort
    var nameId = (el.name || el.id || "").replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
    return nameId
  }

  // ── Build answer map — US-only, 3-tier structure ──
  function buildAnswerMap(pd) {
    // Parse US location: "Arlington, Texas" → city + state
    var locParts = (pd.location || "").split(",").map(function(s) { return s.trim() })

    return {
      // ── Tier 1: Identity (deterministic from profile) ──
      "first name": pd.firstName, "first_name": pd.firstName, "fname": pd.firstName, "given name": pd.firstName,
      "last name": pd.lastName, "last_name": pd.lastName, "lname": pd.lastName, "surname": pd.lastName, "family name": pd.lastName,
      "full name": pd.fullName || ((pd.firstName || "") + " " + (pd.lastName || "")).trim(),
      "name": pd.fullName || ((pd.firstName || "") + " " + (pd.lastName || "")).trim(),
      "email": pd.email, "e-mail": pd.email, "email address": pd.email,
      "phone": pd.phone, "phone number": pd.phone, "mobile": pd.phone, "telephone": pd.phone, "cell": pd.phone,
      "linkedin": pd.linkedin, "linkedin url": pd.linkedin, "linkedin profile": pd.linkedin,
      "github": pd.github, "github url": pd.github, "github profile": pd.github,
      "portfolio": pd.portfolio, "website": pd.portfolio, "personal website": pd.portfolio,
      "publication": pd.publications || "", "publications": pd.publications || "",
      "google scholar": pd.publications || "",
      // US address fields
      "location": pd.location, "city": locParts[0] || pd.location,
      "state": locParts[1] || "",
      "zip": pd.zip || pd.zipCode || "",
      "address": pd.address || pd.location, "street address": pd.address || pd.location,
      "what is your address": pd.address || pd.location,
      // Work
      "current company": pd.headline, "current employer": pd.headline,
      "headline": pd.headline, "summary": pd.summary,

      // ── Tier 1: US Work Authorization (from stored preferences) ──
      "authorized to work": pd.workAuthorization || "",
      "legally authorized": pd.workAuthorization || "",
      "work authorization": pd.workAuthorization || "",
      "eligible to work": pd.workAuthorization || "",
      "right to work": pd.workAuthorization || "",
      "sponsorship": pd.sponsorship || "",
      "visa sponsorship": pd.sponsorship || "",
      "require sponsorship": pd.sponsorship || "",
      "require visa": pd.sponsorship || "",
      "employment visa": pd.sponsorship || "",
      "employer sponsorship": pd.sponsorship || "",

      // ── Tier 1: Simple logistics (from stored preferences) ──
      "interviewed before": pd.interviewedBefore || "",
      "ever interviewed": pd.interviewedBefore || "",

      // ── Consent (safe to auto-accept) ──
      "ai policy": "Yes",
      "acknowledge": "Yes",
      "confirm your understanding": "Yes",

      // ── Tier 2: contextual — NOT in this map (handled by AI in engine) ──
      // relocation, DFW area, remote preference, salary, start date, travel
      // ── Tier 3: sensitive — NOT in this map (always REVIEW) ──
      // gender, race, ethnicity, veteran, disability, pronouns
    }
  }

  // ── Match a label to the best answer ──
  function matchLabelToAnswer(label, answers, controlType) {
    var labelLower = label.toLowerCase()

    // Skip file uploads entirely
    if (labelLower.includes("resume") || labelLower.includes("cv") || labelLower.includes("cover letter")) {
      return null
    }

    // Skip fields that should only be filled if user has specific data
    var optionalFields = ["publication", "publications", "google scholar", "semantic scholar"]
    for (var of2 = 0; of2 < optionalFields.length; of2++) {
      if (labelLower.includes(optionalFields[of2]) && !answers[optionalFields[of2]]) return null
    }

    // Special handling: "Country" as a SHORT label (phone country code selector)
    // ONLY match when "country" IS the main label — not inside a long sentence like
    // "require visa sponsorship to work in the country in which..."
    if (labelLower.length < 30 && (labelLower === "country" || labelLower === "country *" ||
        labelLower === "country code" || labelLower === "phone country" ||
        labelLower.startsWith("country") && !labelLower.includes("work") && !labelLower.includes("visa"))) {
      if (controlType === "select" || controlType === "custom-select") {
        return { key: "phone_country", value: "United States" }
      }
      if (controlType === "text") {
        return { key: "country_text", value: "United States" }
      }
      return null
    }

    // Exact key match
    for (var key in answers) {
      if (answers[key] && labelLower === key) return { key: key, value: answers[key] }
    }

    // Contains match — longest key first for specificity
    var keys = Object.keys(answers).sort(function(a, b) { return b.length - a.length })
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k]
      if (!answers[key]) continue
      if (labelLower.includes(key)) {
        // Guard: don't put address/location text into select/radio/custom-select fields
        var isAddressAnswer = key === "address" || key === "location" || key === "city" || key === "street address" || key === "state"
        if (isAddressAnswer && (controlType === "select" || controlType === "radio" || controlType === "custom-select")) continue

        // Guard: don't put empty/blank answers
        if (!answers[key] || String(answers[key]).trim() === "") continue

        // Guard: validate answer makes sense for the field context
        // Don't put EEO answers into non-EEO fields and vice versa
        var isEEOKey = ["gender", "sex", "hispanic", "latino", "race", "ethnicity", "veteran", "disability", "pronouns"].indexOf(key) !== -1
        var isEEOLabel = ["gender", "hispanic", "latino", "race", "ethnicity", "veteran", "disability", "pronouns", "self-identification"].some(function(w) { return labelLower.includes(w) })

        // EEO answers should only go to EEO labels
        if (isEEOKey && !isEEOLabel) continue
        // Non-EEO labels that look like EEO shouldn't get non-EEO answers
        if (isEEOLabel && !isEEOKey) continue

        return { key: key, value: answers[key] }
      }
    }

    return null
  }

  // ── Fill a custom dropdown (async — click, wait, select) ──
  function fillCustomDropdown(triggerEl, container, value) {
    return new Promise(function(resolve) {
      var answerLower = value.toLowerCase()

      // Click the trigger to open
      triggerEl.click()
      triggerEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

      // Also try clicking inner elements (some React-Selects need this)
      var inner = triggerEl.querySelector("[class*='value'], [class*='placeholder'], [class*='indicator']")
      if (inner) inner.click()

      // Wait for dropdown to render (React portals, etc.)
      setTimeout(function() {
        var optionSelectors = [
          '[class*="select__option"]', '[class*="option"]', '[role="option"]',
          '[class*="menu"] [class*="item"]', '[class*="MenuList"] > div',
          'li[id*="option"]', 'li[id*="react-select"]', 'li[role="option"]',
          '[class*="MuiMenuItem"]', '[class*="ant-select-item"]',
          '[data-automation-id*="option"]', '[class*="dropdown-item"]'
        ]
        var allOptions = document.querySelectorAll(optionSelectors.join(", "))

        // Score each option and pick the best match
        var bestOpt = null
        var bestOptScore = 0
        for (var oi = 0; oi < allOptions.length; oi++) {
          var opt = allOptions[oi]
          if (!opt.offsetParent && !opt.getBoundingClientRect().height) continue
          var optText = (opt.textContent || "").trim().toLowerCase()
          var optValue = (opt.getAttribute("value") || opt.getAttribute("data-value") || "").toLowerCase()
          var matchScore = 0

          if (optText === answerLower) matchScore = 100
          else if (optValue === answerLower) matchScore = 95
          else if (optText.startsWith(answerLower)) matchScore = 80
          else if (answerLower.startsWith(optText) && optText.length > 2) matchScore = 70
          else if (optText.includes(answerLower)) matchScore = 60
          else if (answerLower.includes(optText) && optText.length > 3) matchScore = 50
          // Country code matching: "United States" matches "+1", "US (+1)", "US", etc.
          else if (answerLower === "united states" && (optText.includes("united states") || optText.includes("us") || optText.includes("+1"))) matchScore = 85
          else if (answerLower === "+1" && (optText.includes("+1") || optText.includes("united states") || optText === "us")) matchScore = 85

          if (matchScore > bestOptScore) {
            bestOptScore = matchScore
            bestOpt = opt
          }
        }

        if (bestOpt && bestOptScore >= 50) {
          bestOpt.click()
          highlightField(triggerEl, "success")
          resolve(true)
          return
        }

        // No match — try typing into the search input (some custom selects have search)
        var searchInput = document.querySelector('[class*="select__input"] input, [class*="search"] input, [role="combobox"] input')
        if (searchInput) {
          searchInput.focus()
          searchInput.value = value
          searchInput.dispatchEvent(new Event("input", { bubbles: true }))
          // Wait for filtered options
          setTimeout(function() {
            var filteredOpts = document.querySelectorAll('[role="option"], [class*="option"]')
            if (filteredOpts.length > 0) {
              filteredOpts[0].click()
              highlightField(triggerEl, "success")
              resolve(true)
            } else {
              // Close dropdown
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
              resolve(false)
            }
          }, 300)
        } else {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
          resolve(false)
        }
      }, 400)
    })
  }

  // ── Get ALL empty fields for AI filling ──
  function getEmptyFields() {
    var fields = []
    var controls = findAllFormControls()

    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i]
      var el = ctrl.element
      var label = ctrl.label || ""
      if (!label || label.length < 2) continue

      // Skip file inputs
      if (ctrl.type === "file") continue
      if (label.toLowerCase().includes("resume") || label.toLowerCase().includes("cv") ||
          label.toLowerCase().includes("cover letter") || label.toLowerCase().includes("attach")) continue

      // Check if empty
      var isEmpty = false
      if (ctrl.type === "text" || ctrl.type === "email" || ctrl.type === "tel" ||
          ctrl.type === "url" || ctrl.type === "textarea" || ctrl.type === "number" || ctrl.type === "date") {
        isEmpty = !el.value || el.value.trim().length === 0
      } else if (ctrl.type === "select") {
        var selectedText = (el.options[el.selectedIndex]?.text || "").toLowerCase().trim()
        isEmpty = !selectedText || selectedText === "select" || selectedText === "select..." ||
                  selectedText === "choose..." || selectedText === "-- select --" ||
                  selectedText === "" || el.selectedIndex <= 0
      } else if (ctrl.type === "custom-select") {
        var displayText = (el.textContent || "").toLowerCase().trim()
        isEmpty = !displayText || displayText === "select" || displayText === "select..." ||
                  displayText === "choose..." || displayText.includes("select")
      } else if (ctrl.type === "radio") {
        var groupName = el.name
        var radios = document.querySelectorAll('input[type="radio"][name="' + groupName + '"]')
        var anyChecked = false
        for (var r = 0; r < radios.length; r++) { if (radios[r].checked) anyChecked = true }
        isEmpty = !anyChecked
      } else if (ctrl.type === "checkbox") {
        isEmpty = !el.checked
      }

      if (!isEmpty) continue

      // Build a selector for this element
      var selector = getUniqueSelector(el)

      // Get available options for selects
      var options = []
      if (ctrl.type === "select") {
        options = Array.from(el.options).map(function(o) { return o.text.trim() }).filter(function(t) {
          return t && t.toLowerCase() !== "select" && t.toLowerCase() !== "select..." && t !== ""
        })
      }

      fields.push({
        selector: selector,
        label: label.slice(0, 200),
        inputType: ctrl.type,
        options: options.slice(0, 20),
        placeholder: el.placeholder || "",
      })
    }

    return fields
  }

})()
