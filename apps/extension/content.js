// YuktiHire Content Script — Universal job extraction + Auth callback

// ── Auth callback handler ────────────────────────────────────────────────
if (document.location.pathname === "/auth/extension-callback") {
  window.addEventListener("yuktihire-auth", (e) => {
    const detail = e.detail
    if (detail && detail.access_token) {
      chrome.runtime.sendMessage({
        type: "SET_TOKEN",
        token: detail.access_token,
        refresh: detail.refresh_token || "",
        expires: detail.expires_at || 0,
      })
    }
  })
  const _authPoll = setInterval(() => {
    const token = window.__YUKTIHIRE_TOKEN__
    if (token) {
      chrome.runtime.sendMessage({ type: "SET_TOKEN", token, refresh: window.__YUKTIHIRE_REFRESH__ || "", expires: 0 })
      clearInterval(_authPoll)
    }
  }, 500)
  setTimeout(() => clearInterval(_authPoll), 30000)
}

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

  // ── Message listener ───────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_JOB") {
      const data = extractJobData()
      sendResponse(data)
    }
    return false
  })
})()
