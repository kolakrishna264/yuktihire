// ═══════════════════════════════════════════════════════════════════════════
// YuktiHire Autofill Engine v2 — Intelligent Application Filling
//
// 3-Layer Architecture:
//   Layer 1: Question Intent Classification
//   Layer 2: UI Interaction Pattern Detection
//   Layer 3: Answer Strategy Resolution
//
// Works on: Greenhouse, Lever, Rippling, Workday, iCIMS, Taleo, Ashby,
//           LinkedIn, Indeed, BambooHR, SmartRecruiters, JazzHR, custom forms
// ═══════════════════════════════════════════════════════════════════════════

var YuktiEngine = (function () {
  "use strict"

  // ── LAYER 1: Question Intent Taxonomy ──────────────────────────────────

  // ── ANSWER SHAPES ──
  // Every intent has a shape that controls the output format
  // boolean: "Yes" / "No" only
  // enum_choice: pick from available options
  // numeric: number or short numeric phrase (e.g. "5", "3-5 years")
  // short_text: max 15 words
  // location: city/state format
  // date_or_timeline: short factual timeline
  // essay: longer AI response (200-400 words)

  // US-only product — optimized for US job application patterns
  var INTENT_PATTERNS = {
    // ── Tier 1: Identity / Contact (deterministic) ──
    firstName:       { patterns: ["first name", "first_name", "fname", "given name", "given_name", "legal first", "legal given"], category: "identity", shape: "short_text" },
    lastName:        { patterns: ["last name", "last_name", "lname", "surname", "family name", "family_name", "legal last", "legal family"], category: "identity", shape: "short_text" },
    fullName:        { patterns: ["full name", "your name", "candidate name", "applicant name", "fullname", "name *", "legal name"], category: "identity", shape: "short_text" },
    preferredName:   { patterns: ["preferred name", "preferred first", "nickname", "goes by", "known as"], category: "identity", shape: "short_text" },
    email:           { patterns: ["email", "e-mail", "email address"], category: "identity", shape: "short_text" },
    phone:           { patterns: ["phone", "mobile", "telephone", "cell", "contact number", "phone number"], category: "identity", shape: "short_text" },
    address:         { patterns: ["street address", "address line", "mailing address", "home address", "your address", "address from which", "what is your address"], category: "identity", shape: "location" },
    city:            { patterns: ["city", "town"], category: "identity", shape: "location" },
    state:           { patterns: ["state", "state/province", "state or province", "province", "state/region", "which state", "what state", "us state"], category: "identity", maxLabelLen: 60, shape: "enum_choice" },
    zip:             { patterns: ["zip", "zip code", "postal code"], category: "identity", shape: "short_text" },
    country:         { patterns: ["country", "country of residence", "country of origin", "home country", "which country", "what country", "country/region", "country or region"], category: "identity", maxLabelLen: 80, shape: "enum_choice" },
    location:        { patterns: ["location", "where are you located", "based in", "current location"], category: "identity", shape: "location" },
    linkedin:        { patterns: ["linkedin", "linkedin profile", "linkedin url", "linkedin link"], category: "identity", shape: "short_text" },
    github:          { patterns: ["github", "github url", "github profile"], category: "identity", shape: "short_text" },
    portfolio:       { patterns: ["portfolio", "website", "personal site", "personal url", "personal website", "home page"], category: "identity", shape: "short_text" },

    // ── Tier 1: Professional (from profile) ──
    currentCompany:  { patterns: ["current company", "current employer", "company name", "employer name", "present company"], category: "professional", shape: "short_text" },
    currentTitle:    { patterns: ["current title", "current role", "job title", "current position", "present title"], category: "professional", shape: "short_text" },
    yearsExp:        { patterns: ["years of experience", "how many years", "years experience", "total experience", "work experience", "years of relevant", "professional experience", "years of professional", "experience level", "years in industry", "years of work"], category: "professional", shape: "numeric" },
    skills:          { patterns: ["skills", "key skills", "technical skills", "core competencies"], category: "professional", shape: "short_text" },
    certifications:  { patterns: ["certifications", "certification", "certified", "licenses"], category: "professional", shape: "short_text" },
    education:       { patterns: ["education", "highest degree", "degree", "university", "school", "academic", "level of education", "education level", "highest level of education", "degree earned", "degree type", "what is your highest", "educational background", "degree completed"], category: "professional", shape: "enum_choice" },
    gradYear:        { patterns: ["graduation year", "year of graduation", "grad year", "when did you graduate"], category: "professional", shape: "numeric" },
    publications:    { patterns: ["publication", "publications", "research", "google scholar", "semantic scholar", "papers"], category: "professional", shape: "short_text" },

    // ── Tier 1: US Work Authorization ──
    workAuth:        { patterns: ["authorized to work", "legally authorized", "work authorization", "right to work", "eligible to work", "work in the u.s", "work in the us", "legally permitted", "employment eligibility", "authorization to work", "authorized for employment", "lawfully authorized", "legal right to work", "employment authorization", "us work authorization"], category: "authorization", shape: "boolean" },
    sponsorship:     { patterns: ["sponsorship", "sponsor", "visa", "h-1b", "h1b", "require sponsorship", "need sponsorship", "require visa", "employer sponsorship", "employment visa", "immigration", "visa sponsorship", "immigration sponsorship", "will you now or in the future require", "require employment visa"], category: "authorization", shape: "boolean" },
    visaType:        { patterns: ["visa type", "visa status", "immigration status", "opt", "cpt", "stem opt", "green card", "citizenship", "ead"], category: "authorization", shape: "short_text" },

    // ── Contextual (strict shapes — NOT essays) ──
    relocation:      { patterns: ["relocat", "willing to move", "open to moving", "open to relocation", "willing to relocate", "consider relocation", "able to relocate", "open to relocating"], category: "contextual", shape: "boolean" },
    remotePref:      { patterns: ["remote", "hybrid", "in-person", "on-site", "work from home", "in one of our offices"], category: "contextual", shape: "boolean" },
    travelWilling:   { patterns: ["travel", "travel willingness", "travel required", "willing to travel"], category: "contextual", shape: "boolean" },
    // dfwArea removed — was developer-specific, not multi-user safe
    locationPref:    { patterns: ["location preference", "preferred location", "preferred office", "which office"], category: "contextual", shape: "location" },
    shiftAvail:      { patterns: ["shift", "availability", "schedule preference", "working hours"], category: "contextual", shape: "short_text" },
    contractPref:    { patterns: ["contract", "full-time", "part-time", "employment type", "engagement type"], category: "contextual", shape: "enum_choice" },
    salaryExpect:    { patterns: ["salary expectation", "expected salary", "desired salary", "compensation expectation", "salary requirement"], category: "contextual", shape: "short_text" },
    startDateCtx:    { patterns: ["earliest start", "when can you start", "start date", "earliest you would", "available to start"], category: "contextual", shape: "date_or_timeline" },
    deadlines:       { patterns: ["deadline", "timeline consideration", "timeline constraints", "any deadlines"], category: "contextual", shape: "date_or_timeline" },
    timeBreakdown:   { patterns: ["ideal breakdown", "how do you spend", "time in a working week"], category: "contextual", shape: "short_text" },

    // ── Logistics (boolean / short) ──
    interviewedBefore: { patterns: ["interviewed before", "interviewed at", "ever interviewed", "previously applied", "applied before"], category: "logistics", shape: "boolean" },

    // ── Motivation (essay) ──
    whyCompany:      { patterns: ["why this company", "why do you want to work", "why are you interested in", "what interests you about", "what attracts you"], category: "motivation", shape: "essay" },
    whyRole:         { patterns: ["why this role", "why this position", "what excites you about this role", "interest in this role", "why are you applying"], category: "motivation", shape: "essay" },
    whyFit:          { patterns: ["why should we hire", "why are you a good fit", "what makes you a good candidate", "what do you bring"], category: "motivation", shape: "essay" },

    // ── Technical (essay for descriptions, enum for choices) ──
    techExperience:  { patterns: ["experience with", "proficiency in", "familiar with", "knowledge of", "expertise in", "worked with"], category: "technical", shape: "essay" },
    projectDesc:     { patterns: ["describe a project", "relevant project", "technical achievement", "most proud of", "piece of work"], category: "technical", shape: "essay" },
    codingLang:      { patterns: ["coding language", "programming language", "preferred language", "python or typescript", "interview language"], category: "technical", shape: "enum_choice" },
    researchBlog:    { patterns: ["research blog", "blog post", "next research"], category: "technical", shape: "essay" },
    engBackground:   { patterns: ["engineering background", "describe your background", "technical background"], category: "technical", shape: "essay" },
    cybersecurity:   { patterns: ["cybersecurity", "security product", "threat detection", "siem", "edr"], category: "technical", shape: "essay" },
    builtAI:         { patterns: ["built products", "integrate ai", "ai/ml models", "machine learning"], category: "technical", shape: "boolean" },
    rapidPrototyping:{ patterns: ["rapid prototyping", "direct customer", "working closely with research"], category: "technical", shape: "enum_choice" },

    // ── Behavioral (essay) ──
    leadership:      { patterns: ["leadership example", "led a team", "management experience", "leadership style"], category: "behavioral", shape: "essay" },
    conflict:        { patterns: ["conflict resolution", "disagreement", "handled a conflict", "difficult coworker"], category: "behavioral", shape: "essay" },
    failure:         { patterns: ["failure", "mistake", "learned from", "setback", "challenge you overcame"], category: "behavioral", shape: "essay" },
    teamwork:        { patterns: ["teamwork", "collaboration", "worked with a team", "team player", "cross-functional"], category: "behavioral", shape: "essay" },

    // ── Consent (boolean) ──
    termsConsent:    { patterns: ["terms", "terms of service", "terms and conditions", "agree to"], category: "consent", shape: "boolean" },
    privacyConsent:  { patterns: ["privacy", "privacy policy", "privacy notice", "data processing"], category: "consent", shape: "boolean" },
    smsConsent:      { patterns: ["sms", "text message", "receive text", "opt in", "opt-in", "messaging"], category: "consent", shape: "boolean" },
    bgCheck:         { patterns: ["background check", "background screening", "criminal record"], category: "consent", shape: "boolean" },
    aiPolicy:        { patterns: ["ai policy", "ai partnership", "confirm your understanding", "acknowledge"], category: "consent", shape: "boolean" },

    // ── Sensitive (review only) ──
    gender:          { patterns: ["gender"], category: "sensitive", excludePatterns: ["transgender"], shape: "enum_choice" },
    race:            { patterns: ["race"], category: "sensitive", shape: "enum_choice" },
    ethnicity:       { patterns: ["ethnicity", "ethnic", "hispanic", "latino", "latina", "latinx", "hispanic/latino"], category: "sensitive", shape: "enum_choice" },
    veteran:         { patterns: ["veteran"], category: "sensitive", shape: "enum_choice" },
    disability:      { patterns: ["disability", "disabled", "accommodation"], category: "sensitive", shape: "enum_choice" },

    // ── Open-ended (essay) ──
    additionalInfo:  { patterns: ["additional information", "anything else", "additional comments", "is there anything", "cover letter"], category: "openEnded", shape: "essay" },

    // ── Additional Patterns (expanded coverage) ──
    pronoun:         { patterns: ["pronoun", "pronouns", "preferred pronoun", "gender pronoun", "he/him", "she/her", "they/them"], category: "identity", shape: "enum_choice" },
    languagesSpoken: { patterns: ["languages spoken", "languages you speak", "fluent in", "language proficiency", "speak any other"], category: "professional", shape: "short_text" },
    salaryRange:     { patterns: ["salary range", "pay range", "desired pay", "expected compensation", "compensation range"], category: "contextual", shape: "short_text" },
    noticePeriod:    { patterns: ["notice period", "notice required", "how much notice", "current notice"], category: "contextual", shape: "date_or_timeline" },
    referralSource:  { patterns: ["how did you hear", "hear about us", "hear about this", "referral source", "source of application", "where did you find", "how did you find", "found this job", "learn about this", "discover this", "application source", "hear about the position", "hear about the role"], category: "logistics", shape: "enum_choice" },
    referralName:    { patterns: ["referral name", "referred by", "who referred", "referrer name"], category: "logistics", shape: "short_text" },
    ndaConsent:      { patterns: ["non-disclosure", "nda", "confidentiality agreement", "proprietary information"], category: "consent", shape: "boolean" },
    drugTest:        { patterns: ["drug test", "drug screen", "substance test", "pre-employment test"], category: "consent", shape: "boolean" },
    ageVerify:       { patterns: ["18 years", "over 18", "age requirement", "are you at least", "legal age"], category: "consent", shape: "boolean" },
    clearanceLevel:  { patterns: ["security clearance", "clearance level", "ts/sci", "top secret", "secret clearance"], category: "authorization", shape: "short_text" },

    // ── Login fields (safe-fill from stored profile) ──
    loginEmail:      { patterns: ["sign in", "log in", "login email", "username", "account email"], category: "login", shape: "short_text" },
    loginPassword:   { patterns: ["password", "passcode", "your password"], category: "login", shape: "short_text" },
  }

  // ── LAYER 2: UI Interaction Detection ──────────────────────────────────

  var INPUT_TYPES = {
    shortText:       { tags: ["INPUT"], types: ["text", "email", "tel", "url", "number", "date"] },
    longText:        { tags: ["TEXTAREA"] },
    nativeSelect:    { tags: ["SELECT"] },
    radio:           { tags: ["INPUT"], types: ["radio"] },
    checkbox:        { tags: ["INPUT"], types: ["checkbox"] },
    file:            { tags: ["INPUT"], types: ["file"] },
  }

  var CUSTOM_SELECT_SELECTORS = [
    // Standard ARIA
    '[role="combobox"]', '[role="listbox"]', '[aria-haspopup="listbox"]',
    // React-Select / CSS-based
    '[class*="select__control"]', '[class*="css-"][class*="control"]',
    '[class*="react-select"]', '[class*="SelectTrigger"]', '[class*="select-trigger"]',
    // Component libraries
    '[class*="chosen-container"]', '[class*="MuiSelect"]', '[class*="MuiAutocomplete"]',
    '[class*="ant-select"]', '[class*="dropdown-toggle"]',
    // Workday-specific
    '[data-automation-id*="select"]', '[data-automation-id*="dropdown"]',
    '[data-automation-id*="multiselectInputContainer"]',
    '[data-automation-id*="searchBox"]',
    // Greenhouse-specific
    '[class*="select-shell"]', '[class*="Select-control"]',
    // Lever / Ashby
    '[class*="Listbox"]', '[class*="listbox-trigger"]',
    // Generic custom dropdowns
    '[class*="combo-box"]', '[class*="combobox"]',
    '[aria-autocomplete="list"]', '[aria-autocomplete="both"]',
  ]

  // ── LAYER 3: Answer Strategy ───────────────────────────────────────────

  // 3-Tier answer strategy:
  //   Tier 1 (profile):     deterministic from stored profile — always safe
  //   Tier 2 (contextual):  AI with job context — location, remote, salary
  //   Tier 3 (review):      sensitive fields — NEVER auto-fill
  var ANSWER_STRATEGY = {
    // Tier 1 — Safe deterministic (profile data), fallback to AI if empty
    identity:      "profile",
    authorization: "profile_or_ai",  // work auth + sponsorship from stored prefs, AI if empty
    // Tier 1.5 — Rule-based with profile fallback
    consent:       "rules",
    logistics:     "profile_or_ai",  // interviewedBefore from prefs
    professional:  "profile_or_ai",
    // Tier 2 — Profile first, then AI (for relocation, start date, etc.)
    contextual:    "profile_or_ai", // checks stored pref first, falls to AI only if empty
    motivation:    "ai",
    technical:     "ai",
    behavioral:    "ai",
    openEnded:     "ai",
    // Tier 3 — Manual review only (NEVER auto-fill)
    sensitive:     "review_only",
    // Login — email only from profile, password NEVER auto-filled
    login:         "login_safe",
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CORE ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  // ── 1. Form Block Scanner ─────────────────────────────────────────────

  // ── Scan cache: avoid redundant re-scans when DOM hasn't changed ──
  var _scanCache = { hash: "", blocks: [], ts: 0 }
  var SCAN_CACHE_TTL = 2000  // cache valid for 2 seconds

  function scanPageHash() {
    var inputs = document.querySelectorAll("input, select, textarea")
    var ids = []
    for (var i = 0; i < Math.min(inputs.length, 8); i++) {
      ids.push(inputs[i].name || inputs[i].id || inputs[i].tagName)
    }
    return inputs.length + ":" + ids.join(",")
  }

  function scanPage(forceRefresh) {
    // Return cache if DOM unchanged and cache is fresh
    if (!forceRefresh && _scanCache.blocks.length > 0) {
      var now = Date.now()
      if (now - _scanCache.ts < SCAN_CACHE_TTL) {
        var currentHash = scanPageHash()
        if (currentHash === _scanCache.hash) {
          return _scanCache.blocks
        }
      }
    }

    var blocks = []
    var seen = new Set()
    var blockId = 0

    // Scan native form controls
    var elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), ' +
      'select, textarea'
    )
    // Also include password fields for safe login fill (email only)
    var pwFields = document.querySelectorAll('input[type="password"]')
    var allElements = Array.from(elements)
    for (var pi = 0; pi < pwFields.length; pi++) {
      if (!allElements.includes(pwFields[pi])) allElements.push(pwFields[pi])
    }
    elements = allElements

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i]
      if (seen.has(el)) continue
      if (!el.offsetParent && el.tagName !== "SELECT") continue // Skip invisible (but keep hidden selects)

      var type = detectInputType(el)
      if (type === "file") continue // Skip file uploads for now

      // Radio buttons: group by name
      if (type === "radio") {
        var groupName = el.name
        if (!groupName || seen.has("radio:" + groupName)) continue
        seen.add("radio:" + groupName)
        var block = buildBlock(el, type, ++blockId, groupName)
        if (block) blocks.push(block)
        continue
      }

      seen.add(el)
      var block = buildBlock(el, type, ++blockId)
      if (block) blocks.push(block)
    }

    // Scan custom dropdowns
    var customEls = document.querySelectorAll(CUSTOM_SELECT_SELECTORS.join(", "))
    for (var j = 0; j < customEls.length; j++) {
      var cel = customEls[j]
      if (!cel.offsetParent) continue
      if (seen.has(cel)) continue
      // Skip if container already has a native select we scanned
      var parentCtx = cel.closest("[class*='field'], [class*='question'], [class*='form-group']") || cel.parentElement
      if (parentCtx) {
        var nativeSel = parentCtx.querySelector("select")
        if (nativeSel && seen.has(nativeSel)) continue
      }
      seen.add(cel)
      var block = buildBlock(cel, "customSelect", ++blockId)
      if (block) blocks.push(block)
    }

    // Store in cache
    _scanCache.hash = scanPageHash()
    _scanCache.blocks = blocks
    _scanCache.ts = Date.now()

    return blocks
  }

  function detectInputType(el) {
    if (el.tagName === "SELECT" && el.multiple) return "multiSelect"
    if (el.tagName === "SELECT") return "nativeSelect"
    if (el.tagName === "TEXTAREA") return "longText"
    var t = (el.type || "text").toLowerCase()
    if (t === "radio") return "radio"
    if (t === "checkbox") return "checkbox"
    if (t === "file") return "file"
    if (t === "password") return "password"
    return "shortText"
  }

  function buildBlock(el, inputType, blockId, radioGroupName) {
    var container = findContainer(el)
    var questionText = readQuestionText(el, container)
    var helperText = readHelperText(el, container)
    var options = readOptions(el, inputType, container, radioGroupName)
    var currentValue = readCurrentValue(el, inputType, radioGroupName)
    var required = isRequired(el, container, questionText)

    // Classify
    var classification = classifyQuestion(questionText + " " + helperText, inputType, el)

    // Resolve answer
    // (done later in fillAll — we just tag the intent here)

    return {
      blockId:         blockId,
      element:         el,
      container:       container,
      questionText:    questionText,
      helperText:      helperText,
      inputType:       inputType,
      options:         options,
      required:        required,
      currentValue:    currentValue,
      isEmpty:         !currentValue || currentValue.trim() === "" || isPlaceholder(currentValue),
      intent:          classification.intent,
      category:        classification.category,
      confidence:      classification.confidence,
      answerShape:     classification.shape || "essay",
      suggestedAnswer: null,
      answerSource:    null,
      fillStrategy:    inputType,
      status:          "pending",
      selector:        getSelector(el),
      radioGroupName:  radioGroupName || null,
    }
  }

  // ── 2. Label & Context Readers ────────────────────────────────────────

  function findContainer(el) {
    // Walk up to find the field wrapper
    var node = el.parentElement
    for (var i = 0; i < 6; i++) {
      if (!node) return el.parentElement
      var cls = (node.className || "").toLowerCase()
      var role = (node.getAttribute("role") || "").toLowerCase()
      if (cls.includes("field") || cls.includes("question") || cls.includes("form-group") ||
          cls.includes("formfield") || cls.includes("form-row") || cls.includes("input-group") ||
          role === "group" || role === "radiogroup" || node.tagName === "FIELDSET") {
        return node
      }
      // If node has a label + input, it's likely the container
      if (node.querySelector("label") && node.querySelector("input, select, textarea")) {
        return node
      }
      node = node.parentElement
    }
    return el.parentElement?.parentElement || el.parentElement
  }

  function readQuestionText(el, container) {
    var texts = []

    // 1. aria-label
    var aria = el.getAttribute("aria-label")
    if (aria) texts.push(aria.trim())

    // 2. <label for="id">
    if (el.id) {
      var lbl = document.querySelector('label[for="' + el.id + '"]')
      if (lbl) texts.push(extractLabelText(lbl))
    }

    // 3. aria-labelledby
    var lblBy = el.getAttribute("aria-labelledby")
    if (lblBy) {
      var lblEl = document.getElementById(lblBy)
      if (lblEl) texts.push(lblEl.textContent.trim())
    }

    // 4. Wrapping <label>
    var parentLabel = el.closest("label")
    if (parentLabel) texts.push(extractLabelText(parentLabel))

    // 5. Container labels/headings
    if (container) {
      var headings = container.querySelectorAll("label, legend, h1, h2, h3, h4, h5, h6, strong, [class*='label'], [class*='Label'], [class*='title'], [data-testid*='label']")
      for (var i = 0; i < headings.length; i++) {
        var t = headings[i].textContent.trim()
        if (t.length > 1 && t.length < 200) texts.push(t)
      }
    }

    // 6. Previous sibling
    var prev = el.previousElementSibling
    if (prev && !prev.querySelector("input, select, textarea")) {
      var pt = prev.textContent.trim()
      if (pt.length > 1 && pt.length < 150) texts.push(pt)
    }

    // 7. Placeholder
    if (el.placeholder) texts.push(el.placeholder)

    // 8. name/id as fallback — heavily filter auto-generated IDs
    var nameId = (el.name || el.id || "")
      .replace(/[_\-\[\]]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim()
    // Skip: pure numbers, any string containing "question" + numbers, auto-generated hashes
    if (nameId && nameId.length > 2 &&
        !/^\d+$/.test(nameId) &&
        !/question.*\d{4,}/i.test(nameId) &&      // "question 14412335008 question answer"
        !/^[a-f0-9]{8,}$/i.test(nameId) &&         // hex hashes
        !/^(q|field|input|custom)\s*\d+/i.test(nameId) &&  // "q123", "field456"
        !/^\d+\s*(question|answer|field)/i.test(nameId)) { // "14412335008 question"
      texts.push(nameId)
    }

    // Deduplicate and filter junk
    var unique = []
    var seenLower = new Set()
    for (var j = 0; j < texts.length; j++) {
      var t = texts[j].replace(/\s+/g, " ").trim()
      if (!t || t.length < 2) continue
      if (seenLower.has(t.toLowerCase())) continue
      // Filter out generic/junk labels
      if (/^(select|select\.\.\.|choose|choose\.\.\.|--|option|none)$/i.test(t)) continue
      if (/^\d+$/.test(t)) continue
      if (/question.*\d{5,}/i.test(t)) continue  // Greenhouse IDs anywhere in string
      if (/^\d{5,}/.test(t)) continue             // Starts with long number
      seenLower.add(t.toLowerCase())
      unique.push(t)
    }

    // Return the shortest MEANINGFUL label — must contain at least one real word
    unique.sort(function(a, b) { return a.length - b.length })
    for (var k = 0; k < unique.length; k++) {
      var candidate = unique[k]
      // Must have letters, be >2 chars, <200 chars, and NOT be mostly numbers
      if (candidate.length > 2 && candidate.length < 200 &&
          /[a-zA-Z]{2,}/.test(candidate) &&  // At least 2 consecutive letters
          (candidate.replace(/[^a-zA-Z]/g, "").length > candidate.length * 0.3)) {  // >30% letters
        return candidate
      }
    }
    return unique[0] || ""
  }

  function extractLabelText(label) {
    // Get label text but exclude the input element text
    var clone = label.cloneNode(true)
    var inputs = clone.querySelectorAll("input, select, textarea, [class*='indicator']")
    for (var i = 0; i < inputs.length; i++) inputs[i].remove()
    return clone.textContent.trim()
  }

  function readHelperText(el, container) {
    if (!container) return ""
    // Look for helper/description text
    var helpers = container.querySelectorAll("[class*='helper'], [class*='description'], [class*='hint'], [class*='subtitle'], [role='note'], .text-muted, small, [class*='info']")
    var texts = []
    for (var i = 0; i < helpers.length; i++) {
      var t = helpers[i].textContent.trim()
      if (t.length > 5 && t.length < 500) texts.push(t)
    }
    // Also check aria-describedby
    var descId = el.getAttribute("aria-describedby")
    if (descId) {
      var descEl = document.getElementById(descId)
      if (descEl) texts.push(descEl.textContent.trim())
    }
    return texts.join(" | ").slice(0, 500)
  }

  function readOptions(el, inputType, container, radioGroupName) {
    if (inputType === "nativeSelect" || inputType === "multiSelect") {
      return Array.from(el.options).map(function(o) {
        return { text: o.text.trim(), value: o.value }
      }).filter(function(o) {
        return o.text && !isPlaceholder(o.text)
      })
    }
    if (inputType === "radio") {
      var radios = radioGroupName
        ? document.querySelectorAll('input[type="radio"][name="' + radioGroupName + '"]')
        : (container ? container.querySelectorAll('input[type="radio"]') : [])
      return Array.from(radios).map(function(r) {
        var lbl = r.closest("label") || document.querySelector('label[for="' + r.id + '"]')
        return { text: (lbl ? lbl.textContent.trim() : r.value), value: r.value, element: r }
      })
    }
    return []
  }

  function readCurrentValue(el, inputType, radioGroupName) {
    if (inputType === "shortText" || inputType === "longText") {
      return (el.value || "").trim()
    }
    if (inputType === "nativeSelect" || inputType === "multiSelect") {
      var opt = el.options[el.selectedIndex]
      if (!opt) return ""
      var text = opt.text.trim()
      if (!text || isPlaceholder(text) || el.selectedIndex <= 0) return ""
      return text
    }
    if (inputType === "radio") {
      var radios = radioGroupName
        ? document.querySelectorAll('input[type="radio"][name="' + radioGroupName + '"]')
        : []
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
          var lbl = radios[i].closest("label")
          return lbl ? lbl.textContent.trim() : radios[i].value
        }
      }
      return ""
    }
    if (inputType === "checkbox") {
      return el.checked ? "checked" : ""
    }
    if (inputType === "customSelect") {
      var display = (el.textContent || "").trim()
      if (!display || isPlaceholder(display)) return ""
      return el.textContent.trim()
    }
    return ""
  }

  function isRequired(el, container, questionText) {
    if (el.required || el.getAttribute("aria-required") === "true") return true
    if (questionText.includes("*")) return true
    if (container) {
      var asterisk = container.querySelector("[class*='required'], [class*='asterisk']")
      if (asterisk) return true
    }
    return false
  }

  function getSelector(el) {
    if (el.id) return "#" + CSS.escape(el.id)
    if (el.name) return "[name='" + CSS.escape(el.name) + "']"
    // Build a path
    var path = []
    var node = el
    while (node && node !== document.body) {
      var tag = node.tagName.toLowerCase()
      if (node.id) { path.unshift("#" + CSS.escape(node.id)); break }
      var idx = 1
      var sib = node.previousElementSibling
      while (sib) { if (sib.tagName === node.tagName) idx++; sib = sib.previousElementSibling }
      path.unshift(tag + ":nth-of-type(" + idx + ")")
      node = node.parentElement
    }
    return path.join(" > ")
  }

  // ── 3. Question Classifier ────────────────────────────────────────────

  function classifyQuestion(text, inputType, el) {
    var textLower = text.toLowerCase()

    // Try each intent pattern
    var bestIntent = "unknown"
    var bestCategory = "unknown"
    var bestConfidence = 0

    for (var intent in INTENT_PATTERNS) {
      var def = INTENT_PATTERNS[intent]

      // Check maxLabelLen constraint (e.g., "country" should only match short labels)
      if (def.maxLabelLen && textLower.length > def.maxLabelLen) continue

      // Check excludePatterns
      if (def.excludePatterns) {
        var excluded = false
        for (var e = 0; e < def.excludePatterns.length; e++) {
          if (textLower.includes(def.excludePatterns[e])) { excluded = true; break }
        }
        if (excluded) continue
      }

      for (var p = 0; p < def.patterns.length; p++) {
        var pattern = def.patterns[p]
        var confidence = 0

        if (textLower === pattern) confidence = 100
        else if (textLower.startsWith(pattern + " ") || textLower.startsWith(pattern + "?") || textLower.startsWith(pattern + "*")) confidence = 95
        else if (textLower.includes(pattern)) {
          // Score based on how much of the label the pattern covers
          confidence = Math.min(90, 50 + Math.round((pattern.length / textLower.length) * 50))
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestIntent = intent
          bestCategory = def.category
        }
      }
    }

    // Get shape from matched intent
    var bestShape = "essay"  // default
    if (bestIntent !== "unknown" && INTENT_PATTERNS[bestIntent]) {
      bestShape = INTENT_PATTERNS[bestIntent].shape || "essay"
    }

    // ── Shape inference from input type when intent is unknown ──
    // ALL unknown fields go to AI — never skip a blank field
    if (bestIntent === "unknown") {
      bestCategory = "openEnded"  // Route to AI
      if (inputType === "longText") {
        bestShape = "essay"
        bestConfidence = 50
      }
      else if (inputType === "nativeSelect" || inputType === "customSelect" || inputType === "multiSelect") {
        bestShape = "enum_choice"
        bestCategory = "contextual"
        bestConfidence = 50
      }
      else if (inputType === "shortText") {
        bestShape = "short_text"
        bestConfidence = 40
      }
    }

    // ── Shape override from input type ──
    // If the field IS a dropdown/select, the answer MUST be an option pick,
    // regardless of what the intent's default shape is.
    // This is the #1 reason option fields fail: the engine resolves a free-text
    // answer ("Texas", "Yes") but the field requires choosing from a list.
    if (inputType === "nativeSelect" || inputType === "customSelect" || inputType === "multiSelect") {
      if (bestShape !== "enum_choice") {
        bestShape = "enum_choice"
      }
    }

    // If the field is a radio group, force boolean or enum_choice
    if (inputType === "radio") {
      if (bestShape !== "boolean" && bestShape !== "enum_choice") {
        bestShape = "boolean"
      }
    }

    // ── Shape override from question text patterns ──
    // These catch questions the intent system missed
    if (bestShape === "essay" || bestShape === "short_text") {
      var tl = textLower
      // Boolean patterns — force boolean shape
      if (/^(are you|do you|have you|will you|is your|can you|would you|did you)/.test(tl) &&
          !tl.includes("describe") && !tl.includes("explain") && !tl.includes("tell us") &&
          tl.length < 100) {
        bestShape = "boolean"
      }
      // Numeric patterns
      if (/how many|number of|years of|total years|amount of/.test(tl)) {
        bestShape = "numeric"
      }
      // Timeline patterns
      if (/deadline|timeline|when.*start|earliest|notice period|how soon/.test(tl) && !tl.includes("describe")) {
        bestShape = "date_or_timeline"
      }
    }

    return { intent: bestIntent, category: bestCategory, confidence: bestConfidence, shape: bestShape }
  }

  // ── 4. Answer Resolver ────────────────────────────────────────────────

  // Simple hash for question text → used as answer memory key
  function hashQuestion(text) {
    var hash = 0
    var s = text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i)
      hash = hash & hash  // Convert to 32bit integer
    }
    return "q_" + Math.abs(hash).toString(36)
  }

  function resolveAnswer(block, profileData) {
    var strategy = ANSWER_STRATEGY[block.category] || "ai"
    var intent = block.intent
    var pd = profileData

    // ── Tier 3: Sensitive — ALWAYS review, never auto-fill ──
    if (strategy === "review_only") {
      return { value: null, source: "needsReview", confidence: "review" }
    }

    // ── Login — only fill email, NEVER fill password ──
    if (strategy === "login_safe") {
      if (intent === "loginEmail" && pd.email) {
        return { value: pd.email, source: "profile", confidence: "medium" }
      }
      // Password fields: NEVER auto-fill for security
      return { value: null, source: "needsReview", confidence: "review" }
    }

    // ── Tier 1: Profile-based answers (deterministic) ──
    if (strategy === "profile" || strategy === "profile_or_ai") {
      var profileAnswer = getProfileAnswer(intent, pd)
      if (profileAnswer !== null && profileAnswer !== undefined && profileAnswer !== "") {
        return { value: profileAnswer, source: "profile", confidence: "high" }
      }
      if (strategy === "profile") {
        return { value: null, source: "none", confidence: "low" }
      }
    }

    // ── Tier 1.5: Rule-based answers ──
    if (strategy === "rules") {
      var ruleAnswer = getRuleAnswer(intent, pd, block)
      if (ruleAnswer !== null && ruleAnswer !== "") {
        return { value: ruleAnswer, source: "rules", confidence: "high" }
      }
      return { value: null, source: "none", confidence: "low" }
    }

    // ── Tier 1.75: Answer memory — check if user previously answered this question ──
    if (pd.answerMemory) {
      var qHash = hashQuestion(block.questionText)
      if (pd.answerMemory[qHash]) {
        return { value: pd.answerMemory[qHash], source: "memory", confidence: "high" }
      }
    }

    // ── Tier 2: Contextual — location preference from profile ──
    if (strategy === "ai" && block.category === "contextual") {
      if (intent === "locationPref" && pd.location) {
        return { value: pd.location, source: "profile", confidence: "medium" }
      }
    }

    // ── Tier 2: AI contextual (uses job description + user location) ──
    return { value: null, source: "ai", confidence: "medium" }
  }

  function getProfileAnswer(intent, pd) {
    // Parse US location: "Arlington, Texas" → city + normalized state
    var locParts = (pd.location || "").split(",").map(function(s) { return s.trim() })
    var cityVal = locParts[0] || ""
    var rawState = locParts[1] || ""
    var stateInfo = normalizeState(rawState)
    var yearsCalc = calculateYearsExperience(pd)

    var map = {
      // Tier 1: Identity — US-formatted
      firstName: pd.firstName,
      lastName: pd.lastName,
      fullName: pd.fullName || ((pd.firstName || "") + " " + (pd.lastName || "")).trim(),
      preferredName: pd.firstName,
      email: pd.email,
      phone: pd.phone,
      address: pd.address || pd.location,
      city: cityVal,
      state: stateInfo.full || stateInfo.abbr || rawState,  // Try full, then abbr, then raw
      zip: pd.zip || pd.zipCode || "",
      location: pd.location,
      linkedin: pd.linkedin,
      github: pd.github,
      portfolio: pd.portfolio,
      country: "United States of America",
      // Tier 1: US Work Authorization
      workAuth: pd.workAuthorization || "",
      sponsorship: pd.sponsorship || "",
      visaType: pd.visaStatus || pd.visaType || "",
      // Contextual with stored fallback
      relocation: pd.relocation || "",  // "Yes"/"No" — NOT the location itself
      remotePref: pd.remotePref || "",
      interviewedBefore: pd.interviewedBefore || "",
      startDateCtx: pd.earliestStart || "",
      deadlines: "",  // Usually empty / "No deadlines"
      // Tier 1: Professional
      currentCompany: pd.headline || pd.currentCompany || "",
      currentTitle: pd.currentTitle || pd.headline || "",
      publications: pd.publications || "",
      yearsExp: yearsCalc,
      skills: pd.skills || "",
      education: pd.education || pd.degree || "",
      gradYear: pd.gradYear || "",
      // Logistics
      interviewedBefore: pd.interviewedBefore || "",
      referralSource: pd.referralSource || "",
      referralName: pd.referralName || "",
      // Extended
      pronoun: pd.pronoun || "",
      languagesSpoken: pd.languages || "English",
      noticePeriod: pd.noticePeriod || "",
      salaryRange: pd.salaryExpectation || "",
      clearanceLevel: pd.securityClearance || "",
    }
    return map[intent] !== undefined ? map[intent] : null
  }

  function getRuleAnswer(intent, pd, block) {
    // Only consent-type fields use rules — everything else is profile or AI
    var map = {
      termsConsent:      true,
      privacyConsent:    true,
      aiPolicy:          "Yes",
      ndaConsent:        true,
      drugTest:          "Yes",
      ageVerify:         "Yes",
      bgCheck:           "Yes",
      smsConsent:        true,
    }
    return map[intent] !== undefined ? map[intent] : null
  }

  // ── 5. Fill Executor ──────────────────────────────────────────────────

  // ── Option-aware answer adaptation ──
  // When we know the field has options, adapt the answer to match the best
  // available option BEFORE attempting the fill. This prevents "Yes" from
  // failing against options like "Yes, I am legally authorized...".
  //
  // Also handles:
  // - Education: "Master's" → "Master's Degree" or "MS"
  // - Years of experience: "5" → "3-5 years" or "5+ years"
  // - Salary: "$100,000" → "$80,000 - $120,000"

  var EDUCATION_EQUIVALENCES = {
    "bachelor": ["bachelor", "bachelors", "bachelor's", "bs", "ba", "b.s.", "b.a.", "undergraduate", "4-year degree", "four year"],
    "master": ["master", "masters", "master's", "ms", "ma", "m.s.", "m.a.", "mba", "m.b.a.", "graduate degree", "graduate"],
    "doctorate": ["doctorate", "doctoral", "phd", "ph.d.", "doctor of philosophy", "d.sc."],
    "associate": ["associate", "associates", "associate's", "as", "aa", "a.s.", "a.a.", "2-year degree", "two year"],
    "high school": ["high school", "ged", "g.e.d.", "secondary", "diploma"],
  }

  function adaptAnswerToOptions(value, options, intent) {
    if (!options || options.length === 0) return value
    var vn = normalize(String(value))

    // Try direct fuzzy match first — if score >= 80, no adaptation needed
    var directBest = 0
    for (var i = 0; i < options.length; i++) {
      var score = fuzzyMatch(vn, normalize(options[i].text || options[i]))
      if (score >= 80) return value  // Already good enough
      if (score > directBest) directBest = score
    }

    // ── Intent-specific adaptation ──

    // Education: map to best matching degree level
    if (intent === "education") {
      for (var eduKey in EDUCATION_EQUIVALENCES) {
        var eduGroup = EDUCATION_EQUIVALENCES[eduKey]
        var valueMatchesGroup = false
        for (var eg = 0; eg < eduGroup.length; eg++) {
          if (vn.includes(eduGroup[eg])) { valueMatchesGroup = true; break }
        }
        if (valueMatchesGroup) {
          // Find the option that matches this education level
          for (var oi = 0; oi < options.length; oi++) {
            var optText = normalize(options[oi].text || options[oi])
            for (var eg2 = 0; eg2 < eduGroup.length; eg2++) {
              if (optText.includes(eduGroup[eg2])) return options[oi].text || options[oi]
            }
          }
        }
      }
    }

    // Years of experience: "5" → match "3-5 years" or "5-7 years" or "5+ years"
    if (intent === "yearsExp") {
      var numVal = parseInt(vn, 10)
      if (!isNaN(numVal)) {
        var bestOptIdx = -1, bestOptDist = Infinity
        for (var yi = 0; yi < options.length; yi++) {
          var optText = normalize(options[yi].text || options[yi])
          // Extract numeric range from option: "3-5 years", "5+ years", "5 to 7"
          var rangeMatch = optText.match(/(\d+)\s*[-–to]+\s*(\d+)/)
          var plusMatch = optText.match(/(\d+)\+/)
          var exactMatch = optText.match(/^(\d+)\s*(year|yr)/)

          if (rangeMatch) {
            var lo = parseInt(rangeMatch[1], 10), hi = parseInt(rangeMatch[2], 10)
            if (numVal >= lo && numVal <= hi) return options[yi].text || options[yi]
            var dist = numVal < lo ? lo - numVal : numVal - hi
            if (dist < bestOptDist) { bestOptDist = dist; bestOptIdx = yi }
          } else if (plusMatch) {
            var threshold = parseInt(plusMatch[1], 10)
            if (numVal >= threshold) return options[yi].text || options[yi]
            var dist2 = Math.abs(numVal - threshold)
            if (dist2 < bestOptDist) { bestOptDist = dist2; bestOptIdx = yi }
          } else if (exactMatch) {
            if (numVal === parseInt(exactMatch[1], 10)) return options[yi].text || options[yi]
          }
        }
        if (bestOptIdx >= 0 && bestOptDist <= 3) return options[bestOptIdx].text || options[bestOptIdx]
      }
    }

    // State: try both full name and abbreviation
    if (intent === "state") {
      var stNorm = normalizeState(vn)
      for (var si = 0; si < options.length; si++) {
        var sOpt = normalize(options[si].text || options[si])
        var sOptNorm = normalizeState(sOpt)
        if (stNorm.abbr && sOptNorm.abbr && stNorm.abbr === sOptNorm.abbr) {
          return options[si].text || options[si]  // Return the option's exact text
        }
      }
    }

    // Country: try all variants
    if (intent === "country") {
      var cvn = normalize(value)
      for (var ck in COUNTRY_VARIANTS) {
        var cvars = COUNTRY_VARIANTS[ck]
        if (cvars.indexOf(cvn) !== -1) {
          // Try each variant against the options
          for (var cvi = 0; cvi < cvars.length; cvi++) {
            for (var coi = 0; coi < options.length; coi++) {
              if (normalize(options[coi].text || options[coi]).includes(cvars[cvi])) {
                return options[coi].text || options[coi]
              }
            }
          }
        }
      }
    }

    return value  // No adaptation possible
  }

  function fillBlock(block, value) {
    if (!value && value !== true && value !== false) return { ok: false, reason: "no value" }

    var el = block.element
    var strValue = String(value)
    var rawValue = strValue
    var adaptRule = null

    // ── Adapt answer to available options for select/radio fields ──
    if ((block.inputType === "nativeSelect" || block.inputType === "multiSelect" || block.inputType === "radio") && block.options && block.options.length > 0) {
      var adapted = String(adaptAnswerToOptions(value, block.options, block.intent))
      if (adapted !== strValue) {
        adaptRule = detectAdaptRule(strValue, adapted, block.intent)
        strValue = adapted
      }
    }

    // ── Log for option-based fields ──
    var isOptionField = block.inputType === "nativeSelect" || block.inputType === "multiSelect" || block.inputType === "radio" || block.inputType === "customSelect"
    var result

    switch (block.inputType) {
      case "shortText":
      case "longText":
      case "password":
        return fillText(el, strValue)

      case "nativeSelect":
        result = fillNativeSelect(el, strValue, block.options)
        break

      case "multiSelect":
        result = fillMultiSelect(el, strValue, block.options)
        break

      case "radio":
        result = fillRadio(block, strValue)
        break

      case "checkbox":
        return fillCheckbox(el, value)

      case "customSelect":
        // This needs async — return a marker
        return { ok: false, reason: "needs_async", asyncType: "customSelect" }

      default:
        return { ok: false, reason: "unknown input type" }
    }

    // ── Option-field trace ──
    if (isOptionField) {
      var trace = {
        label: (block.questionText || "").slice(0, 50),
        intent: block.intent,
        shape: block.answerShape,
        fieldType: block.inputType,
        rawAnswer: rawValue.slice(0, 40),
        adaptedAnswer: strValue.slice(0, 40),
        adapted: rawValue !== strValue,
        adaptRule: adaptRule,
        strategy: result.method || null,
        selectedOption: result.selected ? result.selected.slice(0, 50) : null,
        score: result.score || null,
        ok: result.ok,
        reason: result.reason || null,
      }

      // ── Polarity guard: detect opposite-option mistakes ──
      if (result.ok && result.selected) {
        var intendedPol = valuePolarity(rawValue)
        var selectedPol = radioPolarity(normalize(result.selected))
        if (intendedPol !== "neutral" && selectedPol !== "neutral" && intendedPol !== selectedPol) {
          // WRONG POLARITY — override to failure
          trace.polarityMismatch = true
          trace.intendedPolarity = intendedPol
          trace.selectedPolarity = selectedPol
          console.error("[YH-Option] POLARITY MISMATCH — blocking wrong selection:", JSON.stringify(trace))
          // Undo the selection
          if (block.inputType === "nativeSelect") {
            el.selectedIndex = 0
            el.dispatchEvent(new Event("change", { bubbles: true }))
          }
          highlightEl(el, "error")
          return { ok: false, reason: "polarity_mismatch: intended " + intendedPol + " but selected " + selectedPol }
        }
      }

      if (result.ok) {
        console.log("[YH-Option] ✓", JSON.stringify(trace))
      } else {
        console.warn("[YH-Option] ✗", JSON.stringify(trace))
      }
    }

    return result
  }

  // ── Detect which adaptation rule transformed the answer ──
  function detectAdaptRule(raw, adapted, intent) {
    var rn = normalize(raw), an = normalize(adapted)
    if (intent === "state") {
      var rs = normalizeState(raw), as2 = normalizeState(adapted)
      if (rs.abbr === as2.abbr) return "state_normalization: " + raw + " → " + adapted
    }
    if (intent === "country") return "country_variant: " + raw + " → " + adapted
    if (intent === "education") {
      for (var ek in EDUCATION_EQUIVALENCES) {
        var eg = EDUCATION_EQUIVALENCES[ek]
        if (eg.some(function(e) { return rn.includes(e) }) && eg.some(function(e) { return an.includes(e) })) {
          return "education_equiv(" + ek + "): " + raw + " → " + adapted
        }
      }
    }
    if (intent === "yearsExp") return "years_range: " + raw + " → " + adapted
    return "fuzzy_adapt: " + raw + " → " + adapted
  }

  function fillText(el, value) {
    try {
      el.focus()
      // Clear first (some React forms need this)
      el.value = ""
      el.dispatchEvent(new Event("input", { bubbles: true }))

      // Use React-compatible setter (React 16+ uses synthetic events)
      var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      var setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
      if (setter) setter.call(el, value)
      else el.value = value

      // Fire comprehensive events for React/Angular/Vue compatibility
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }))
      el.dispatchEvent(new Event("blur", { bubbles: true }))
      // React 17+ may need nativeInputValueSetter
      try {
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        nativeInputValueSetter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      } catch(e) {}
      highlightEl(el, "success")
      return { ok: true, method: "text" }
    } catch (e) {
      return { ok: false, reason: e.message }
    }
  }

  // ── Fuzzy text normalization ──
  function normalize(s) {
    return (s || "").toLowerCase().trim()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, " ")
  }

  // ── US State abbreviation map ──
  var US_STATES = {
    "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
    "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
    "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA",
    "kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD",
    "massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO",
    "montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ",
    "new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH",
    "oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
    "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
    "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
    "district of columbia":"DC",
  }
  // Reverse map: abbreviation → full name
  var US_STATES_REV = {}
  for (var st in US_STATES) US_STATES_REV[US_STATES[st].toLowerCase()] = st

  function normalizeState(input) {
    var s = (input || "").trim().toLowerCase()
    // If it's already an abbreviation
    if (s.length === 2 && US_STATES_REV[s]) return { abbr: s.toUpperCase(), full: US_STATES_REV[s].replace(/\b\w/g, function(c) { return c.toUpperCase() }) }
    // If it's a full name
    if (US_STATES[s]) return { abbr: US_STATES[s], full: s.replace(/\b\w/g, function(c) { return c.toUpperCase() }) }
    return { abbr: s.toUpperCase(), full: input || "" }
  }

  // ── Experience years calculation ──
  function calculateYearsExperience(pd) {
    // Try explicit value first
    if (pd.yearsExperience) return pd.yearsExperience
    // Calculate from profile experiences
    if (!pd.experiences || !pd.experiences.length) return ""
    var totalMonths = 0
    var now = new Date()
    for (var i = 0; i < pd.experiences.length; i++) {
      var exp = pd.experiences[i]
      var start = exp.startDate ? new Date(exp.startDate) : null
      var end = exp.current ? now : (exp.endDate ? new Date(exp.endDate) : null)
      if (start && end && !isNaN(start) && !isNaN(end)) {
        totalMonths += Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()))
      }
    }
    var years = Math.round(totalMonths / 12)
    return years > 0 ? String(years) : ""
  }

  // Equivalence groups for fuzzy matching
  var EQUIVALENCES = {
    "yes": ["yes", "true", "y", "si", "oui", "yeah", "yep", "affirmative"],
    "no": ["no", "false", "n", "non", "nope", "nah", "negative"],
    "united states": ["united states", "united states of america", "usa", "us", "u.s.", "u.s.a.", "america", "+1"],
    "male": ["male", "man", "m", "masculine"],
    "female": ["female", "woman", "f", "feminine"],
    "i am not a protected veteran": ["i am not a protected veteran", "not a protected veteran", "not a veteran", "no veteran status", "i am not a veteran"],
    "no, i do not have a disability": ["no, i do not have a disability", "i do not have a disability", "no disability", "not disabled"],
    "i do not want to answer": ["i do not want to answer", "prefer not to say", "decline to answer", "prefer not to disclose", "i don't wish to answer"],
    "authorized": ["authorized", "yes, i am authorized", "yes i am authorized", "yes", "i am authorized"],
    "not authorized": ["not authorized", "no, i am not authorized", "no i am not authorized", "no"],
    "will not require": ["will not require", "no, i will not", "no i will not", "no", "will not need"],
    "will require": ["will require", "yes, i will", "yes i will", "yes", "will need"],
  }

  function fuzzyMatch(value, optionText) {
    var vn = normalize(value)
    var on = normalize(optionText)
    if (!vn || !on) return 0

    // Tier 1: exact text match (100)
    if (vn === on) return 100

    // Tier 2: normalized/synonym match via equivalence groups (95)
    for (var key in EQUIVALENCES) {
      var group = EQUIVALENCES[key]
      var vInGroup = group.indexOf(vn) !== -1 || vn.includes(key)
      var oInGroup = group.indexOf(on) !== -1 || on.includes(key)
      if (vInGroup && oInGroup) return 95
    }

    // Tier 3: startsWith match (80)
    if (on.startsWith(vn) || vn.startsWith(on)) return 80

    // Tier 4: numeric range match — "5" matches "3-5 years" (75)
    var numVal = parseFloat(vn)
    if (!isNaN(numVal) && on.length < 30) {
      var rangeMatch = on.match(/(\d+)\s*[-–to]+\s*(\d+)/)
      if (rangeMatch) {
        var lo = parseFloat(rangeMatch[1]), hi = parseFloat(rangeMatch[2])
        if (numVal >= lo && numVal <= hi) return 75
      }
      var plusMatch = on.match(/(\d+)\+/)
      if (plusMatch && numVal >= parseFloat(plusMatch[1])) return 75
    }

    // Tier 5: contains match (60 if option contains value, 50 if reverse)
    if (on.includes(vn)) return 60
    if (vn.includes(on) && on.length > 3) return 50

    // Tier 6: word overlap (40 + 10 per word)
    var vWords = vn.split(" ").filter(function(w) { return w.length > 2 })
    var oWords = on.split(" ").filter(function(w) { return w.length > 2 })
    var overlap = vWords.filter(function(w) { return oWords.indexOf(w) !== -1 }).length
    if (overlap > 0 && overlap >= Math.min(vWords.length, oWords.length) * 0.5) return 40 + overlap * 10

    return 0
  }

  // ── Placeholder patterns — never pick these as an answer ──
  var PLACEHOLDER_PATTERNS = /^(choose|select|--|please select|pick one|-- select --|select\.\.\.|choose\.\.\.|select an option|please choose|-- choose --|none selected|pick a|select one)$/i

  function isPlaceholder(text) {
    var t = (text || "").trim()
    if (!t || t.length < 1) return true
    if (PLACEHOLDER_PATTERNS.test(t)) return true
    // Also skip options that are just whitespace or dashes
    if (/^[-–—\s]+$/.test(t)) return true
    return false
  }

  function fillNativeSelect(el, value, options) {
    var valueLower = normalize(value)
    var portal = detectPortal()

    // GUARD: Long values aren't for dropdowns
    if (valueLower.length > 80) {
      return { ok: false, reason: "value too long for select dropdown" }
    }

    // ── Score all non-placeholder options ──
    var bestMatch = null
    var bestScore = 0

    for (var i = 0; i < el.options.length; i++) {
      var opt = el.options[i]
      var t = normalize(opt.text)
      var v = normalize(opt.value)

      // Skip placeholders — never pick "Choose", "Select", "--", etc.
      if (isPlaceholder(opt.text) || isPlaceholder(opt.value)) continue
      if (!t && !v) continue

      var score = Math.max(fuzzyMatch(valueLower, t), fuzzyMatch(valueLower, v))

      // Exact value match bonus
      if (v === valueLower) score = Math.max(score, 100)

      // Boolean normalization
      if (value === true && (t === "yes" || v === "true" || v === "1")) score = Math.max(score, 90)
      if (value === false && (t === "no" || v === "false" || v === "0")) score = Math.max(score, 90)

      // US State normalization
      var valState = normalizeState(valueLower)
      var optState = normalizeState(t)
      if (valState.abbr && optState.abbr && valState.abbr === optState.abbr) score = Math.max(score, 95)

      // Polarity scoring for yes/no selects
      var vPol = valuePolarity(valueLower)
      if (vPol !== "neutral") {
        var oPol = radioPolarity(t)
        if (oPol === vPol && score >= 30) score = Math.max(score, 85)
        else if (oPol !== "neutral" && oPol !== vPol) score = Math.min(score, 20)
      }

      // Education equivalence
      for (var ek in EDUCATION_EQUIVALENCES) {
        var eGroup = EDUCATION_EQUIVALENCES[ek]
        var valInEdu = false, optInEdu = false
        for (var eg = 0; eg < eGroup.length; eg++) {
          if (valueLower.includes(eGroup[eg])) valInEdu = true
          if (t.includes(eGroup[eg])) optInEdu = true
        }
        if (valInEdu && optInEdu) score = Math.max(score, 90)
      }

      if (score > bestScore) { bestScore = score; bestMatch = opt }
    }

    // ── Auto-fallback when score < 40 ──
    if (!bestMatch || bestScore < 40) {
      // Fallback 1: try state normalization if value looks like a state
      var stFallback = normalizeState(valueLower)
      if (stFallback.abbr && stFallback.full) {
        var altValues = [stFallback.full, stFallback.abbr]
        for (var av = 0; av < altValues.length; av++) {
          for (var fi = 0; fi < el.options.length; fi++) {
            if (isPlaceholder(el.options[fi].text)) continue
            var ft = normalize(el.options[fi].text)
            if (ft === normalize(altValues[av]) || ft.startsWith(normalize(altValues[av]))) {
              bestMatch = el.options[fi]; bestScore = 75; break
            }
          }
          if (bestMatch && bestScore >= 75) break
        }
      }

      // Fallback 2: for boolean values, pick the first option with matching polarity
      if (bestScore < 40) {
        var fbPol = valuePolarity(valueLower)
        if (fbPol !== "neutral") {
          for (var pi = 0; pi < el.options.length; pi++) {
            if (isPlaceholder(el.options[pi].text)) continue
            var pOpt = normalize(el.options[pi].text)
            if (radioPolarity(pOpt) === fbPol) {
              bestMatch = el.options[pi]; bestScore = 70
              console.log("[YH-Fill] polarity fallback: '" + el.options[pi].text.trim().slice(0, 40) + "' for value '" + value + "'")
              break
            }
          }
        }
      }

      // Fallback 3: try country variants
      if (bestScore < 40) {
        for (var ck in COUNTRY_VARIANTS) {
          var cvars = COUNTRY_VARIANTS[ck]
          if (cvars.indexOf(valueLower) !== -1) {
            for (var cvi = 0; cvi < cvars.length; cvi++) {
              for (var coi = 0; coi < el.options.length; coi++) {
                if (isPlaceholder(el.options[coi].text)) continue
                if (normalize(el.options[coi].text).includes(cvars[cvi])) {
                  bestMatch = el.options[coi]; bestScore = 80; break
                }
              }
              if (bestScore >= 80) break
            }
            break
          }
        }
      }
    }

    // Still no match after fallbacks
    if (!bestMatch || bestScore < 40) {
      var availableOpts = []
      for (var d = 0; d < Math.min(el.options.length, 10); d++) {
        if (!isPlaceholder(el.options[d].text)) availableOpts.push(el.options[d].text.trim().slice(0, 30))
      }
      console.warn("[YH-Fill] select miss:", JSON.stringify({
        portal: portal,
        intended: value,
        bestScore: bestScore,
        bestMatch: bestMatch ? bestMatch.text.trim().slice(0, 30) : null,
        optionCount: el.options.length,
        sampleOptions: availableOpts,
      }))
      return { ok: false, reason: "no matching option for: " + value }
    }

    // ── Multi-strategy commit: try strategies in order until committed ──
    var prevIndex = el.selectedIndex
    var committed = false
    var commitSignals = { valueUpdated: false, indexChanged: false, displayMatches: false }
    var usedStrategy = null

    // Strategy A: direct selectedIndex assignment (most reliable)
    for (var si = 0; si < el.options.length; si++) {
      if (el.options[si] === bestMatch) {
        el.selectedIndex = si
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        usedStrategy = "selectedIndex"
        break
      }
    }
    committed = checkSelectCommitted(el, bestMatch, prevIndex, commitSignals)

    // Strategy B: React-compatible value setter + events
    if (!committed) {
      var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      if (setter) setter.call(el, bestMatch.value)
      else el.value = bestMatch.value
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      // React 17+ may need nativeInputValueSetter pattern
      try {
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set
        nativeSetter.call(el, bestMatch.value)
        el.dispatchEvent(new Event("change", { bubbles: true }))
      } catch(e) {}
      usedStrategy = "valueSetter"
      committed = checkSelectCommitted(el, bestMatch, prevIndex, commitSignals)
    }

    // Strategy C: simulate click on the option node (for frameworks that listen to clicks)
    if (!committed) {
      bestMatch.selected = true
      bestMatch.setAttribute("selected", "selected")
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      usedStrategy = "optionClick"
      committed = checkSelectCommitted(el, bestMatch, prevIndex, commitSignals)
    }

    if (committed) {
      highlightEl(el, "success")
    } else {
      console.warn("[YH-Option] select not committed after 3 strategies:", JSON.stringify({
        portal: portal,
        value: value,
        selected: bestMatch.text.trim().slice(0, 30),
        signals: commitSignals,
      }))
      highlightEl(el, "error")
    }

    return { ok: committed, method: "select", selected: bestMatch.text, score: bestScore, strategy: usedStrategy, commitSignals: commitSignals }
  }

  // ── Committed check helper for native selects ──
  function checkSelectCommitted(el, bestMatch, prevIndex, signals) {
    signals.valueUpdated = (el.value === bestMatch.value)
    signals.indexChanged = (el.selectedIndex !== prevIndex || el.selectedIndex > 0)
    var currentOpt = el.options[el.selectedIndex]
    signals.displayMatches = currentOpt ? (normalize(currentOpt.text).includes(normalize(bestMatch.text).slice(0, 10))) : false
    return signals.valueUpdated && (signals.indexChanged || signals.displayMatches)
  }

  // ── Multi-select fill (select[multiple]) ──
  // Value can be comma-separated: "Python, JavaScript, React"
  function fillMultiSelect(el, value, options) {
    var items = String(value).split(/[,;]/).map(function(s) { return s.trim() }).filter(function(s) { return s.length > 0 })
    if (items.length === 0) return { ok: false, reason: "no items to select" }

    var selected = []
    for (var ii = 0; ii < items.length; ii++) {
      var itemLower = normalize(items[ii])
      var bestIdx = -1, bestScore = 0
      for (var oi = 0; oi < el.options.length; oi++) {
        if (isPlaceholder(el.options[oi].text)) continue
        var score = Math.max(
          fuzzyMatch(itemLower, normalize(el.options[oi].text)),
          fuzzyMatch(itemLower, normalize(el.options[oi].value))
        )
        if (score > bestScore) { bestScore = score; bestIdx = oi }
      }
      if (bestIdx >= 0 && bestScore >= 40) {
        el.options[bestIdx].selected = true
        selected.push(el.options[bestIdx].text.trim())
      }
    }

    if (selected.length > 0) {
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      highlightEl(el, "success")
      return { ok: true, method: "multiSelect", selected: selected.join(", "), count: selected.length }
    }
    return { ok: false, reason: "no matching options for multi-select" }
  }

  // ── Radio group polarity detection ──
  // For yes/no-type radio groups, we need to know which option is the
  // positive and which is negative, because "Yes, I am legally authorized
  // to work in the United States" and "No, I am not legally authorized..."
  // both contain the word "authorized" — fuzzyMatch alone can't tell them apart.

  var POSITIVE_STARTERS = /^(yes|i am|i do|i have|i will|i can|i would|true|authorized|will not require)/
  var NEGATIVE_STARTERS = /^(no[,.\s]|i am not|i do not|i have not|i will not|i cannot|i would not|false|not authorized|will require)/

  function radioPolarity(text) {
    var t = normalize(text)
    if (NEGATIVE_STARTERS.test(t)) return "negative"
    if (POSITIVE_STARTERS.test(t)) return "positive"
    // Check if first word is yes/no
    var firstWord = t.split(/[\s,]/)[0]
    if (firstWord === "yes" || firstWord === "y" || firstWord === "true") return "positive"
    if (firstWord === "no" || firstWord === "n" || firstWord === "false") return "negative"
    return "neutral"
  }

  function valuePolarity(value) {
    var v = normalize(value)
    if (v === "yes" || v === "true" || v === "y" || v === "1") return "positive"
    if (v === "no" || v === "false" || v === "n" || v === "0") return "negative"
    // Check equivalence groups
    var posGroups = ["yes", "authorized", "will not require"]
    var negGroups = ["no", "not authorized", "will require"]
    for (var pg = 0; pg < posGroups.length; pg++) {
      var grp = EQUIVALENCES[posGroups[pg]]
      if (grp && grp.indexOf(v) !== -1) return "positive"
    }
    for (var ng = 0; ng < negGroups.length; ng++) {
      var grp2 = EQUIVALENCES[negGroups[ng]]
      if (grp2 && grp2.indexOf(v) !== -1) return "negative"
    }
    return "neutral"
  }

  function fillRadio(block, value) {
    var valueLower = normalize(value)
    var radios = block.radioGroupName
      ? document.querySelectorAll('input[type="radio"][name="' + block.radioGroupName + '"]')
      : (block.container ? block.container.querySelectorAll('input[type="radio"]') : [])

    if (radios.length === 0) {
      return { ok: false, reason: "no radio buttons found" }
    }

    // Collect all options with labels
    var options = []
    for (var i = 0; i < radios.length; i++) {
      var radio = radios[i]
      var lbl = radio.closest("label") || document.querySelector('label[for="' + radio.id + '"]')
      var lblText = normalize(lbl ? lbl.textContent : radio.value || "")
      options.push({ radio: radio, label: lblText, value: normalize(radio.value), polarity: radioPolarity(lblText) })
    }

    // Determine if this is a polarity group (yes/no, authorized/not, etc.)
    var hasPositive = options.some(function(o) { return o.polarity === "positive" })
    var hasNegative = options.some(function(o) { return o.polarity === "negative" })
    var isPolarGroup = hasPositive && hasNegative
    var targetPolarity = valuePolarity(valueLower)

    var bestRadio = null
    var bestScore = 0
    var bestLabel = ""

    for (var j = 0; j < options.length; j++) {
      var opt = options[j]

      // Base fuzzy score
      var score = Math.max(fuzzyMatch(valueLower, opt.label), fuzzyMatch(valueLower, opt.value))

      // Polarity scoring — this is the key fix
      if (isPolarGroup && targetPolarity !== "neutral") {
        if (opt.polarity === targetPolarity) {
          // Polarity match — strong bonus
          score = Math.max(score, 85)
        } else if (opt.polarity !== "neutral" && opt.polarity !== targetPolarity) {
          // Polarity mismatch — cap score so we never pick the wrong one
          score = Math.min(score, 20)
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestRadio = opt.radio
        bestLabel = opt.label
      }
    }

    if (bestRadio && bestScore >= 40) {
      // Click the radio button
      bestRadio.click()
      bestRadio.checked = true
      bestRadio.dispatchEvent(new Event("change", { bubbles: true }))
      bestRadio.dispatchEvent(new Event("input", { bubbles: true }))

      // Verify it actually got checked (React can block clicks)
      if (!bestRadio.checked) {
        // Retry: set property directly + re-dispatch
        bestRadio.checked = true
        bestRadio.dispatchEvent(new Event("change", { bubbles: true }))
      }

      var verified = bestRadio.checked
      var parentLbl = bestRadio.closest("label")
      highlightEl(parentLbl || bestRadio, verified ? "success" : "error")
      console.log("[YH-Fill] radio: polarity=" + targetPolarity + " selected='" + bestLabel.slice(0, 40) + "' score=" + bestScore + " verified=" + verified +
                  " group=[" + options.map(function(o) { return o.polarity + ":'" + o.label.slice(0, 20) + "'" }).join(", ") + "]")
      return { ok: verified, method: "radio", selected: bestLabel, score: bestScore }
    }

    // Log failure with available options
    console.warn("[YH-Fill] radio miss:", JSON.stringify({
      intended: value,
      targetPolarity: targetPolarity,
      bestScore: bestScore,
      options: options.map(function(o) { return { label: o.label.slice(0, 40), polarity: o.polarity } }),
    }))
    return { ok: false, reason: "no matching radio option for: " + value }
  }

  function fillCheckbox(el, value) {
    var vn = normalize(String(value))
    var shouldCheck = vn === "true" || vn === "yes" || vn === "y" || vn === "checked" || vn === "1" || value === true

    // For consent/agreement checkboxes, auto-check — but NOT for accommodation/opt-out questions
    if (!shouldCheck) {
      var lbl = el.closest("label") || (el.id ? document.querySelector('label[for="' + el.id + '"]') : null)
      var lblText = normalize(lbl ? lbl.textContent : "")
      var isConsent = lblText.includes("agree") || lblText.includes("consent") || lblText.includes("acknowledge") || lblText.includes("confirm") || lblText.includes("terms")
      var isOptOut = lblText.includes("accommodation") || lblText.includes("opt out") || lblText.includes("do not") || lblText.includes("unsubscribe")
      if (isConsent && !isOptOut) {
        shouldCheck = true
      }
    }

    if (el.checked !== shouldCheck) {
      el.click()
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))

      // Verify the click actually toggled the state (React can block it)
      if (el.checked !== shouldCheck) {
        // Retry: direct property set + events
        el.checked = shouldCheck
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }
    }

    var verified = el.checked === shouldCheck
    highlightEl(el, verified ? "success" : "error")
    return { ok: verified, method: "checkbox", checked: el.checked }
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms) }) }

  // ── Failure Reason Taxonomy ──
  // Every combobox/select failure gets classified into exactly one of these.
  // Console filter: [YH-Combo] FAIL  → then read .failureCode
  var FAILURE_CODES = {
    NO_INPUT_FOUND:              "no_input_found",               // couldn't locate <input> to type into
    NO_OPTIONS_FOUND:            "no_options_found",              // 0 option elements visible after opening
    WRONG_OPTION_MATCH:          "wrong_option_match",            // best fuzzy score < threshold
    SELECTION_NOT_COMMITTED:     "selection_not_committed",       // clicked option but verifySelection failed
    DROPDOWN_NOT_CLOSED:         "dropdown_not_closed",           // listbox/menu still visible after select
    HIDDEN_VALUE_NOT_UPDATED:    "hidden_value_not_updated",      // hidden <input> still empty/stale
    ARIA_NAVIGATION_FAILED:      "aria_navigation_failed",        // aria-activedescendant never matched
    OVERLAY_NOT_FOUND:           "overlay_not_found",             // portal/popover container missing
    PORTAL_SELECTOR_MISS:        "portal_specific_selector_miss", // portal adapter didn't recover label
    VALUE_TOO_LONG:              "value_too_long",                // value > 80 chars, not a dropdown value
    ERROR:                       "error",                         // JS exception
  }

  // ── Country name variants for maximum match rate ──
  var COUNTRY_VARIANTS = {
    "united states of america": ["united states of america", "united states", "usa", "us", "u.s.a.", "u.s.", "america"],
    "united kingdom": ["united kingdom", "uk", "u.k.", "great britain", "england"],
    "south korea": ["south korea", "korea, republic of", "republic of korea", "korea (south)"],
    "north korea": ["north korea", "korea, democratic people's republic of"],
  }

  // ── Async fill for searchable dropdowns / comboboxes ──
  // Handles: React-Select, MUI, Greenhouse, Workday, Ashby, etc.
  var CUSTOM_SELECT_TIMEOUT = 10000  // 10 seconds max per dropdown

  function fillCustomSelectAsync(block, value) {
    // Wrap with timeout — never hang the entire autofill
    var innerPromise = new Promise(function(resolve) {
      var el = block.element
      var valueLower = normalize(value)
      var portal = detectPortal()
      var label = (block.questionText || "").slice(0, 25)
      var log = function(msg) { console.log("[YH-Fill] " + label + " → " + msg) }

      if (valueLower.length > 80) {
        resolve({ ok: false, reason: "value too long for dropdown" })
        return
      }

      // ── Build comprehensive variant list ──
      var variants = [value]
      var equivGroup = EQUIVALENCES[valueLower]
      if (equivGroup) {
        for (var eg = 0; eg < equivGroup.length; eg++) {
          if (variants.indexOf(equivGroup[eg]) === -1) variants.push(equivGroup[eg])
        }
      }
      // US states: add both full name and abbreviation
      var stInfo = normalizeState(value)
      if (stInfo.full && variants.indexOf(stInfo.full) === -1) variants.push(stInfo.full)
      if (stInfo.abbr && variants.indexOf(stInfo.abbr) === -1) variants.push(stInfo.abbr)
      // Country variants
      for (var ck in COUNTRY_VARIANTS) {
        var cvars = COUNTRY_VARIANTS[ck]
        if (cvars.indexOf(valueLower) !== -1) {
          for (var cv = 0; cv < cvars.length; cv++) {
            if (variants.indexOf(cvars[cv]) === -1) variants.push(cvars[cv])
          }
          break
        }
      }

      log("portal=" + portal + " type=" + (el.getAttribute("role") || el.tagName) + " value=" + value + " variants=" + variants.length)

      // ── Find the search input (expanded search) ──
      var searchInput = findSearchInput(el)

      function findSearchInput(root) {
        // 1. Element IS the input
        if (root.tagName === "INPUT" && root.type !== "hidden") return root
        // 2. Input inside element
        var inner = root.querySelector("input:not([type='hidden'])")
        if (inner) return inner
        // 3. Sibling input (common in Workday)
        var parent = root.parentElement
        if (parent) {
          var sibling = parent.querySelector("input:not([type='hidden'])")
          if (sibling) return sibling
        }
        // 4. Wider container search
        var containers = [
          root.closest("[class*='select']"),
          root.closest("[class*='combobox']"),
          root.closest("[class*='dropdown']"),
          root.closest("[class*='field']"),
          root.closest("[role='combobox']"),
          root.closest("[class*='FormField']"),
          root.closest("[data-automation-id]"),
        ]
        for (var ci = 0; ci < containers.length; ci++) {
          if (containers[ci]) {
            var inp = containers[ci].querySelector("input:not([type='hidden'])")
            if (inp) return inp
          }
        }
        // 5. Workday-specific: search for data-automation-id input
        if (portal === "workday") {
          var wdInput = document.querySelector("[data-automation-id*='searchBox'] input, [data-automation-id*='Search'] input")
          if (wdInput && wdInput.offsetParent) return wdInput
        }
        return null
      }

      // ── Type into input using React-compatible setter ──
      function typeIntoInput(input, text) {
        if (!input) return
        input.focus()
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        // Clear first
        if (setter) setter.call(input, "")
        else input.value = ""
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        // Type new value
        if (setter) setter.call(input, text)
        else input.value = text
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        // Some portals need keydown events
        input.dispatchEvent(new KeyboardEvent("keydown", { key: text.slice(-1), keyCode: text.charCodeAt(text.length - 1), bubbles: true }))
        input.dispatchEvent(new KeyboardEvent("keyup", { key: text.slice(-1), bubbles: true }))
      }

      // ── Open the dropdown (portal-aware) ──
      async function openDropdown() {
        // Click the element itself
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        el.click()
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))

        // Click trigger buttons (arrows, chevrons)
        var triggerSelectors = [
          "[class*='indicator']", "[class*='arrow']", "[class*='trigger']",
          "[class*='chevron']", "[class*='caret']", "button", "svg",
          "[class*='DropdownIndicator']", "[class*='SelectArrow']",
        ]
        for (var ts = 0; ts < triggerSelectors.length; ts++) {
          var trigger = el.querySelector(triggerSelectors[ts])
          if (trigger) { trigger.click(); break }
        }

        // Workday: may need to click the container's button
        if (portal === "workday") {
          var wdBtn = el.querySelector("[data-automation-id*='arrow'], [data-automation-id*='button']")
          if (wdBtn) wdBtn.click()
        }

        await sleep(250)

        // Focus the search input if available
        if (searchInput) searchInput.focus()
      }

      // ── Close dropdown cleanly ──
      function closeDropdown() {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
        if (searchInput) searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }))
      }

      // ── Find visible options and click best match ──
      // Searches both local container AND document-level overlay portals
      function findAndClickOption(targetLower, targetVariants) {
        var optSelectors = [
          '[role="option"]', '[class*="option"]:not([class*="control"]):not([class*="Option--is-disabled"])',
          '[class*="select__option"]', 'li[id*="option"]', 'li[role="option"]',
          '[class*="menu"] [class*="item"]', '[class*="MenuList"] > div',
          '[class*="MuiMenuItem"]', '[class*="MuiAutocomplete-option"]', '[class*="MuiAutocomplete-popper"] li',
          '[class*="ant-select-item"]', '[class*="ant-select-dropdown"] [class*="item"]',
          '[data-automation-id*="option"]', '[data-automation-id*="promptOption"]',
          '[class*="dropdown-item"]',
          '[class*="listbox"] [class*="option"]', '[class*="list-item"]',
          '[class*="Listbox-option"]', '[class*="listbox-option"]',
          // Greenhouse
          '[class*="Select-option"]', '[class*="select-option"]',
          // Generic listbox items
          '[role="listbox"] > *', '[role="listbox"] li',
        ]
        var selectorStr = optSelectors.join(", ")

        // Search 1: document-wide (catches overlay portals, React portals, MUI Popper, etc.)
        var allOpts = document.querySelectorAll(selectorStr)

        // Search 2: if few results, also check known overlay containers
        if (allOpts.length < 3) {
          var overlaySelectors = [
            '[class*="portal"]', '[class*="Popper"]', '[class*="popover"]',
            '[class*="overlay"]', '[class*="dropdown-menu"]',
            '[data-automation-id*="popup"]', '[data-automation-id*="overlay"]',
            '[id*="portal"]', '[id*="overlay"]', '[id*="popover"]',
            '#menu-', // MUI menu portals start with #menu-
          ]
          var overlays = document.querySelectorAll(overlaySelectors.join(", "))
          var extraOpts = []
          for (var oi = 0; oi < overlays.length; oi++) {
            var innerOpts = overlays[oi].querySelectorAll(selectorStr + ", li, div[class*='item']")
            for (var io = 0; io < innerOpts.length; io++) extraOpts.push(innerOpts[io])
          }
          if (extraOpts.length > 0) {
            allOpts = Array.from(allOpts).concat(extraOpts)
          }
        }
        log("found " + allOpts.length + " option elements (incl. overlays)")

        var bestOpt = null
        var bestScore = 0
        for (var i = 0; i < allOpts.length; i++) {
          var opt = allOpts[i]
          var rect = opt.getBoundingClientRect()
          if (rect.height === 0 || rect.width === 0) continue  // Skip invisible
          // Skip disabled options
          if (opt.getAttribute("aria-disabled") === "true" || opt.classList.contains("disabled")) continue
          var optText = normalize(opt.textContent)
          var optVal = normalize(opt.getAttribute("value") || opt.getAttribute("data-value") || "")

          // Score against all target variants
          var score = 0
          for (var v = 0; v < targetVariants.length; v++) {
            var tv = normalize(targetVariants[v])
            score = Math.max(score, fuzzyMatch(tv, optText), fuzzyMatch(tv, optVal))
          }
          // US State normalization bonus
          var optState = normalizeState(optText)
          for (var sv = 0; sv < targetVariants.length; sv++) {
            var tvState = normalizeState(targetVariants[sv])
            if (tvState.abbr && optState.abbr && tvState.abbr === optState.abbr) {
              score = Math.max(score, 95)
            }
          }
          // Polarity bonus/penalty for boolean-like options in dropdowns
          // Prevents "Yes" matching "No, I am not..." when both contain shared words
          var tgtPolarity = valuePolarity(valueLower)
          if (tgtPolarity !== "neutral") {
            var optPolarity = radioPolarity(optText)
            if (optPolarity === tgtPolarity && score >= 30) {
              score = Math.max(score, 85)  // polarity-match bonus
            } else if (optPolarity !== "neutral" && optPolarity !== tgtPolarity) {
              score = Math.min(score, 20)  // polarity-mismatch cap
            }
          }
          // Education equivalence matching
          for (var ek in EDUCATION_EQUIVALENCES) {
            var eGroup = EDUCATION_EQUIVALENCES[ek]
            var valInGroup = false, optInGroup = false
            for (var eg = 0; eg < eGroup.length; eg++) {
              if (valueLower.includes(eGroup[eg])) valInGroup = true
              if (optText.includes(eGroup[eg])) optInGroup = true
            }
            if (valInGroup && optInGroup) score = Math.max(score, 90)
          }
          if (score > bestScore) { bestScore = score; bestOpt = opt }
        }

        if (bestOpt && bestScore >= 30) {
          log("clicking option: '" + bestOpt.textContent.trim().slice(0, 40) + "' score=" + bestScore)
          bestOpt.scrollIntoView({ block: "nearest" })
          // Multi-event click for maximum compatibility
          bestOpt.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
          bestOpt.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
          bestOpt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
          bestOpt.click()
          bestOpt.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
          highlightEl(el, "success")
          return { ok: true, method: "customSelect", selected: bestOpt.textContent.trim(), score: bestScore, optionsFound: allOpts.length }
        }

        log("no match found (best score=" + bestScore + ", options=" + allOpts.length + ")")
        return { ok: false, reason: "no matching option", bestScore: bestScore, optionsFound: allOpts.length }
      }

      // ── 4-signal deep verification ──
      // Signal 1: visible text on trigger/combobox element
      // Signal 2: hidden input value or data-value attribute
      // Signal 3: dropdown is closed (no open listbox/menu)
      // Signal 4: selection persists after blur
      function verifySelection() {
        var signals = { visibleText: false, hiddenValue: false, dropdownClosed: false, persistsBlur: false }
        var firstWord = valueLower.split(" ")[0]
        if (firstWord.length < 2) firstWord = valueLower
        var matchedText = ""

        // Signal 1: visible text
        var displayText = normalize(el.textContent || "")
        var inputVal = searchInput ? normalize(searchInput.value || "") : ""
        // Also check aria-label on element (some portals update this)
        var ariaLabel = normalize(el.getAttribute("aria-label") || "")
        // Check aria-selected option
        var selectedOpt = el.querySelector('[aria-selected="true"]') || document.querySelector('[role="option"][aria-selected="true"]')
        var selectedOptText = selectedOpt ? normalize(selectedOpt.textContent) : ""
        // Check aria-activedescendant (Workday pattern)
        var activeDescId = el.getAttribute("aria-activedescendant") || (searchInput ? searchInput.getAttribute("aria-activedescendant") : "")
        var activeDescText = ""
        if (activeDescId) {
          var activeDescEl = document.getElementById(activeDescId)
          if (activeDescEl) activeDescText = normalize(activeDescEl.textContent)
        }

        if (displayText.includes(firstWord) || inputVal.includes(firstWord) ||
            ariaLabel.includes(firstWord) || selectedOptText.includes(firstWord) ||
            activeDescText.includes(firstWord)) {
          signals.visibleText = true
          matchedText = displayText || inputVal || selectedOptText || activeDescText
        }
        // Fallback: placeholder gone = something was selected
        var placeholder = normalize(el.getAttribute("placeholder") || "")
        if (!signals.visibleText && placeholder && displayText !== placeholder && displayText.length > 2 &&
            displayText !== "select" && displayText !== "select...") {
          signals.visibleText = true
          matchedText = displayText
        }

        // Signal 2: hidden input / data attribute
        var dataVal = normalize(el.getAttribute("data-value") || "")
        var hiddenInput = el.querySelector("input[type='hidden']") ||
                          (el.parentElement ? el.parentElement.querySelector("input[type='hidden']") : null)
        var hiddenVal = hiddenInput ? normalize(hiddenInput.value || "") : ""
        if (dataVal && dataVal !== "" && dataVal !== "select") signals.hiddenValue = true
        if (hiddenVal && hiddenVal !== "" && hiddenVal !== "select") signals.hiddenValue = true
        // For containers that store value directly
        if (el.value && normalize(el.value) !== "" && normalize(el.value) !== "select") signals.hiddenValue = true

        // Signal 3: dropdown is closed
        var openListbox = document.querySelector('[role="listbox"]:not([hidden])')
        var openMenu = document.querySelector('[class*="menu"][class*="open"], [class*="MenuList"], [class*="select__menu"]')
        var openListboxVisible = openListbox && openListbox.getBoundingClientRect().height > 0
        var openMenuVisible = openMenu && openMenu.getBoundingClientRect().height > 0
        signals.dropdownClosed = !openListboxVisible && !openMenuVisible

        // Signal 4: blur persistence — fire blur and re-check
        if (signals.visibleText) {
          if (searchInput) searchInput.dispatchEvent(new Event("blur", { bubbles: true }))
          el.dispatchEvent(new Event("blur", { bubbles: true }))
          // Re-read after blur
          var postBlurText = normalize(el.textContent || "")
          var postBlurInput = searchInput ? normalize(searchInput.value || "") : ""
          if (postBlurText.includes(firstWord) || postBlurInput.includes(firstWord)) {
            signals.persistsBlur = true
          }
        }

        var passCount = (signals.visibleText ? 1 : 0) + (signals.hiddenValue ? 1 : 0) +
                        (signals.dropdownClosed ? 1 : 0) + (signals.persistsBlur ? 1 : 0)

        log("verify: visible=" + signals.visibleText + " hidden=" + signals.hiddenValue +
            " closed=" + signals.dropdownClosed + " blur=" + signals.persistsBlur + " (" + passCount + "/4)")

        // Pass if at least 2 signals confirm (visibleText required)
        if (signals.visibleText && passCount >= 2) {
          return { ok: true, method: "keyboard", selected: matchedText, signals: signals }
        }
        return { ok: false, signals: signals }
      }

      // ── Strategy A: Click to open, type first word to filter, click option ──
      async function strategyA() {
        await openDropdown()

        // Type short search text
        var searchText = value.split(" ")[0]
        if (searchInput) {
          typeIntoInput(searchInput, searchText)
          log("strategyA: typed '" + searchText + "'")
        }

        await sleep(400)
        return findAndClickOption(valueLower, variants)
      }

      // ── Strategy B: Type full value, ArrowDown + Enter ──
      async function strategyB() {
        closeDropdown()
        await sleep(150)
        await openDropdown()

        if (!searchInput) return { ok: false }
        typeIntoInput(searchInput, value)
        log("strategyB: typed full '" + value + "'")

        await sleep(350)

        // ArrowDown to highlight first result, Enter to select
        searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true }))
        await sleep(100)
        searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
        searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }))

        await sleep(250)
        return verifySelection()
      }

      // ── Strategy C: Try each variant (open → clear → type → click) ──
      async function strategyC() {
        for (var vi = 0; vi < Math.min(variants.length, 6); vi++) {
          var variant = variants[vi]
          closeDropdown()
          await sleep(150)
          await openDropdown()

          if (searchInput) {
            typeIntoInput(searchInput, variant)
            log("strategyC: trying variant '" + variant + "'")
          } else {
            // No search input — try clicking element and looking for visible options
            el.click()
          }
          await sleep(400)

          var result = findAndClickOption(normalize(variant), [variant])
          if (result.ok) return result

          // Also try ArrowDown+Enter for this variant
          if (searchInput) {
            searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true }))
            await sleep(80)
            searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
            await sleep(200)
            var v = verifySelection()
            if (v.ok) return v
          }
        }
        return { ok: false, reason: "no variant matched" }
      }

      // ── Strategy D: Direct option scan without typing (for non-searchable dropdowns) ──
      async function strategyD() {
        closeDropdown()
        await sleep(150)
        // Just click to open and find from all visible options
        el.click()
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        await sleep(300)

        return findAndClickOption(valueLower, variants)
      }

      // ── Strategy E: aria-activedescendant navigation (Workday/ARIA comboboxes) ──
      // These comboboxes don't render visible options until typed, and selection
      // is tracked via aria-activedescendant pointing to an option id.
      async function strategyE() {
        closeDropdown()
        await sleep(150)

        // Need a search input
        if (!searchInput) return { ok: false }

        searchInput.focus()
        await sleep(100)

        // Type the value
        typeIntoInput(searchInput, value.split(" ")[0])
        await sleep(500)

        // Navigate with ArrowDown, checking aria-activedescendant each step
        var maxSteps = 15
        for (var step = 0; step < maxSteps; step++) {
          searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true }))
          await sleep(80)

          var adId = searchInput.getAttribute("aria-activedescendant") || el.getAttribute("aria-activedescendant")
          if (!adId) continue

          var adEl = document.getElementById(adId)
          if (!adEl) continue

          var adText = normalize(adEl.textContent)
          // Check if this option matches any variant
          var matchScore = 0
          for (var mv = 0; mv < variants.length; mv++) {
            matchScore = Math.max(matchScore, fuzzyMatch(normalize(variants[mv]), adText))
          }
          // Also check state normalization
          var adState = normalizeState(adText)
          for (var msv = 0; msv < variants.length; msv++) {
            var mvState = normalizeState(variants[msv])
            if (mvState.abbr && adState.abbr && mvState.abbr === adState.abbr) matchScore = Math.max(matchScore, 95)
          }

          if (matchScore >= 50) {
            log("strategyE: aria-activedescendant match '" + adText.slice(0, 30) + "' score=" + matchScore)
            // Select it with Enter
            searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
            await sleep(200)
            var v = verifySelection()
            if (v.ok) return v
            // Also try clicking the element directly
            adEl.click()
            adEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
            await sleep(150)
            return verifySelection()
          }
        }
        return { ok: false, reason: "aria-activedescendant: no match in " + maxSteps + " steps" }
      }

      // ── Diagnose failure code from last strategy results ──
      function diagnoseFailure(attempts) {
        // Walk through attempts in order to find root cause
        if (!searchInput) return FAILURE_CODES.NO_INPUT_FOUND

        // Check if any strategy found options
        var anyOptionsFound = false
        for (var ai = 0; ai < attempts.length; ai++) {
          if (attempts[ai].optionsFound > 0) { anyOptionsFound = true; break }
        }
        if (!anyOptionsFound) {
          // Did we find overlay containers?
          var overlays = document.querySelectorAll('[class*="portal"], [class*="Popper"], [class*="popover"], [data-automation-id*="popup"]')
          if (overlays.length === 0) return FAILURE_CODES.OVERLAY_NOT_FOUND
          return FAILURE_CODES.NO_OPTIONS_FOUND
        }

        // Options were found — check why none matched
        var lastAttempt = attempts[attempts.length - 1]
        if (lastAttempt.bestScore !== undefined && lastAttempt.bestScore < 30) {
          return FAILURE_CODES.WRONG_OPTION_MATCH
        }

        // Something was clicked but verification failed — check which signal broke
        var lastVerify = lastAttempt.verification
        if (lastVerify && lastVerify.signals) {
          if (!lastVerify.signals.visibleText) return FAILURE_CODES.SELECTION_NOT_COMMITTED
          if (!lastVerify.signals.dropdownClosed) return FAILURE_CODES.DROPDOWN_NOT_CLOSED
          if (!lastVerify.signals.hiddenValue && !lastVerify.signals.persistsBlur) return FAILURE_CODES.HIDDEN_VALUE_NOT_UPDATED
        }

        // Strategy E specific
        if (lastAttempt.strategy === "E" && !lastAttempt.ok) return FAILURE_CODES.ARIA_NAVIGATION_FAILED

        return FAILURE_CODES.SELECTION_NOT_COMMITTED  // default
      }

      // ── Run strategies with structured trace ──
      (async function() {
        var trace = {
          portal: portal,
          fieldLabel: block.questionText || "",
          intendedValue: value,
          variants: variants.length,
          hasSearchInput: !!searchInput,
          inputRole: el.getAttribute("role") || "",
          inputTag: el.tagName,
          ariaHasPopup: el.getAttribute("aria-haspopup") || "",
          strategies: [],       // per-strategy attempt records
          winningStrategy: null,
          selectedOption: null,
          verification: null,
          failureCode: null,
          result: null,
        }

        function recordAttempt(name, result) {
          trace.strategies.push({
            strategy: name,
            ok: result.ok || false,
            selected: result.selected || null,
            bestScore: result.bestScore || result.score || null,
            optionsFound: result.optionsFound || 0,
            reason: result.reason || null,
            verification: result.signals || null,
          })
        }

        try {
          var result = await strategyA()
          recordAttempt("A", result)
          if (result.ok) {
            trace.winningStrategy = "A (type+click)"
            trace.selectedOption = result.selected
            trace.verification = result.signals || "click-confirmed"
            trace.result = "success"
            console.log("[YH-Combo]", JSON.stringify(trace))
            resolve(result); return
          }

          result = await strategyB()
          recordAttempt("B", result)
          if (result.ok) {
            trace.winningStrategy = "B (type+ArrowDown+Enter)"
            trace.selectedOption = result.selected
            trace.verification = result.signals || "keyboard-confirmed"
            trace.result = "success"
            console.log("[YH-Combo]", JSON.stringify(trace))
            resolve(result); return
          }

          result = await strategyC()
          recordAttempt("C", result)
          if (result.ok) {
            trace.winningStrategy = "C (variant cycling)"
            trace.selectedOption = result.selected
            trace.verification = result.signals || "variant-confirmed"
            trace.result = "success"
            console.log("[YH-Combo]", JSON.stringify(trace))
            resolve(result); return
          }

          result = await strategyD()
          recordAttempt("D", result)
          if (result.ok) {
            trace.winningStrategy = "D (direct scan)"
            trace.selectedOption = result.selected
            trace.verification = result.signals || "scan-confirmed"
            trace.result = "success"
            console.log("[YH-Combo]", JSON.stringify(trace))
            resolve(result); return
          }

          result = await strategyE()
          recordAttempt("E", result)
          if (result.ok) {
            trace.winningStrategy = "E (aria-activedescendant)"
            trace.selectedOption = result.selected
            trace.verification = result.signals || "aria-confirmed"
            trace.result = "success"
            console.log("[YH-Combo]", JSON.stringify(trace))
            resolve(result); return
          }

          // All failed — diagnose
          trace.winningStrategy = null
          trace.failureCode = diagnoseFailure(trace.strategies)
          trace.result = "failure"
          console.warn("[YH-Combo] FAIL", JSON.stringify(trace))

          closeDropdown()
          highlightEl(el, "error")
          resolve({ ok: false, reason: trace.failureCode, trace: trace })
        } catch(e) {
          trace.failureCode = FAILURE_CODES.ERROR
          trace.result = "error: " + e.message
          console.error("[YH-Combo] ERROR", JSON.stringify(trace))
          closeDropdown()
          resolve({ ok: false, reason: "error: " + e.message, trace: trace })
        }
      })()
    })

    // Race with timeout — never hang
    var timeoutPromise = new Promise(function(resolve) {
      setTimeout(function() {
        console.warn("[YH-Combo] TIMEOUT after " + CUSTOM_SELECT_TIMEOUT + "ms for: " + (block.questionText || "").slice(0, 30))
        resolve({ ok: false, reason: "timeout_" + CUSTOM_SELECT_TIMEOUT + "ms" })
      }, CUSTOM_SELECT_TIMEOUT)
    })
    return Promise.race([innerPromise, timeoutPromise])
  }

  // ── 6. Verification ───────────────────────────────────────────────────

  function verifyFill(block) {
    var newValue = readCurrentValue(block.element, block.inputType, block.radioGroupName)
    if (!newValue || newValue.trim() === "") return false
    var nv = newValue.toLowerCase()
    if (nv === "select" || nv === "select..." || nv === "choose..." || nv === "-- select --") return false
    // For text fields, also verify the value matches what we set (React can reset it)
    if ((block.inputType === "shortText" || block.inputType === "longText" || block.inputType === "password") && block.suggestedAnswer) {
      var expected = String(block.suggestedAnswer).trim().toLowerCase()
      if (expected && nv !== expected && !nv.includes(expected.slice(0, 10))) return false
    }
    // For checkboxes, verify checked state matches intent
    if (block.inputType === "checkbox" && block.suggestedAnswer !== undefined) {
      var shouldBeChecked = block.suggestedAnswer === true || normalize(String(block.suggestedAnswer)) === "yes" || normalize(String(block.suggestedAnswer)) === "true"
      if (block.element.checked !== shouldBeChecked) return false
    }
    return true
  }

  // Enhanced verification with retry — used after initial fill
  function verifyAndRetry(block, value, maxRetries) {
    maxRetries = maxRetries || 2
    for (var attempt = 0; attempt < maxRetries; attempt++) {
      if (verifyFill(block)) return true
      // Retry the fill
      console.log("[YH-Fill] Retry " + (attempt + 1) + " for: " + (block.questionText || "").slice(0, 30))
      fillBlock(block, value)
    }
    return verifyFill(block)
  }

  // ── 7. Visual Feedback ────────────────────────────────────────────────

  function highlightEl(el, type) {
    try {
      var color = type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#f59e0b"
      el.style.outline = "2px solid " + color
      el.style.outlineOffset = "1px"
      el.style.transition = "outline-color 0.3s"
      // Auto-scroll to element if it's below the viewport
      if (el.getBoundingClientRect().bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      setTimeout(function() {
        el.style.outline = ""
        el.style.outlineOffset = ""
      }, 3000)
    } catch (e) {}
  }

  // ── 8. Portal Reliability Adapters ──────────────────────────────────────
  // Lightweight pre-processors for specific ATS portals

  function detectPortal() {
    var host = location.hostname.toLowerCase()
    var path = location.pathname.toLowerCase()
    // Tier 0: Original portals
    if (host.includes("greenhouse") || host.includes("boards.eu.greenhouse")) return "greenhouse"
    if (host.includes("lever.co") || host.includes("jobs.lever")) return "lever"
    if (host.includes("rippling")) return "rippling"
    if (host.includes("myworkday") || host.includes("workday")) return "workday"
    if (host.includes("ashby") || host.includes("ashbyhq")) return "ashby"
    // Tier 1
    if (host.includes("smartrecruiters") || host.includes("smrtr.io")) return "smartrecruiters"
    if (host.includes("icims") || host.includes(".igreens.")) return "icims"
    if (host.includes("jobvite") || host.includes("jobs.jobvite")) return "jobvite"
    if (host.includes("bamboohr") || host.includes("bamboo")) return "bamboohr"
    // Tier 2
    if (host.includes("taleo") || host.includes("oracle.com") && path.includes("recruit")) return "taleo"
    if (host.includes("adp") || host.includes("workforcenow")) return "adp"
    if (host.includes("paylocity")) return "paylocity"
    // Tier 3
    if (host.includes("teamtailor")) return "teamtailor"
    if (host.includes("recruitee")) return "recruitee"
    if (host.includes("workable") || host.includes("apply.workable")) return "workable"
    // Tier 4: Additional portals
    if (host.includes("breezyhr") || host.includes("breezy.hr")) return "breezyhr"
    if (host.includes("successfactors") || host.includes("sap.com") && path.includes("career")) return "successfactors"
    if (host.includes("cornerstone") || host.includes("csod.com")) return "cornerstone"
    if (host.includes("phenom") || host.includes("phenompeople")) return "phenom"
    if (host.includes("clearcompany")) return "clearcompany"
    if (host.includes("jazzhr") || host.includes("applytojob")) return "jazzhr"
    if (host.includes("ziprecruiter") || host.includes("zipapply")) return "ziprecruiter"
    if (host.includes("careerbuilder")) return "careerbuilder"
    if (host.includes("hirebridge")) return "hirebridge"
    if (host.includes("ultipro") || host.includes("ukg")) return "ultipro"
    if (host.includes("dayforce") || host.includes("ceridian")) return "dayforce"
    if (host.includes("pinpointhq") || host.includes("pinpoint")) return "pinpoint"
    if (host.includes("dover.com") || host.includes("dover.io")) return "dover"
    if (host.includes("wellfound") || host.includes("angel.co")) return "wellfound"
    // Login pages
    if (path.includes("/login") || path.includes("/signin") || path.includes("/sign-in") || path.includes("/auth")) return "login_page"
    // Common career page patterns
    if (path.includes("/careers") || path.includes("/jobs") || path.includes("/apply") || path.includes("/openings")) return "generic_career"
    return "generic"
  }

  function applyPortalAdapter(blocks) {
    var portal = detectPortal()

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i]
      var el = b.element
      if (!el) continue

      // ── Common: recover missing labels from element attributes ──
      if (!b.questionText || b.questionText.length < 3) {
        // Try data attributes common across portals
        var attrSources = ["data-qa", "data-testid", "data-automation-id", "aria-label", "title"]
        for (var a = 0; a < attrSources.length; a++) {
          var attrVal = el.getAttribute(attrSources[a])
          if (attrVal && attrVal.length > 2 && !/^\d+$/.test(attrVal)) {
            b.questionText = attrVal.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim()
            break
          }
        }
      }

      // ── Greenhouse ──
      if (portal === "greenhouse") {
        // Filter out question IDs that slipped through
        if (/question.*\d{5,}/i.test(b.questionText)) {
          // Try to find label from parent container heading instead
          if (b.container) {
            var heading = b.container.querySelector("label, legend, h3, strong")
            if (heading) {
              var ht = heading.textContent.trim()
              if (ht.length > 2 && !/\d{5,}/.test(ht)) b.questionText = ht
            }
          }
        }
      }

      // ── Lever ──
      if (portal === "lever") {
        // Lever uses data-qa for field identification
        if (b.questionText.length < 3) {
          var qa = el.getAttribute("data-qa") || (b.container ? b.container.getAttribute("data-qa") : null)
          if (qa) b.questionText = qa.replace(/-/g, " ").replace(/_/g, " ")
        }
        // Lever wraps questions in .application-question divs
        if (b.questionText.length < 3 && b.container) {
          var aq = b.container.closest(".application-question, [class*='question']")
          if (aq) {
            var aqLabel = aq.querySelector(".application-label, label, [class*='label']")
            if (aqLabel) b.questionText = aqLabel.textContent.trim()
          }
        }
      }

      // ── Workday ──
      if (portal === "workday") {
        // Workday uses data-automation-id extensively
        if (b.questionText.length < 3) {
          var aid = el.getAttribute("data-automation-id")
          if (aid) b.questionText = aid.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/-/g, " ")
        }
        // Workday labels are often in sibling [data-automation-id="formLabel"]
        if (b.questionText.length < 3 && b.container) {
          var wdLabel = b.container.querySelector('[data-automation-id="formLabel"], [data-automation-id*="label"]')
          if (wdLabel) b.questionText = wdLabel.textContent.trim()
        }
      }

      // ── Ashby ──
      if (portal === "ashby") {
        // Ashby uses clean HTML but wraps in custom form blocks
        if (b.questionText.length < 3 && b.container) {
          var ashbyLabel = b.container.querySelector("[class*='FormField'] label, [class*='formField'] label")
          if (ashbyLabel) b.questionText = ashbyLabel.textContent.trim()
        }
      }

      // ── Rippling ──
      if (portal === "rippling") {
        if (b.questionText.length < 3 && b.container) {
          var ripLabel = b.container.querySelector("label, [class*='label']")
          if (ripLabel) b.questionText = ripLabel.textContent.trim()
        }
      }

      // ── SmartRecruiters (Tier 1) ──
      if (portal === "smartrecruiters") {
        // SmartRecruiters uses [data-test] and .field-label patterns
        if (b.questionText.length < 3) {
          var srTest = el.getAttribute("data-test") || (b.container ? b.container.getAttribute("data-test") : null)
          if (srTest) b.questionText = srTest.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
        }
        if (b.questionText.length < 3 && b.container) {
          var srLabel = b.container.querySelector(".field-label, [class*='field-label'], label, [class*='Label']")
          if (srLabel) b.questionText = srLabel.textContent.trim()
        }
        // SmartRecruiters wraps custom questions in .field-wrapper
        if (b.questionText.length < 3 && b.container) {
          var srWrapper = b.container.closest(".field-wrapper, [class*='field-wrapper'], [class*='question']")
          if (srWrapper) {
            var srHead = srWrapper.querySelector("label, h3, h4, [class*='title']")
            if (srHead) b.questionText = srHead.textContent.trim()
          }
        }
      }

      // ── iCIMS (Tier 1) ──
      if (portal === "icims") {
        // iCIMS uses iframes with standard form elements but custom class patterns
        if (b.questionText.length < 3 && b.container) {
          var icLabel = b.container.querySelector(".iCIMS_InfoMsg_Job label, [class*='labelArea'] label, label")
          if (icLabel) b.questionText = icLabel.textContent.trim()
        }
        // iCIMS wraps in .iCIMS_Expandable or table-based layouts
        if (b.questionText.length < 3) {
          var icRow = el.closest("tr, [class*='iCIMS']")
          if (icRow) {
            var icTd = icRow.querySelector("td label, th, [class*='label']")
            if (icTd) b.questionText = icTd.textContent.trim()
          }
        }
      }

      // ── Jobvite (Tier 1) ──
      if (portal === "jobvite") {
        // Jobvite uses .jv-field-wrapper and .jv-label
        if (b.questionText.length < 3 && b.container) {
          var jvLabel = b.container.querySelector(".jv-label, [class*='jv-label'], label")
          if (jvLabel) b.questionText = jvLabel.textContent.trim()
        }
        if (b.questionText.length < 3) {
          var jvWrapper = el.closest(".jv-field-wrapper, [class*='field-wrapper']")
          if (jvWrapper) {
            var jvHead = jvWrapper.querySelector("label, .jv-label, [class*='label']")
            if (jvHead) b.questionText = jvHead.textContent.trim()
          }
        }
      }

      // ── BambooHR (Tier 1) ──
      if (portal === "bamboohr") {
        // BambooHR uses clean semantic HTML with .fab-* classes
        if (b.questionText.length < 3 && b.container) {
          var bhLabel = b.container.querySelector("[class*='fab-Label'], [class*='FormField'] label, label")
          if (bhLabel) b.questionText = bhLabel.textContent.trim()
        }
        // BambooHR also uses data-field-id
        if (b.questionText.length < 3) {
          var bhField = el.getAttribute("data-field-id") || el.getAttribute("name")
          if (bhField && bhField.length > 2 && !/^\d+$/.test(bhField)) {
            b.questionText = bhField.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
          }
        }
      }

      // ── Taleo (Tier 2) ──
      if (portal === "taleo") {
        // Taleo (Oracle) uses table-based forms with id-based labels
        if (b.questionText.length < 3 && el.id) {
          var taleoLabel = document.querySelector("label[for='" + el.id + "']")
          if (taleoLabel) b.questionText = taleoLabel.textContent.trim()
        }
        if (b.questionText.length < 3 && b.container) {
          var taleoTd = b.container.closest("tr")
          if (taleoTd) {
            var taleoHead = taleoTd.querySelector(".contentLinePanelLabel, td label, [class*='label']")
            if (taleoHead) b.questionText = taleoHead.textContent.trim()
          }
        }
      }

      // ── ADP Workforce Now (Tier 2) ──
      if (portal === "adp") {
        // ADP uses [data-ad-comp-id] and complex nested structures
        if (b.questionText.length < 3 && b.container) {
          var adpLabel = b.container.querySelector("[class*='labelText'], [class*='field-label'], label")
          if (adpLabel) b.questionText = adpLabel.textContent.trim()
        }
        if (b.questionText.length < 3) {
          var adpComp = el.getAttribute("data-ad-comp-id")
          if (adpComp) b.questionText = adpComp.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
        }
      }

      // ── Paylocity (Tier 2) ──
      if (portal === "paylocity") {
        if (b.questionText.length < 3 && b.container) {
          var plLabel = b.container.querySelector("[class*='field-label'], [class*='question-text'], label")
          if (plLabel) b.questionText = plLabel.textContent.trim()
        }
      }

      // ── Teamtailor (Tier 3) ──
      if (portal === "teamtailor") {
        // Teamtailor uses clean React-based forms
        if (b.questionText.length < 3 && b.container) {
          var ttLabel = b.container.querySelector("[class*='field-label'], [class*='Label'], label")
          if (ttLabel) b.questionText = ttLabel.textContent.trim()
        }
      }

      // ── Recruitee (Tier 3) ──
      if (portal === "recruitee") {
        if (b.questionText.length < 3 && b.container) {
          var recLabel = b.container.querySelector("[class*='question__title'], [class*='form-label'], label")
          if (recLabel) b.questionText = recLabel.textContent.trim()
        }
      }

      // ── Workable (Tier 3) ──
      if (portal === "workable") {
        // Workable uses [data-ui] attributes and clean semantic HTML
        if (b.questionText.length < 3) {
          var wkUi = el.getAttribute("data-ui")
          if (wkUi) b.questionText = wkUi.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
        }
        if (b.questionText.length < 3 && b.container) {
          var wkLabel = b.container.querySelector("[class*='form-field'] label, [data-ui*='label'], label")
          if (wkLabel) b.questionText = wkLabel.textContent.trim()
        }
      }

      // ── Re-classify after label recovery ──
      if (b.questionText && b.questionText.length > 2 && b.intent === "unknown") {
        var reclass = classifyQuestion(b.questionText, b.inputType, el)
        if (reclass.confidence > b.confidence) {
          b.intent = reclass.intent
          b.category = reclass.category
          b.confidence = reclass.confidence
        }
      }
    }

    return blocks
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  return {
    // Detect which ATS portal this page belongs to
    portal: function() {
      return detectPortal()
    },

    // Scan page and return all form blocks
    scan: function() {
      return scanPage()
    },

    // Hash a question for answer memory
    hash: function(text) {
      return hashQuestion(text)
    },

    // Classify a question text
    classify: function(text, inputType) {
      return classifyQuestion(text, inputType || "shortText")
    },

    // Resolve answer for a block given profile data
    resolve: function(block, profileData) {
      return resolveAnswer(block, profileData)
    },

    // Fill a single block synchronously (returns { ok, reason } or { ok: false, reason: "needs_async" })
    fill: function(block, value) {
      return fillBlock(block, value)
    },

    // Fill a custom select asynchronously
    fillAsync: function(block, value) {
      return fillCustomSelectAsync(block, value)
    },

    // Verify a fill succeeded
    verify: function(block) {
      return verifyFill(block)
    },

    // Full pipeline: scan → classify → resolve → fill (sync part only)
    // Returns { blocks, filled, skipped, needsAI, needsReview, needsAsync }
    fillAll: function(profileData) {
      var portalName = detectPortal()
      var blocks = scanPage(true)  // Force fresh scan for fill operations
      blocks = applyPortalAdapter(blocks)
      var results = { filled: [], skipped: [], needsAI: [], needsReview: [], needsAsync: [], total: blocks.length, portal: portalName }

      console.log("[YH-Fill] ═══ fillAll: " + blocks.length + " blocks on " + portalName + " ═══")

      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i]
        var lbl = (block.questionText || "").slice(0, 40)

        // Skip non-empty fields
        if (!block.isEmpty) {
          results.skipped.push({ label: lbl, reason: "already filled" })
          continue
        }

        // Resolve answer
        var answer = resolveAnswer(block, profileData)
        block.suggestedAnswer = answer.value
        block.answerSource = answer.source

        if (answer.source === "ai") {
          console.log("[YH-Fill]   → AI needed: " + lbl + " (shape=" + block.answerShape + ")")
          results.needsAI.push({
            blockId: block.blockId,
            selector: block.selector,
            label: block.questionText,
            helperText: block.helperText,
            inputType: block.inputType,
            options: block.options.map(function(o) { return o.text }),
            category: block.category,
            intent: block.intent,
            answerShape: block.answerShape,
          })
          continue
        }

        if (answer.source === "needsReview") {
          console.log("[YH-Fill]   → Review: " + lbl + " (intent=" + block.intent + ")")
          results.needsReview.push({ label: lbl, intent: block.intent })
          continue
        }

        if (!answer.value) {
          console.log("[YH-Fill]   → Skip: " + lbl + " (no answer)")
          results.skipped.push({ label: lbl, reason: "no answer available" })
          continue
        }

        // Fill
        var fillResult = fillBlock(block, answer.value)

        if (fillResult.reason === "needs_async") {
          console.log("[YH-Fill]   → Async: " + lbl + " = " + String(answer.value).slice(0, 25))
          results.needsAsync.push({
            blockId: block.blockId,
            selector: block.selector,
            label: block.questionText,
            inputType: block.inputType,
            intent: block.intent,
            value: answer.value,
            element: block.element,
            container: block.container,
          })
          continue
        }

        if (fillResult.ok) {
          // Verify with retry (up to 2 retries)
          var verified = verifyAndRetry(block, answer.value, 2)
          block.status = verified ? "filled" : "unverified"
          if (verified) {
            console.log("[YH-Fill]   ✓ " + lbl + " = " + String(answer.value).slice(0, 25) + " (" + answer.source + ", " + fillResult.method + ")")
          } else {
            // Unverified — log diagnostic detail
            var postVal = readCurrentValue(block.element, block.inputType, block.radioGroupName)
            console.warn("[YH-Fill]   ⚠ UNVERIFIED: " + lbl, JSON.stringify({
              portal: portalName,
              label: block.questionText,
              intent: block.intent,
              inputType: block.inputType,
              intendedValue: String(answer.value).slice(0, 40),
              actualValue: (postVal || "").slice(0, 40),
              method: fillResult.method,
              source: answer.source,
              elementTag: block.element.tagName,
              elementRole: block.element.getAttribute("role") || "",
            }))
          }
          results.filled.push({
            label: lbl,
            value: String(answer.value).slice(0, 30),
            source: answer.source,
            method: fillResult.method,
            verified: verified,
          })
        } else {
          console.warn("[YH-Fill]   ✗ FAIL: " + lbl, JSON.stringify({
            portal: portalName,
            label: block.questionText,
            intent: block.intent,
            inputType: block.inputType,
            intendedValue: String(answer.value).slice(0, 40),
            failReason: fillResult.reason,
            elementTag: block.element.tagName,
            elementRole: block.element.getAttribute("role") || "",
            optionCount: block.options ? block.options.length : 0,
          }))
          results.skipped.push({ label: lbl, reason: fillResult.reason })
        }
      }

      console.log("[YH-Fill] ═══ Result: " + results.filled.length + " filled, " + results.needsAsync.length + " async, " + results.needsAI.length + " AI, " + results.skipped.length + " skipped ═══")
      return results
    },

    // Get serializable block data for popup communication
    getEmptyBlocks: function() {
      var blocks = scanPage()
      var empty = []
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].isEmpty) {
          empty.push({
            blockId: blocks[i].blockId,
            selector: blocks[i].selector,
            label: blocks[i].questionText,
            helperText: blocks[i].helperText,
            inputType: blocks[i].inputType,
            options: blocks[i].options.map(function(o) { return o.text }),
            category: blocks[i].category,
            intent: blocks[i].intent,
            required: blocks[i].required,
          })
        }
      }
      return empty
    },
  }
})()
