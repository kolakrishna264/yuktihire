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
    firstName:       { patterns: ["first name", "first_name", "fname", "given name", "given_name"], category: "identity", shape: "short_text" },
    lastName:        { patterns: ["last name", "last_name", "lname", "surname", "family name", "family_name"], category: "identity", shape: "short_text" },
    fullName:        { patterns: ["full name", "your name", "candidate name", "applicant name", "fullname", "name *"], category: "identity", shape: "short_text" },
    preferredName:   { patterns: ["preferred name", "preferred first", "nickname", "goes by", "known as"], category: "identity", shape: "short_text" },
    email:           { patterns: ["email", "e-mail", "email address"], category: "identity", shape: "short_text" },
    phone:           { patterns: ["phone", "mobile", "telephone", "cell", "contact number", "phone number"], category: "identity", shape: "short_text" },
    address:         { patterns: ["street address", "address line", "mailing address", "home address", "your address", "address from which", "what is your address"], category: "identity", shape: "location" },
    city:            { patterns: ["city", "town"], category: "identity", shape: "location" },
    state:           { patterns: ["state"], category: "identity", shape: "location" },
    zip:             { patterns: ["zip", "zip code", "postal code"], category: "identity", shape: "short_text" },
    country:         { patterns: ["country"], category: "identity", maxLabelLen: 30, shape: "enum_choice" },
    location:        { patterns: ["location", "where are you located", "based in", "current location"], category: "identity", shape: "location" },
    linkedin:        { patterns: ["linkedin", "linkedin profile", "linkedin url", "linkedin link"], category: "identity", shape: "short_text" },
    github:          { patterns: ["github", "github url", "github profile"], category: "identity", shape: "short_text" },
    portfolio:       { patterns: ["portfolio", "website", "personal site", "personal url", "personal website", "home page"], category: "identity", shape: "short_text" },

    // ── Tier 1: Professional (from profile) ──
    currentCompany:  { patterns: ["current company", "current employer", "company name", "employer name", "present company"], category: "professional", shape: "short_text" },
    currentTitle:    { patterns: ["current title", "current role", "job title", "current position", "present title"], category: "professional", shape: "short_text" },
    yearsExp:        { patterns: ["years of experience", "how many years", "years experience", "total experience", "work experience"], category: "professional", shape: "numeric" },
    skills:          { patterns: ["skills", "key skills", "technical skills", "core competencies"], category: "professional", shape: "short_text" },
    certifications:  { patterns: ["certifications", "certification", "certified", "licenses"], category: "professional", shape: "short_text" },
    education:       { patterns: ["education", "highest degree", "degree", "university", "school", "academic"], category: "professional", shape: "short_text" },
    gradYear:        { patterns: ["graduation year", "year of graduation", "grad year", "when did you graduate"], category: "professional", shape: "numeric" },
    publications:    { patterns: ["publication", "publications", "research", "google scholar", "semantic scholar", "papers"], category: "professional", shape: "short_text" },

    // ── Tier 1: US Work Authorization ──
    workAuth:        { patterns: ["authorized to work", "legally authorized", "work authorization", "right to work", "eligible to work", "work in the u.s", "work in the us", "legally permitted", "employment eligibility"], category: "authorization", shape: "boolean" },
    sponsorship:     { patterns: ["sponsorship", "sponsor", "visa", "h-1b", "h1b", "require sponsorship", "need sponsorship", "require visa", "employer sponsorship", "employment visa", "immigration"], category: "authorization", shape: "boolean" },
    visaType:        { patterns: ["visa type", "visa status", "immigration status", "opt", "cpt", "stem opt", "green card", "citizenship", "ead"], category: "authorization", shape: "short_text" },

    // ── Contextual (strict shapes — NOT essays) ──
    relocation:      { patterns: ["relocat", "willing to move", "open to moving", "open to relocation"], category: "contextual", shape: "boolean" },
    remotePref:      { patterns: ["remote", "hybrid", "in-person", "on-site", "work from home", "in one of our offices"], category: "contextual", shape: "boolean" },
    travelWilling:   { patterns: ["travel", "travel willingness", "travel required", "willing to travel"], category: "contextual", shape: "boolean" },
    dfwArea:         { patterns: ["dfw area", "located in the dfw", "dallas", "fort worth"], category: "contextual", shape: "boolean" },
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
    whyCompany:      { patterns: ["why this company", "why do you want to work", "why anthropic", "why are you interested in", "what interests you about", "what attracts you"], category: "motivation", shape: "essay" },
    whyRole:         { patterns: ["why this role", "why this position", "what excites you about this role", "interest in this role", "why are you applying"], category: "motivation", shape: "essay" },
    whyFit:          { patterns: ["why should we hire", "why are you a good fit", "what makes you a good candidate", "what do you bring"], category: "motivation", shape: "essay" },

    // ── Technical (essay for descriptions, enum for choices) ──
    techExperience:  { patterns: ["experience with", "proficiency in", "familiar with", "knowledge of", "expertise in", "worked with"], category: "technical", shape: "essay" },
    projectDesc:     { patterns: ["describe a project", "relevant project", "technical achievement", "most proud of", "piece of work"], category: "technical", shape: "essay" },
    codingLang:      { patterns: ["coding language", "programming language", "preferred language", "python or typescript", "interview language"], category: "technical", shape: "enum_choice" },
    researchBlog:    { patterns: ["research blog", "blog post", "next research", "red.anthropic"], category: "technical", shape: "essay" },
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
    '[role="combobox"]', '[role="listbox"]', '[aria-haspopup="listbox"]',
    '[class*="select__control"]', '[class*="css-"][class*="control"]',
    '[class*="SelectTrigger"]', '[class*="select-trigger"]',
    '[class*="chosen-container"]', '[class*="MuiSelect"]',
    '[class*="ant-select"]', '[class*="dropdown-toggle"]',
    '[data-automation-id*="select"]', '[data-automation-id*="dropdown"]',
    '[class*="react-select"]',
  ]

  // ── LAYER 3: Answer Strategy ───────────────────────────────────────────

  // 3-Tier answer strategy:
  //   Tier 1 (profile):     deterministic from stored profile — always safe
  //   Tier 2 (contextual):  AI with job context — location, remote, salary
  //   Tier 3 (review):      sensitive fields — NEVER auto-fill
  var ANSWER_STRATEGY = {
    // Tier 1 — Safe deterministic (profile data)
    identity:      "profile",
    authorization: "profile",       // work auth + sponsorship from stored prefs
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
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CORE ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  // ── 1. Form Block Scanner ─────────────────────────────────────────────

  function scanPage() {
    var blocks = []
    var seen = new Set()
    var blockId = 0

    // Scan native form controls
    var elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), ' +
      'select, textarea'
    )

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

    return blocks
  }

  function detectInputType(el) {
    if (el.tagName === "SELECT") return "nativeSelect"
    if (el.tagName === "TEXTAREA") return "longText"
    var t = (el.type || "text").toLowerCase()
    if (t === "radio") return "radio"
    if (t === "checkbox") return "checkbox"
    if (t === "file") return "file"
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
      isEmpty:         !currentValue || currentValue.trim() === "" || currentValue === "select" || currentValue === "select...",
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
    if (inputType === "nativeSelect") {
      return Array.from(el.options).map(function(o) {
        return { text: o.text.trim(), value: o.value }
      }).filter(function(o) {
        var t = o.text.toLowerCase()
        return t && t !== "select" && t !== "select..." && t !== "choose..." && t !== "-- select --" && t !== ""
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
    if (inputType === "nativeSelect") {
      var opt = el.options[el.selectedIndex]
      var text = opt ? opt.text.trim().toLowerCase() : ""
      if (!text || text === "select" || text === "select..." || text === "choose..." || text === "-- select --" || el.selectedIndex <= 0) return ""
      return opt.text.trim()
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
      var display = (el.textContent || "").trim().toLowerCase()
      if (!display || display === "select" || display === "select..." || display.includes("choose")) return ""
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
    if (bestIntent === "unknown") {
      // Textarea → essay
      if (inputType === "longText") {
        bestIntent = "additionalInfo"
        bestCategory = "openEnded"
        bestShape = "essay"
        bestConfidence = 40
      }
      // Select with yes/no options → boolean
      else if ((inputType === "nativeSelect" || inputType === "customSelect")) {
        bestShape = "enum_choice"
        bestCategory = "contextual"
        bestConfidence = 30
      }
      // Short text input → short_text
      else if (inputType === "shortText") {
        bestShape = "short_text"
        bestConfidence = 20
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

    // ── Tier 2: Contextual — use metro area for location questions ──
    if (strategy === "ai" && block.category === "contextual" && pd.metroArea) {
      // DFW area question + user is in DFW
      if (intent === "dfwArea" && pd.metroArea === "dfw") {
        return { value: "Yes", source: "metro", confidence: "high" }
      }
      // Generic location-specific questions
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
      state: stateInfo.full || stateInfo.abbr,  // Try full name first, then abbr
      zip: pd.zip || pd.zipCode || "",
      location: pd.location,
      linkedin: pd.linkedin,
      github: pd.github,
      portfolio: pd.portfolio,
      country: "United States",
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
    }
    return map[intent] !== undefined ? map[intent] : null
  }

  function getRuleAnswer(intent, pd, block) {
    // Only consent-type fields use rules — everything else is profile or AI
    var map = {
      termsConsent:      true,
      privacyConsent:    true,
      aiPolicy:          "Yes",
    }
    return map[intent] !== undefined ? map[intent] : null
  }

  // ── 5. Fill Executor ──────────────────────────────────────────────────

  function fillBlock(block, value) {
    if (!value && value !== true && value !== false) return { ok: false, reason: "no value" }

    var el = block.element
    var strValue = String(value)

    switch (block.inputType) {
      case "shortText":
      case "longText":
        return fillText(el, strValue)

      case "nativeSelect":
        return fillNativeSelect(el, strValue, block.options)

      case "radio":
        return fillRadio(block, strValue)

      case "checkbox":
        return fillCheckbox(el, value)

      case "customSelect":
        // This needs async — return a marker
        return { ok: false, reason: "needs_async", asyncType: "customSelect" }

      default:
        return { ok: false, reason: "unknown input type" }
    }
  }

  function fillText(el, value) {
    try {
      el.focus()
      // Use React-compatible setter
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ||
                   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
      if (setter) setter.call(el, value)
      else el.value = value

      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("blur", { bubbles: true }))
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
  }

  function fuzzyMatch(value, optionText) {
    var vn = normalize(value)
    var on = normalize(optionText)
    if (vn === on) return 100
    // Check equivalence groups
    for (var key in EQUIVALENCES) {
      var group = EQUIVALENCES[key]
      var vInGroup = group.indexOf(vn) !== -1 || vn.includes(key)
      var oInGroup = group.indexOf(on) !== -1 || on.includes(key)
      if (vInGroup && oInGroup) return 95
    }
    // Starts with
    if (on.startsWith(vn) || vn.startsWith(on)) return 80
    // Contains
    if (on.includes(vn)) return 60
    if (vn.includes(on) && on.length > 3) return 50
    // Word overlap
    var vWords = vn.split(" ").filter(function(w) { return w.length > 2 })
    var oWords = on.split(" ").filter(function(w) { return w.length > 2 })
    var overlap = vWords.filter(function(w) { return oWords.indexOf(w) !== -1 }).length
    if (overlap > 0 && overlap >= Math.min(vWords.length, oWords.length) * 0.5) return 40 + overlap * 10
    return 0
  }

  function fillNativeSelect(el, value, options) {
    var valueLower = normalize(value)

    // GUARD: Long values aren't for dropdowns
    if (valueLower.length > 80) {
      return { ok: false, reason: "value too long for select dropdown" }
    }

    var bestMatch = null
    var bestScore = 0

    for (var i = 0; i < el.options.length; i++) {
      var opt = el.options[i]
      var t = normalize(opt.text)
      var v = normalize(opt.value)
      if (!t && !v) continue

      // Score using fuzzy match against both text and value
      var scoreT = fuzzyMatch(valueLower, t)
      var scoreV = fuzzyMatch(valueLower, v)
      var score = Math.max(scoreT, scoreV)

      // Exact value match bonus
      if (v === valueLower) score = Math.max(score, 100)

      // Boolean normalization
      if (value === true && (t === "yes" || v === "true" || v === "1")) score = Math.max(score, 90)
      if (value === false && (t === "no" || v === "false" || v === "0")) score = Math.max(score, 90)

      // US State normalization: "Texas" ↔ "TX"
      var valState = normalizeState(valueLower)
      var optState = normalizeState(t)
      if (valState.abbr && optState.abbr && valState.abbr === optState.abbr) score = Math.max(score, 95)

      if (score > bestScore) { bestScore = score; bestMatch = opt }
    }

    if (bestMatch && bestScore >= 40) {
      var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      if (setter) setter.call(el, bestMatch.value)
      else el.value = bestMatch.value
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      highlightEl(el, "success")
      return { ok: true, method: "select", selected: bestMatch.text, score: bestScore }
    }

    return { ok: false, reason: "no matching option for: " + value }
  }

  function fillRadio(block, value) {
    var valueLower = normalize(value)
    var radios = block.radioGroupName
      ? document.querySelectorAll('input[type="radio"][name="' + block.radioGroupName + '"]')
      : (block.container ? block.container.querySelectorAll('input[type="radio"]') : [])

    var bestRadio = null
    var bestScore = 0
    var bestLabel = ""

    for (var i = 0; i < radios.length; i++) {
      var radio = radios[i]
      var lbl = radio.closest("label") || document.querySelector('label[for="' + radio.id + '"]')
      var lblText = normalize(lbl ? lbl.textContent : radio.value || "")
      var radioVal = normalize(radio.value)

      // Score using fuzzy match
      var score = Math.max(fuzzyMatch(valueLower, lblText), fuzzyMatch(valueLower, radioVal))

      if (score > bestScore) {
        bestScore = score
        bestRadio = radio
        bestLabel = lblText
      }
    }

    if (bestRadio && bestScore >= 40) {
      bestRadio.click()
      bestRadio.checked = true
      bestRadio.dispatchEvent(new Event("change", { bubbles: true }))
      var parentLbl = bestRadio.closest("label")
      highlightEl(parentLbl || bestRadio, "success")
      return { ok: true, method: "radio", selected: bestLabel, score: bestScore }
    }
    return { ok: false, reason: "no matching radio option for: " + value }
  }

  function fillCheckbox(el, value) {
    var vn = normalize(String(value))
    var shouldCheck = vn === "true" || vn === "yes" || vn === "y" || vn === "checked" || vn === "1" || value === true

    // For consent/agreement checkboxes, also check label context
    if (!shouldCheck) {
      var lbl = el.closest("label")
      var lblText = normalize(lbl ? lbl.textContent : "")
      if (lblText.includes("agree") || lblText.includes("consent") || lblText.includes("acknowledge") || lblText.includes("confirm")) {
        shouldCheck = true
      }
    }

    if (el.checked !== shouldCheck) {
      el.click()
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }
    highlightEl(el, "success")
    return { ok: true, method: "checkbox" }
  }

  // Async fill for custom dropdowns (React-Select, MUI, etc.)
  function fillCustomSelectAsync(block, value) {
    return new Promise(function(resolve) {
      var el = block.element
      var valueLower = normalize(value)

      if (valueLower.length > 80) {
        resolve({ ok: false, reason: "value too long for dropdown" })
        return
      }

      // ── Strategy 1: Type into combobox search input first ──
      // Many custom selects (React-Select, MUI) have an input that filters options
      var isCombobox = el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox"
      var searchInput = el.querySelector("input") || el.closest("[class*='select']")?.querySelector("input:not([type='hidden'])")
      if (!searchInput && isCombobox && el.tagName === "INPUT") searchInput = el

      if (searchInput) {
        searchInput.focus()
        // Type the value to filter options
        var typeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        if (typeSetter) typeSetter.call(searchInput, value)
        else searchInput.value = value
        searchInput.dispatchEvent(new Event("input", { bubbles: true }))
        searchInput.dispatchEvent(new Event("change", { bubbles: true }))
        // Also simulate keydown for React
        searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: value.slice(-1), bubbles: true }))
      }

      // ── Strategy 2: Click to open dropdown ──
      el.click()
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
      var inner = el.querySelector("[class*='value'], [class*='placeholder'], [class*='indicator'], [class*='arrow'], [class*='trigger'], [class*='button']")
      if (inner) inner.click()

      setTimeout(function() {
        // Search for options anywhere (portals render outside container)
        var optSelectors = [
          '[class*="select__option"]', '[class*="option"]:not([class*="control"])',
          '[role="option"]', '[class*="menu"] [class*="item"]',
          '[class*="MenuList"] > div', 'li[id*="option"]', 'li[role="option"]',
          '[class*="MuiMenuItem"]', '[class*="ant-select-item"]',
          '[data-automation-id*="option"]', '[class*="dropdown-item"]',
          '[class*="listbox"] [class*="option"]',
        ]
        var allOpts = document.querySelectorAll(optSelectors.join(", "))

        var bestOpt = null
        var bestScore = 0
        for (var i = 0; i < allOpts.length; i++) {
          var opt = allOpts[i]
          if (!opt.offsetParent && !opt.getBoundingClientRect().height) continue
          var t = normalize(opt.textContent)
          var optVal = normalize(opt.getAttribute("value") || opt.getAttribute("data-value") || "")
          var score = Math.max(fuzzyMatch(valueLower, t), fuzzyMatch(valueLower, optVal))
          if (score > bestScore) { bestScore = score; bestOpt = opt }
        }

        if (bestOpt && bestScore >= 40) {
          bestOpt.click()
          // Also try Enter key to confirm selection (some React-Select variants need this)
          setTimeout(function() {
            document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }))
          }, 100)
          highlightEl(el, "success")
          resolve({ ok: true, method: "customSelect", selected: bestOpt.textContent.trim(), score: bestScore })
        } else {
          // Fallback: type into search and pick first filtered result
          var fallbackInput = document.querySelector(
            '[class*="select__input"] input, [class*="search"] input, ' +
            'input[role="combobox"], [class*="combobox"] input, ' +
            '[class*="MuiAutocomplete"] input, [class*="ant-select-search"] input'
          )
          if (fallbackInput) {
            fallbackInput.focus()
            var fbSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
            if (fbSetter) fbSetter.call(fallbackInput, value)
            else fallbackInput.value = value
            fallbackInput.dispatchEvent(new Event("input", { bubbles: true }))
            fallbackInput.dispatchEvent(new Event("change", { bubbles: true }))
            setTimeout(function() {
              var filtered = document.querySelectorAll('[role="option"], [class*="option"]:not([class*="control"])')
              // Find best match among filtered results
              var bestFiltered = null
              var bestFScore = 0
              for (var fi = 0; fi < filtered.length; fi++) {
                if (!filtered[fi].offsetParent) continue
                var ft = normalize(filtered[fi].textContent)
                var fs = fuzzyMatch(valueLower, ft)
                if (fs > bestFScore) { bestFScore = fs; bestFiltered = filtered[fi] }
              }
              if (bestFiltered && bestFScore >= 30) {
                bestFiltered.click()
                highlightEl(el, "success")
                resolve({ ok: true, method: "customSelect_search", selected: bestFiltered.textContent.trim() })
              } else if (filtered.length > 0 && filtered[0].offsetParent) {
                // Just pick the first visible option
                filtered[0].click()
                highlightEl(el, "success")
                resolve({ ok: true, method: "customSelect_first", selected: filtered[0].textContent.trim() })
              } else {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
                resolve({ ok: false, reason: "no matching custom option" })
              }
            }, 300)
          } else {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
            resolve({ ok: false, reason: "no matching custom option for: " + value })
          }
        }
      }, 400)
    })
  }

  // ── 6. Verification ───────────────────────────────────────────────────

  function verifyFill(block) {
    var newValue = readCurrentValue(block.element, block.inputType, block.radioGroupName)
    return newValue && newValue.trim() !== "" && newValue.toLowerCase() !== "select" && newValue.toLowerCase() !== "select..."
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
    // Common career page patterns
    if (path.includes("/careers") || path.includes("/jobs") || path.includes("/apply")) return "generic_career"
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
    // Returns { blocks, filled, skipped, needsAI, needsReview }
    fillAll: function(profileData) {
      var blocks = scanPage()
      blocks = applyPortalAdapter(blocks)  // Apply portal-specific fixes
      var results = { filled: [], skipped: [], needsAI: [], needsReview: [], needsAsync: [], total: blocks.length, portal: detectPortal() }

      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i]

        // Skip non-empty fields
        if (!block.isEmpty) {
          results.skipped.push({ label: block.questionText.slice(0, 50), reason: "already filled" })
          continue
        }

        // Resolve answer
        var answer = resolveAnswer(block, profileData)
        block.suggestedAnswer = answer.value
        block.answerSource = answer.source

        if (answer.source === "ai") {
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
          results.needsReview.push({ label: block.questionText.slice(0, 50), intent: block.intent })
          continue
        }

        if (!answer.value) {
          results.skipped.push({ label: block.questionText.slice(0, 50), reason: "no answer available" })
          continue
        }

        // Fill
        var fillResult = fillBlock(block, answer.value)

        if (fillResult.reason === "needs_async") {
          results.needsAsync.push({
            blockId: block.blockId,
            selector: block.selector,
            label: block.questionText,
            inputType: block.inputType,
            value: answer.value,
            element: block.element,
            container: block.container,
          })
          continue
        }

        if (fillResult.ok) {
          // Verify the fill actually worked
          var verified = verifyFill(block)
          block.status = verified ? "filled" : "unverified"
          results.filled.push({
            label: block.questionText.slice(0, 50),
            value: String(answer.value).slice(0, 30),
            source: answer.source,
            method: fillResult.method,
            verified: verified,
          })
        } else {
          results.skipped.push({ label: block.questionText.slice(0, 50), reason: fillResult.reason })
        }
      }

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
