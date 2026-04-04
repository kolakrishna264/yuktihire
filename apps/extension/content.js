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

// ── Persistent Floating Widget ───────────────────────────────────────────
;(function() {
  // Only inject on job/application pages (not on yuktihire.com itself)
  if (location.hostname.includes("yuktihire.com")) return

  // Auto-detect if this is a relevant page
  setTimeout(function() {
    var bodyText = (document.body?.innerText || "").toLowerCase()
    var url = location.href.toLowerCase()
    var jobSignals = ["job description", "responsibilities", "qualifications", "apply now", "apply for this", "submit application", "about the role", "what you'll do"]
    var isJobPage = jobSignals.filter(function(s) { return bodyText.includes(s) }).length >= 2
    var isCareerPage = url.includes("/jobs") || url.includes("/career") || url.includes("/apply") || url.includes("greenhouse") || url.includes("lever.co") || url.includes("workday")
    var hasForms = document.querySelectorAll("form").length > 0 || document.querySelectorAll("input[type='text'], input[type='email'], textarea").length >= 3

    if (isJobPage || isCareerPage || hasForms) {
      injectFloatingWidget()
    }
  }, 1500) // Wait for page to load

  function injectFloatingWidget() {
    if (document.getElementById("yuktihire-widget")) return // Already injected

    var widget = document.createElement("div")
    widget.id = "yuktihire-widget"
    widget.innerHTML = `
      <div id="yh-chip" style="position:fixed;bottom:20px;right:20px;z-index:999999;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 16px;background:linear-gradient(135deg,#6c63ff,#8b5cf6);color:#fff;border-radius:14px;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(108,99,255,0.4);transition:transform 0.15s,box-shadow 0.15s" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform=''">
        <span style="font-size:18px">Y</span>
        YuktiHire
      </div>
    `
    document.body.appendChild(widget)

    document.getElementById("yh-chip").addEventListener("click", function() {
      // Open the extension popup via chrome.runtime
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
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

    // Location
    if (matches(text, ["street address", "address line"])) return "address"
    if (matches(text, ["city", "location", "where are you", "located", "based in"])) return "location"
    if (matches(text, ["state", "province", "region"])) return "state"
    if (matches(text, ["zip", "postal", "postcode", "zip code"])) return "zip"
    if (matches(text, ["country"])) return "country"

    // Work
    if (matches(text, ["current company", "current employer", "company name", "employer name"])) return "currentCompany"
    if (matches(text, ["current title", "current role", "job title", "current position"])) return "currentTitle"

    // Authorization — must come before generic work keywords
    if (matches(text, ["authorized to work", "authorised to work", "legally authorized", "work authorization", "right to work", "eligible to work", "work in the u.s", "work in the us", "legally permitted", "employment eligibility"])) return "workAuthorization"
    if (matches(text, ["sponsorship", "sponsor", "visa", "h-1b", "h1b", "immigration", "require sponsorship", "need sponsorship", "require visa"])) return "sponsorship"
    if (matches(text, ["relocat"])) return "relocation"

    // Compensation
    if (matches(text, ["salary", "compensation", "expected pay", "desired salary", "pay expectation", "salary expectation"])) return "salary"
    if (matches(text, ["start date", "earliest start", "when can you start", "availability", "notice period", "available to start", "date available"])) return "availability"

    // Experience
    if (matches(text, ["years of experience", "how many years", "years experience", "total experience"])) return "yearsExperience"
    if (matches(text, ["education", "highest degree", "degree", "university", "school", "academic"])) return "education"
    if (matches(text, ["gender"]) && !text.includes("transgender")) return "gender"
    if (matches(text, ["race", "ethnicity", "ethnic"])) return "ethnicity"
    if (matches(text, ["veteran"])) return "veteran"
    if (matches(text, ["disability", "disabled"])) return "disability"
    if (matches(text, ["pronouns"])) return "pronouns"

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

      // If standard fill failed and value is Yes/No, search the entire page
      // for radio buttons or clickable options near this element
      var valueLower = String(value).toLowerCase()
      if (valueLower === "yes" || valueLower === "no") {
        // Search for clickable options in a wide area around the element
        var searchContainer = el.closest("[class*='question'], [class*='field'], [class*='form'], [class*='block'], [class*='group']") || el.parentElement?.parentElement?.parentElement
        if (searchContainer) {
          var clickResult = tryCustomComponentFill(searchContainer, value, block)
          if (clickResult.ok) return clickResult
        }

        // Last resort: find ALL radio buttons on the page and match by proximity
        var allRadios = document.querySelectorAll('input[type="radio"]')
        for (var i = 0; i < allRadios.length; i++) {
          var radio = allRadios[i]
          var label = radio.closest("label")
          var labelText = (label ? label.textContent : radio.value || "").trim().toLowerCase()
          if ((valueLower === "yes" && labelText.startsWith("yes")) || (valueLower === "no" && labelText.startsWith("no"))) {
            // Check if this radio is within 500px of our target element
            var elRect = el.getBoundingClientRect()
            var radioRect = radio.getBoundingClientRect()
            var distance = Math.abs(elRect.top - radioRect.top)
            if (distance < 500) {
              radio.click()
              radio.checked = true
              radio.dispatchEvent(new Event("change", { bubbles: true }))
              highlightField(label || radio, "success")
              return { ok: true, method: "proximity_radio", selected: labelText }
            }
          }
        }

        // Try clicking any Select dropdown on the page with this value
        var allSelects = document.querySelectorAll("select")
        for (var j = 0; j < allSelects.length; j++) {
          var sel = allSelects[j]
          var selRect = sel.getBoundingClientRect()
          var dist = Math.abs(el.getBoundingClientRect().top - selRect.top)
          if (dist < 300) {
            var opts = Array.from(sel.options)
            var match = opts.find(function(o) {
              return o.text.toLowerCase().trim() === valueLower || o.value.toLowerCase().trim() === valueLower
            })
            if (match) {
              sel.value = match.value
              sel.dispatchEvent(new Event("change", { bubbles: true }))
              highlightField(sel, "success")
              return { ok: true, method: "proximity_select", selected: match.text }
            }
          }
        }
      }

      // If value is a location-like string, try typing + clicking dropdown
      if (value.includes(",") || value.toLowerCase().includes("arlington") || value.toLowerCase().includes("texas")) {
        var textResult = tryTextFill(el, value, block)
        if (textResult.ok) {
          tryClickDropdownOption(el, value)
          return textResult
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
      sendResponse(fillSafeFields(msg.data))
    }
    if (msg.type === "FILL_SINGLE_FIELD") {
      sendResponse(fillSingleField(msg.selector, msg.value))
    }
    if (msg.type === "CHECK_SUBMISSION") {
      sendResponse({ submitted: detectSubmissionSuccess() })
    }

    if (msg.type === "FIND_AND_FILL_QUESTION") {
      sendResponse(findAndFillQuestion(msg.question, msg.answer))
    }
    return false
  })

  /**
   * Search the entire page for a question matching the given text,
   * then find the nearest form control and fill it with the answer.
   * This handles custom React forms where the scanner can't link questions to inputs.
   */
  function findAndFillQuestion(questionKeyword, answer) {
    var keyword = questionKeyword.toLowerCase()
    var answerLower = answer.toLowerCase()

    // Search for question text — only match SHORT text elements (actual labels, not large containers)
    var allElements = document.querySelectorAll("p, span, label, h3, h4, h5, h6, strong, legend, div")

    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i]
      var text = (el.textContent || "").toLowerCase().trim()
      if (!text.includes(keyword)) continue
      // Skip large containers — only match elements with <300 chars of text
      if (text.length > 300) continue
      // Skip if too many children (it's a container)
      if (el.children.length > 8) continue
      // Skip if this is inside a name/email/phone field area
      var nearbyInput = el.closest("label")?.querySelector("input")
      if (nearbyInput) {
        var inputType = (nearbyInput.name + nearbyInput.id + nearbyInput.type).toLowerCase()
        if (inputType.includes("name") || inputType.includes("email") || inputType.includes("phone")) continue
      }

      // Found a matching question! Search ONLY in the immediate vicinity
      // Walk up max 3 levels to find the question block container
      var container = el.parentElement
      for (var up = 0; up < 3; up++) {
        if (!container) break
        var inputs = container.querySelectorAll("select, input[type='radio'], input:not([type='hidden']):not([type='submit']):not([type='file']), textarea")
        if (inputs.length > 0 && inputs.length <= 5) break // Found a reasonable container
        container = container.parentElement
      }
      if (!container) continue

      // Strategy 1: Find a native <select> in this block
      var select = container.querySelector("select")
      if (select) {
        var result = trySelectFill(select, answer, { selector: "", inputType: "select" })
        if (result.ok) return result
      }

      // Strategy 2: Find radio buttons in this block
      var radios = container.querySelectorAll('input[type="radio"]')
      if (radios.length === 0) {
        // Search wider
        var wider = container.parentElement
        if (wider) radios = wider.querySelectorAll('input[type="radio"]')
      }
      if (radios.length > 0) {
        for (var r = 0; r < radios.length; r++) {
          var radio = radios[r]
          var lbl = radio.closest("label")
          var lblText = (lbl ? lbl.textContent : radio.value || "").trim().toLowerCase()
          if ((answerLower === "yes" && lblText.startsWith("yes")) ||
              (answerLower === "no" && lblText.startsWith("no")) ||
              lblText === answerLower || lblText.includes(answerLower)) {
            radio.click()
            radio.checked = true
            radio.dispatchEvent(new Event("change", { bubbles: true }))
            highlightField(lbl || radio, "success")
            return { ok: true, method: "find_and_fill_radio", selected: lblText, question: keyword }
          }
        }
      }

      // Strategy 3: Find a text input — but NEVER fill name/email/phone fields
      var input = container.querySelector("input:not([type='radio']):not([type='checkbox']):not([type='hidden']):not([type='file']):not([type='submit'])")
      if (!input) input = container.querySelector("textarea")
      if (input) {
        // Guard: never fill protected identity fields
        var inputId = ((input.name || "") + (input.id || "") + (input.placeholder || "")).toLowerCase()
        var isProtected = ["first", "last", "name", "email", "phone", "tel", "fname", "lname"].some(function(w) { return inputId.includes(w) })
        // Guard: never fill fields that already have a value
        var alreadyFilled = input.value && input.value.trim().length > 0

        if (!isProtected && !alreadyFilled) {
          var textResult = tryTextFill(input, answer, { selector: getUniqueSelector(input), inputType: input.type || "text" })
          if (textResult.ok) {
            tryClickDropdownOption(input, answer)
            return { ok: true, method: "find_and_fill_text", question: keyword }
          }
        }
      }

      // Strategy 4: Click any clickable option div
      var clickables = container.querySelectorAll('[role="option"], [role="radio"], [class*="option"], [class*="choice"]')
      for (var c = 0; c < clickables.length; c++) {
        var ct = (clickables[c].textContent || "").trim().toLowerCase()
        if ((answerLower === "yes" && ct.startsWith("yes")) || (answerLower === "no" && ct.startsWith("no")) || ct === answerLower) {
          clickables[c].click()
          highlightField(clickables[c], "success")
          return { ok: true, method: "find_and_fill_click", selected: ct, question: keyword }
        }
      }
    }

    return { ok: false, error: "Question not found on page: " + questionKeyword }
  }

})()
