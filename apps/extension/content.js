// YuktiHire Content Script — Extracts job data from job sites

(function() {
  "use strict"

  const EXTRACTORS = {
    // LinkedIn
    "linkedin.com": {
      detect: () => !!document.querySelector(".job-details-jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-unified-top-card__job-title"),
      extract: () => ({
        title: getText(".job-details-jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-unified-top-card__job-title, h1.t-24"),
        company: getText(".job-details-jobs-unified-top-card__company-name, .topcard__org-name-link, .jobs-unified-top-card__company-name, a.app-aware-link[href*='/company/']"),
        description: getText(".jobs-description__content, .jobs-box__html-content, .show-more-less-html__markup, #job-details"),
      }),
    },

    // Greenhouse
    "greenhouse.io": {
      detect: () => !!document.querySelector("#header .app-title, .opening h1, [data-mapped='true'] h1"),
      extract: () => ({
        title: getText("#header .app-title, .opening h1, [data-mapped='true'] h1"),
        company: getText(".company-name, #header .company-name") || document.title.split(" at ").pop()?.split(" - ")[0]?.trim() || "",
        description: getText("#content .body, .opening .body, #app_body"),
      }),
    },

    // Lever
    "lever.co": {
      detect: () => !!document.querySelector(".posting-headline h2, .section-wrapper h1"),
      extract: () => ({
        title: getText(".posting-headline h2, .section-wrapper h1"),
        company: getText(".posting-headline .company, .main-header-logo img")?.replace(/\s+/g, " ")?.trim() || document.title.split(" - ").pop()?.trim() || "",
        description: getText(".section-wrapper .content, .posting-page .content, [data-qa='job-description']"),
      }),
    },

    // Workday
    "myworkdayjobs.com": {
      detect: () => !!document.querySelector("[data-automation-id='jobPostingHeader'], h2.css-1vd41l"),
      extract: () => ({
        title: getText("[data-automation-id='jobPostingHeader'], h2.css-1vd41l, .css-1q2dra3"),
        company: document.title.split(" - ").pop()?.trim() || "",
        description: getText("[data-automation-id='jobPostingDescription'], .css-cygeeu"),
      }),
    },

    // Indeed
    "indeed.com": {
      detect: () => !!document.querySelector(".jobsearch-JobInfoHeader-title, h1.icl-u-xs-mb--xs, [data-testid='jobsearch-JobInfoHeader-title']"),
      extract: () => ({
        title: getText(".jobsearch-JobInfoHeader-title, h1.icl-u-xs-mb--xs, [data-testid='jobsearch-JobInfoHeader-title']"),
        company: getText("[data-testid='inlineHeader-companyName'], .icl-u-lg-mr--sm, .jobsearch-InlineCompanyRating-companyHeader"),
        description: getText("#jobDescriptionText, .jobsearch-JobComponent-description, [data-testid='job-description']"),
      }),
    },

    // Generic fallback
    _generic: {
      detect: () => true,
      extract: () => ({
        title: getText("h1") || document.title.split(" - ")[0]?.split(" | ")[0]?.trim() || "",
        company: extractCompanyGeneric(),
        description: getText("main, article, [role='main'], .job-description, .job-details, #job-description") || getText("body")?.slice(0, 5000) || "",
      }),
    },
  }

  function getText(selector) {
    const el = document.querySelector(selector)
    return el ? el.innerText?.trim().replace(/\s+/g, " ").slice(0, 10000) : ""
  }

  function extractCompanyGeneric() {
    // Try meta tags
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content
    if (ogSiteName) return ogSiteName
    // Try structured data
    const ld = document.querySelector('script[type="application/ld+json"]')
    if (ld) {
      try {
        const data = JSON.parse(ld.textContent)
        if (data.hiringOrganization?.name) return data.hiringOrganization.name
        if (data.publisher?.name) return data.publisher.name
      } catch {}
    }
    return document.location.hostname.replace("www.", "").split(".")[0] || ""
  }

  function getDomain() {
    return document.location.hostname.replace("www.", "")
  }

  function extractJobData() {
    const domain = getDomain()

    // Find matching extractor
    for (const [key, extractor] of Object.entries(EXTRACTORS)) {
      if (key === "_generic") continue
      if (domain.includes(key) && extractor.detect()) {
        const data = extractor.extract()
        return { ...data, source_domain: domain, matched_extractor: key }
      }
    }

    // Try generic
    if (EXTRACTORS._generic.detect()) {
      const data = EXTRACTORS._generic.extract()
      return { ...data, source_domain: domain, matched_extractor: "generic" }
    }

    return null
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_JOB") {
      const data = extractJobData()
      sendResponse({
        url: document.location.href,
        pageTitle: document.title,
        ...data,
      })
    }
    return false
  })
})()
