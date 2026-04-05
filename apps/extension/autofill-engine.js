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

  // US-only product — optimized for US job application patterns
  var INTENT_PATTERNS = {
    // ── Tier 1: Identity / Contact (deterministic from profile) ──
    firstName:       { patterns: ["first name", "first_name", "fname", "given name", "given_name"], category: "identity" },
    lastName:        { patterns: ["last name", "last_name", "lname", "surname", "family name", "family_name"], category: "identity" },
    fullName:        { patterns: ["full name", "your name", "candidate name", "applicant name", "fullname", "name *"], category: "identity" },
    preferredName:   { patterns: ["preferred name", "preferred first", "nickname", "goes by", "known as"], category: "identity" },
    email:           { patterns: ["email", "e-mail", "email address"], category: "identity" },
    phone:           { patterns: ["phone", "mobile", "telephone", "cell", "contact number", "phone number"], category: "identity" },
    address:         { patterns: ["street address", "address line", "mailing address", "home address", "your address", "address from which", "what is your address"], category: "identity" },
    city:            { patterns: ["city", "town"], category: "identity" },
    state:           { patterns: ["state"], category: "identity" },
    zip:             { patterns: ["zip", "zip code", "postal code"], category: "identity" },
    country:         { patterns: ["country"], category: "identity", maxLabelLen: 30 },
    location:        { patterns: ["location", "where are you located", "based in", "current location"], category: "identity" },
    linkedin:        { patterns: ["linkedin", "linkedin profile", "linkedin url", "linkedin link"], category: "identity" },
    github:          { patterns: ["github", "github url", "github profile"], category: "identity" },
    portfolio:       { patterns: ["portfolio", "website", "personal site", "personal url", "personal website", "home page"], category: "identity" },

    // ── Tier 1: Professional (from profile) ──
    currentCompany:  { patterns: ["current company", "current employer", "company name", "employer name", "present company"], category: "professional" },
    currentTitle:    { patterns: ["current title", "current role", "job title", "current position", "present title"], category: "professional" },
    yearsExp:        { patterns: ["years of experience", "how many years", "years experience", "total experience", "work experience"], category: "professional" },
    skills:          { patterns: ["skills", "key skills", "technical skills", "core competencies"], category: "professional" },
    certifications:  { patterns: ["certifications", "certification", "certified", "licenses"], category: "professional" },
    education:       { patterns: ["education", "highest degree", "degree", "university", "school", "academic"], category: "professional" },
    gradYear:        { patterns: ["graduation year", "year of graduation", "grad year", "when did you graduate"], category: "professional" },
    publications:    { patterns: ["publication", "publications", "research", "google scholar", "semantic scholar", "papers"], category: "professional" },

    // ── Tier 1: US Work Authorization (from stored preferences) ──
    workAuth:        { patterns: ["authorized to work", "legally authorized", "work authorization", "right to work", "eligible to work", "work in the u.s", "work in the us", "legally permitted", "employment eligibility"], category: "authorization" },
    sponsorship:     { patterns: ["sponsorship", "sponsor", "visa", "h-1b", "h1b", "require sponsorship", "need sponsorship", "require visa", "employer sponsorship", "employment visa", "immigration"], category: "authorization" },
    visaType:        { patterns: ["visa type", "visa status", "immigration status", "opt", "cpt", "stem opt", "green card", "citizenship", "ead"], category: "authorization" },

    // ── Tier 2: AI Contextual (answered by AI using job context) ──
    relocation:      { patterns: ["relocat", "willing to move", "open to moving"], category: "contextual" },

    // Motivation
    whyCompany:      { patterns: ["why this company", "why do you want to work", "why anthropic", "why are you interested in", "what interests you about", "what attracts you"], category: "motivation" },
    whyRole:         { patterns: ["why this role", "why this position", "what excites you about this role", "interest in this role", "why are you applying"], category: "motivation" },
    whyFit:          { patterns: ["why should we hire", "why are you a good fit", "what makes you a good candidate", "what do you bring"], category: "motivation" },

    // Technical
    techExperience:  { patterns: ["experience with", "proficiency in", "familiar with", "knowledge of", "expertise in", "worked with"], category: "technical" },
    projectDesc:     { patterns: ["describe a project", "relevant project", "technical achievement", "most proud of", "piece of work"], category: "technical" },
    codingLang:      { patterns: ["coding language", "programming language", "preferred language", "python or typescript", "interview language"], category: "technical" },
    researchBlog:    { patterns: ["research blog", "blog post", "next research", "red.anthropic"], category: "technical" },

    // Behavioral
    leadership:      { patterns: ["leadership example", "led a team", "management experience", "leadership style"], category: "behavioral" },
    conflict:        { patterns: ["conflict resolution", "disagreement", "handled a conflict", "difficult coworker"], category: "behavioral" },
    failure:         { patterns: ["failure", "mistake", "learned from", "setback", "challenge you overcame"], category: "behavioral" },
    teamwork:        { patterns: ["teamwork", "collaboration", "worked with a team", "team player", "cross-functional"], category: "behavioral" },

    // Contextual — answered by AI using job context (location, remote type, etc.)
    locationPref:    { patterns: ["location preference", "preferred location", "preferred office", "which office"], category: "contextual" },
    remotePref:      { patterns: ["remote", "hybrid", "in-person", "on-site", "work from home", "in one of our offices"], category: "contextual" },
    travelWilling:   { patterns: ["travel", "travel willingness", "travel required", "willing to travel"], category: "contextual" },
    shiftAvail:      { patterns: ["shift", "availability", "schedule preference", "working hours"], category: "contextual" },
    contractPref:    { patterns: ["contract", "full-time", "part-time", "employment type", "engagement type"], category: "contextual" },
    dfwArea:         { patterns: ["dfw area", "located in the dfw", "dallas", "fort worth"], category: "contextual" },
    salaryExpect:    { patterns: ["salary expectation", "expected salary", "desired salary", "compensation expectation", "salary requirement"], category: "contextual" },
    startDateCtx:    { patterns: ["earliest start", "when can you start", "start date", "earliest you would", "available to start"], category: "contextual" },
    timeBreakdown:   { patterns: ["ideal breakdown", "how do you spend", "time in a working week"], category: "contextual" },

    // Logistics — simple rule-based (profile-stored answers)
    interviewedBefore: { patterns: ["interviewed before", "interviewed at", "ever interviewed", "previously applied", "applied before"], category: "logistics" },

    // Compliance / Consent
    termsConsent:    { patterns: ["terms", "terms of service", "terms and conditions", "agree to"], category: "consent" },
    privacyConsent:  { patterns: ["privacy", "privacy policy", "privacy notice", "data processing"], category: "consent" },
    smsConsent:      { patterns: ["sms", "text message", "receive text", "opt in", "opt-in", "messaging"], category: "consent" },
    bgCheck:         { patterns: ["background check", "background screening", "criminal record"], category: "consent" },
    aiPolicy:        { patterns: ["ai policy", "ai partnership", "confirm your understanding", "acknowledge"], category: "consent" },

    // Sensitive / Self-ID — NEVER auto-fill, always REVIEW
    gender:          { patterns: ["gender"], category: "sensitive", excludePatterns: ["transgender"] },
    race:            { patterns: ["race"], category: "sensitive" },
    ethnicity:       { patterns: ["ethnicity", "ethnic", "hispanic", "latino", "latina", "latinx", "hispanic/latino"], category: "sensitive" },
    veteran:         { patterns: ["veteran"], category: "sensitive" },
    disability:      { patterns: ["disability", "disabled", "accommodation"], category: "sensitive" },
    // pronouns is defined above in identity section with category: "sensitive"

    // Open-ended
    additionalInfo:  { patterns: ["additional information", "anything else", "additional comments", "is there anything", "cover letter"], category: "openEnded" },
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
    // Tier 2 — AI contextual (uses job context)
    contextual:    "ai",            // relocation, DFW, remote, salary, start date
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
      suggestedAnswer: null,  // filled in resolve step
      answerSource:    null,
      fillStrategy:    inputType, // how to interact
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

    // Fallback: textarea with long helper text → open-ended
    if (bestIntent === "unknown" && inputType === "longText") {
      bestIntent = "additionalInfo"
      bestCategory = "openEnded"
      bestConfidence = 40
    }

    // Fallback: select with yes/no options → likely authorization question
    if (bestIntent === "unknown" && (inputType === "nativeSelect" || inputType === "customSelect")) {
      var elText = textLower
      if (elText.includes("yes") || elText.includes("no")) {
        bestIntent = "yesNoQuestion"
        bestCategory = "logistics"
        bestConfidence = 30
      }
    }

    return { intent: bestIntent, category: bestCategory, confidence: bestConfidence }
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
    // Parse location into city/state for US addresses (e.g. "Arlington, Texas" → city: "Arlington", state: "Texas")
    var locParts = (pd.location || "").split(",").map(function(s) { return s.trim() })
    var cityVal = locParts[0] || ""
    var stateVal = locParts[1] || ""

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
      state: stateVal,
      zip: pd.zip || pd.zipCode || "",
      location: pd.location,
      linkedin: pd.linkedin,
      github: pd.github,
      portfolio: pd.portfolio,
      country: "United States",  // US-only product
      // Tier 1: US Work Authorization — deterministic from workAuthType
      // Backend derives these from workAuthType (citizen→Yes/No, H-1B→Yes/Yes, etc.)
      workAuth: pd.workAuthorization || "",
      sponsorship: pd.sponsorship || "",
      visaType: pd.visaStatus || pd.visaType || "",
      // Tier 1: Professional
      currentCompany: pd.headline || pd.currentCompany || "",
      currentTitle: pd.currentTitle || pd.headline || "",
      publications: pd.publications || "",
      yearsExp: pd.yearsExperience || "",
      skills: pd.skills || "",
      education: pd.education || pd.degree || "",
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

  function fillNativeSelect(el, value, options) {
    var valueLower = value.toLowerCase().trim()

    // GUARD: If value is very long (>50 chars), it's not meant for a select dropdown
    if (valueLower.length > 50) {
      return { ok: false, reason: "value too long for select dropdown" }
    }

    // Build scored matches
    var bestMatch = null
    var bestScore = 0

    for (var i = 0; i < el.options.length; i++) {
      var opt = el.options[i]
      var t = opt.text.toLowerCase().trim()
      var v = opt.value.toLowerCase().trim()
      if (!t && !v) continue // skip empty options
      var score = 0

      if (t === valueLower || v === valueLower) score = 100
      else if (t.startsWith(valueLower)) score = 80
      else if (valueLower.startsWith(t) && t.length > 2) score = 70
      else if (t.includes(valueLower)) score = 60
      else if (valueLower.includes(t) && t.length > 3) score = 50
      // Yes/No normalization
      else if (valueLower === "yes" && (t === "yes" || v === "yes" || v === "true" || t.startsWith("yes"))) score = 90
      else if (valueLower === "no" && (t === "no" || v === "no" || v === "false" || t.startsWith("no"))) score = 90
      // Country code normalization
      else if (valueLower === "united states" && (t.includes("united states") || t.includes("+1") || v === "us" || v === "usa" || v === "1" || v === "+1")) score = 85
      // Boolean to Yes/No
      else if (value === true && (t === "yes" || v === "true")) score = 90
      else if (value === false && (t === "no" || v === "false")) score = 90

      if (score > bestScore) { bestScore = score; bestMatch = opt }
    }

    if (bestMatch && bestScore >= 50) {
      var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      if (setter) setter.call(el, bestMatch.value)
      else el.value = bestMatch.value
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      highlightEl(el, "success")
      return { ok: true, method: "select", selected: bestMatch.text }
    }

    return { ok: false, reason: "no matching option for: " + value }
  }

  function fillRadio(block, value) {
    var valueLower = value.toLowerCase().trim()
    var radios = block.radioGroupName
      ? document.querySelectorAll('input[type="radio"][name="' + block.radioGroupName + '"]')
      : (block.container ? block.container.querySelectorAll('input[type="radio"]') : [])

    for (var i = 0; i < radios.length; i++) {
      var radio = radios[i]
      var lbl = radio.closest("label") || document.querySelector('label[for="' + radio.id + '"]')
      var lblText = (lbl ? lbl.textContent.trim() : radio.value || "").toLowerCase()

      if (lblText === valueLower ||
          (valueLower === "yes" && lblText.startsWith("yes")) ||
          (valueLower === "no" && (lblText === "no" || lblText.startsWith("no,"))) ||
          lblText.includes(valueLower)) {
        radio.click()
        radio.checked = true
        radio.dispatchEvent(new Event("change", { bubbles: true }))
        highlightEl(lbl || radio, "success")
        return { ok: true, method: "radio", selected: lblText }
      }
    }
    return { ok: false, reason: "no matching radio option" }
  }

  function fillCheckbox(el, value) {
    var shouldCheck = value === true || value === "true" || value === "Yes" || value === "yes" || value === "checked"
    if (el.checked !== shouldCheck) {
      el.click()
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }
    highlightEl(el, "success")
    return { ok: true, method: "checkbox" }
  }

  // Async fill for custom dropdowns
  function fillCustomSelectAsync(block, value) {
    return new Promise(function(resolve) {
      var el = block.element
      var valueLower = value.toLowerCase().trim()

      // GUARD: If value is very long, it's not meant for a dropdown
      if (valueLower.length > 80) {
        resolve({ ok: false, reason: "value too long for dropdown" })
        return
      }

      // Click to open
      el.click()
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
      var inner = el.querySelector("[class*='value'], [class*='placeholder'], [class*='indicator'], [class*='arrow']")
      if (inner) inner.click()

      setTimeout(function() {
        // Search for options anywhere (portals render outside)
        var optSelectors = [
          '[class*="select__option"]', '[class*="option"]:not([class*="control"])',
          '[role="option"]', '[class*="menu"] [class*="item"]',
          '[class*="MenuList"] > div', 'li[id*="option"]', 'li[role="option"]',
          '[class*="MuiMenuItem"]', '[class*="ant-select-item"]',
          '[data-automation-id*="option"]', '[class*="dropdown-item"]',
        ]
        var allOpts = document.querySelectorAll(optSelectors.join(", "))

        var bestOpt = null
        var bestScore = 0
        for (var i = 0; i < allOpts.length; i++) {
          var opt = allOpts[i]
          if (!opt.offsetParent && !opt.getBoundingClientRect().height) continue
          var t = opt.textContent.trim().toLowerCase()
          var score = 0
          if (t === valueLower) score = 100
          else if (t.startsWith(valueLower)) score = 80
          else if (valueLower.startsWith(t) && t.length > 2) score = 70
          else if (t.includes(valueLower)) score = 60
          else if (valueLower.includes(t) && t.length > 3) score = 50
          else if (valueLower === "yes" && t.startsWith("yes")) score = 90
          else if (valueLower === "no" && (t === "no" || t.startsWith("no,"))) score = 90
          else if (valueLower === "united states" && (t.includes("united states") || t.includes("+1") || t === "us")) score = 85
          if (score > bestScore) { bestScore = score; bestOpt = opt }
        }

        if (bestOpt && bestScore >= 50) {
          bestOpt.click()
          highlightEl(el, "success")
          resolve({ ok: true, method: "customSelect", selected: bestOpt.textContent.trim() })
        } else {
          // Try typing into search
          var searchInput = document.querySelector('[class*="select__input"] input, [class*="search"] input, input[role="combobox"]')
          if (searchInput) {
            searchInput.focus()
            searchInput.value = value
            searchInput.dispatchEvent(new Event("input", { bubbles: true }))
            setTimeout(function() {
              var filtered = document.querySelectorAll('[role="option"], [class*="option"]')
              if (filtered.length > 0 && filtered[0].offsetParent) {
                filtered[0].click()
                highlightEl(el, "success")
                resolve({ ok: true, method: "customSelect_search", selected: filtered[0].textContent.trim() })
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
      setTimeout(function() {
        el.style.outline = ""
        el.style.outlineOffset = ""
      }, 3000)
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  return {
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
      var results = { filled: [], skipped: [], needsAI: [], needsReview: [], needsAsync: [], total: blocks.length }

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
