# Autofill Engine — Testing & Triage Checklist

## Console Log Filters

| Filter | What it shows |
|--------|--------------|
| `[YH-Fill]` | All fill operations (sync text/select/radio/checkbox) |
| `[YH-Option]` | **Every option-based fill** — label, intent, raw→adapted, strategy, selected, polarity check |
| `[YH-Option] ✗` | Failed option fills with full trace |
| `[YH-Option] POLARITY MISMATCH` | **Critical**: engine selected wrong yes/no option — auto-blocked |
| `[YH-Combo]` | All combobox/custom-select operations (async) |
| `[YH-Combo] FAIL` | Only failed combobox fills — shows failureCode |
| `[YH-Fill] FAIL` | Only failed sync fills — shows failReason + optionCount |
| `[YH-Fill] UNVERIFIED` | Fills that succeeded but verification failed |
| `[YH-Fill] select miss` | Native select couldn't match value — shows available options |
| `[YH-Panel]` | Content.js panel-level failures with correlation data |

---

## Failure Code Taxonomy

When a combobox fill fails, the `[YH-Combo] FAIL` trace includes a `failureCode`:

| Code | Meaning | First thing to check |
|------|---------|---------------------|
| `no_input_found` | Couldn't find `<input>` inside the combobox to type into | Inspect DOM — is the input a sibling? Inside an iframe? |
| `no_options_found` | 0 option elements appeared after opening dropdown | Does the portal render options inside a React portal/overlay? |
| `wrong_option_match` | Options found but best fuzzy score < 30 | Check `sampleOptions` — is the value worded differently? |
| `selection_not_committed` | Clicked the option but `visibleText` didn't update | Portal may need extra events (e.g. Workday needs `mouseup`) |
| `dropdown_not_closed` | Listbox/menu still open after selection | Portal may need Escape or click-outside to close |
| `hidden_value_not_updated` | No hidden `<input>` or `data-value` got set | Check form submission — does this portal use a different state mechanism? |
| `aria_navigation_failed` | Strategy E: ArrowDown never reached a matching option | Combobox may filter options server-side; try different search text |
| `overlay_not_found` | No portal/popover/overlay container exists in DOM | Options might be in an iframe or shadow DOM |
| `portal_specific_selector_miss` | Portal adapter didn't recover the field label | Add selector to `applyPortalAdapter` for this portal |
| `value_too_long` | Intended value > 80 chars | This field shouldn't be a dropdown — check classification |
| `error` | JS exception thrown | Read the error message in the trace |

---

## Portal Triage: Greenhouse

### DOM patterns
- Country/State: `<select>` (native) or React-Select `[class*="select__control"]`
- Work auth/sponsorship: `<input type="radio">` in `<fieldset>`
- Labels: `<label for="...">` or `<legend>` inside fieldset
- Custom questions: wrapped in `div` with numeric `data-qa` IDs

### Top fields likely to fail

| Field | Likely failure | Signal to inspect first |
|-------|---------------|------------------------|
| **Country** | `wrong_option_match` — "United States of America" vs option text "United States" | `[YH-Fill] select miss` → `sampleOptions` |
| **State** | `wrong_option_match` — "Texas" vs "TX" or vice versa | `[YH-Fill] select miss` → check if abbr or full name |
| **Work auth** | Skipped — empty profile value | `[YH-Fill] → Skip` → check `pd.workAuthorization` |
| **Sponsorship** | Skipped — empty profile value | `[YH-Fill] → Skip` → check `pd.sponsorship` |
| **How did you hear** | `wrong_option_match` — AI answer doesn't match any option | `[YH-Fill] select miss` → `sampleOptions` |
| **Custom question (ID label)** | `portal_specific_selector_miss` — label is "question 14412335008" | `[YH-Fill] → AI needed` → check questionText |

### Test steps
1. Open any `boards.greenhouse.io` application
2. Click Fill All
3. Filter console: `[YH-`
4. Check Country/State in `[YH-Combo]` or `[YH-Fill] select miss`
5. Check Work Auth/Sponsorship — should be `✓` not `→ Skip`
6. If Country failed: copy `sampleOptions` from log, check if any variant matches

---

## Portal Triage: Workday

### DOM patterns
- All inputs use `data-automation-id` attributes
- Comboboxes: `[role="combobox"]` with `aria-activedescendant`
- Options: rendered in overlay `[data-automation-id*="popup"]`
- Labels: `[data-automation-id="formLabel"]` as sibling
- Multi-step: "Next" button has `data-automation-id="bottom-navigation-next-button"`

### Top fields likely to fail

| Field | Likely failure | Signal to inspect first |
|-------|---------------|------------------------|
| **Country** | `no_options_found` — options in overlay portal | `[YH-Combo]` → `optionsFound` on each strategy |
| **State** | `aria_navigation_failed` — options filtered server-side | `[YH-Combo]` → Strategy E → did `aria-activedescendant` ever appear? |
| **Source (how did you hear)** | `no_input_found` — combobox structure different | `[YH-Combo]` → `hasSearchInput` |
| **Work auth** | `selection_not_committed` — clicked but React state didn't update | `[YH-Combo]` → verification signals |
| **City** | Text field — should be `✓` | `[YH-Fill]` → verify not `UNVERIFIED` |

### Test steps
1. Open any `*.myworkday.com` application
2. Click Fill All
3. Filter console: `[YH-Combo]`
4. Check if Country trace shows `strategyE` was attempted
5. Look for `aria-activedescendant` in the DOM (inspect the combobox input)
6. If `no_options_found`: inspect for `[data-automation-id*="popup"]` overlays
7. Check if Next button auto-clicked: look for "Advancing to next section" in panel

---

## Portal Triage: Lever

### DOM patterns
- Labels: `.application-label` or `[data-qa]` attributes
- Fields: standard `<input>` and `<select>`, some React-Select
- Questions: wrapped in `.application-question` divs
- File uploads: standard `<input type="file">`

### Top fields likely to fail

| Field | Likely failure | Signal to inspect first |
|-------|---------------|------------------------|
| **Location** | `wrong_option_match` — custom select with city names | `[YH-Combo]` → check variant list includes city |
| **Work auth** | Label not recovered — `data-qa` miss | `[YH-Fill] → AI needed` with short/empty label |
| **Custom questions** | Unknown intent → sent to AI | `[YH-Fill] → AI needed` — check if shape is correct |
| **Resume** | Skipped (file type) | Expected — manual upload |

### Test steps
1. Open any `jobs.lever.co` application
2. Click Fill All
3. Filter: `[YH-Fill]` — check all fields got labels
4. Check any `→ AI needed` entries — are labels meaningful or empty?
5. If empty labels: look at `data-qa` attributes in DOM inspector

---

## Debug Workflow: When a Field Fails

### Step 1: Identify the failure
```
Console filter: [YH-Combo] FAIL   (for dropdowns)
Console filter: [YH-Fill] FAIL    (for text/select/radio)
Console filter: [YH-Fill] UNVERIFIED  (for fills that didn't stick)
```

### Step 2: Read the trace
Copy the JSON object. Key fields:
- `failureCode` → look up in taxonomy table above
- `strategies` → array of per-strategy attempts (A through E)
- `optionsFound` → 0 means the option selectors don't work for this portal
- `hasSearchInput` → false means the engine can't type into the combobox

### Step 3: Inspect the DOM
Right-click the failing field → Inspect
- What `role` does it have?
- Where are options rendered? (inside element? in an overlay? in shadow DOM?)
- Does it use `aria-activedescendant`?
- What `data-automation-id` or `class` does the container have?

### Step 4: Correlate with panel log
```
Console filter: [YH-Panel]
```
This shows the content.js-level view:
- Did it find the element by selector?
- Did it retry?
- What was the final failure reason?

### Step 5: Report format
When filing a bug or patching, include:
```
Portal: greenhouse
Field: Country
Label recovered: "Country"
Intent classified: country
Input type: customSelect
Element: <div role="combobox" class="select__control css-xxx">
Trace: { failureCode: "no_options_found", strategies: [...] }
Options location: React portal at document.body > div.select__menu-portal
Fix needed: add selector '[class*="menu-portal"] [class*="option"]'
```

---

## Regression Checklist (run after any engine change)

| # | Test | Console filter | Expected |
|---|------|---------------|----------|
| 1 | Greenhouse country | `[YH-Combo]` or `[YH-Fill] select miss` | `result: "success"` |
| 2 | Greenhouse state | `[YH-Combo]` or `[YH-Fill]` | `result: "success"` |
| 3 | Greenhouse work auth | `[YH-Fill] ✓` | `workAuth = Yes` |
| 4 | Greenhouse sponsorship | `[YH-Fill] ✓` | `sponsorship = No` |
| 5 | Workday country | `[YH-Combo]` | `result: "success"` |
| 6 | Workday state | `[YH-Combo]` | `result: "success"` |
| 7 | Boolean question | `[YH-Fill] ✓` | value is "Yes" or "No", not an essay |
| 8 | Years of experience | `[YH-Fill] ✓` | numeric value |
| 9 | Already-filled field | `[YH-Fill]` | `reason: "already filled"` |
| 10 | Sensitive field (gender/race) | `[YH-Fill] → Review` | `intent: "gender"` or `"race"` |
| 11 | Multi-step Next button | Panel log | "Advancing to next section" |
| 12 | AI essay question | `[YH-Fill] → AI needed` | `shape: "essay"` |

---

## Option-Field Validation Matrix

### How to read `[YH-Option]` traces

Every native select and radio fill logs a JSON trace:
```json
{
  "label": "Country",
  "intent": "country",
  "shape": "enum_choice",
  "fieldType": "nativeSelect",
  "rawAnswer": "United States of America",
  "adaptedAnswer": "United States",
  "adapted": true,
  "adaptRule": "country_variant: United States of America → United States",
  "strategy": "select",
  "selectedOption": "United States",
  "score": 100,
  "ok": true
}
```

If `adapted: true`, the `adaptRule` field tells you WHY:
- `state_normalization: Texas → TX` — normalizeState matched abbreviation
- `country_variant: United States of America → United States` — COUNTRY_VARIANTS group
- `education_equiv(master): Master's → Master's Degree` — EDUCATION_EQUIVALENCES
- `years_range: 5 → 3-5 years` — numeric range matching
- `fuzzy_adapt: X → Y` — generic fuzzy match

If `polarityMismatch: true` appears, the engine **blocked a wrong selection** (e.g. "Yes" intended but "No, I am not..." was about to be selected). This is logged at `[YH-Option] POLARITY MISMATCH`.

---

### Greenhouse — Option Field Matrix

| Field | Field type | Profile key | Raw answer | Likely option text | Adapt rule | Layer to check if fail |
|-------|-----------|------------|------------|-------------------|------------|----------------------|
| Country | native select | hardcoded | "United States of America" | "United States", "United States of America" | country_variant | `[YH-Option]` → score |
| State | native select | location split | "Texas" | "Texas", "TX" | state_normalization | `[YH-Option]` → adaptedAnswer |
| Education | native select | pd.education | "Master's" | "Master's Degree", "MS" | education_equiv(master) | `[YH-Option]` → adaptRule |
| Years exp | native select | calculated | "5" | "3-5 years", "5+ years" | years_range | `[YH-Option]` → adaptedAnswer |
| Work auth | radio | pd.workAuthorization | "Yes" | "Yes, I am legally authorized..." | polarity(positive) | `[YH-Option]` → score, polarity |
| Sponsorship | radio | pd.sponsorship | "No" | "No, I will not require..." | polarity(negative) | `[YH-Option]` → score, polarity |
| Relocation | radio | pd.relocation | "Yes"/"No" | "Yes"/"No" | polarity | `[YH-Option]` → score |

**Test steps:**
1. Open Greenhouse application
2. Click Fill All
3. Filter console: `[YH-Option]`
4. For EACH row above: find the trace, verify `ok: true`
5. If `adapted: true`: verify `adaptRule` is correct
6. If work auth/sponsorship: verify NO `POLARITY MISMATCH` error
7. Visually confirm the form shows correct selections

---

### Workday — Option Field Matrix

| Field | Field type | Profile key | Raw answer | Likely option text | Strategy | Layer to check if fail |
|-------|-----------|------------|------------|-------------------|----------|----------------------|
| Country | customSelect | hardcoded | "United States of America" | "United States of America" | A or E | `[YH-Combo]` → strategy |
| State | customSelect | location split | "Texas" | "Texas" | A, B, or E | `[YH-Combo]` → strategy |
| Work auth | radio or select | pd.workAuthorization | "Yes" | "Yes"/"No" | polarity | `[YH-Option]` → polarity |
| Sponsorship | radio or select | pd.sponsorship | "No" | "Yes"/"No" | polarity | `[YH-Option]` → polarity |
| Source | customSelect | pd.referralSource | varies | "LinkedIn", "Referral", etc. | A or C | `[YH-Combo]` → optionsFound |

**Test steps:**
1. Open Workday application
2. Click Fill All
3. Filter console: `[YH-Combo]` for custom selects, `[YH-Option]` for radio/native
4. Verify Country/State traces show `result: "success"`
5. Verify work auth/sponsorship show correct polarity match

---

### Lever — Option Field Matrix

| Field | Field type | Profile key | Raw answer | Likely option text | Layer to check if fail |
|-------|-----------|------------|------------|-------------------|----------------------|
| Location | customSelect or text | pd.location | "Arlington, TX" | varies | `[YH-Combo]` or text |
| Work auth | radio | pd.workAuthorization | "Yes" | "Yes"/"No" | `[YH-Option]` → polarity |
| Sponsorship | radio | pd.sponsorship | "No" | "Yes"/"No" | `[YH-Option]` → polarity |
| Source | native select | pd.referralSource | varies | "LinkedIn", etc. | `[YH-Option]` → score |

**Test steps:**
1. Open Lever application
2. Click Fill All
3. Filter console: `[YH-Option]` for selects/radios
4. Verify polarity is correct for auth/sponsorship
5. Check if any `[YH-Fill] select miss` appears for source field

---

### Opposite-Option Safety Checks

The polarity guard runs AFTER the fill but BEFORE reporting success. If it detects a mismatch:
1. Reverts the native select to index 0
2. Highlights the field in red
3. Logs `[YH-Option] POLARITY MISMATCH` at error level
4. Returns `ok: false` with reason `polarity_mismatch`

**Fields that MUST pass polarity check:**
- [ ] Work authorization: "Yes" → must select positive option, NEVER negative
- [ ] Sponsorship: "No" → must select negative option, NEVER positive
- [ ] Relocation: must match profile preference
- [ ] Interview history: "No" → must select negative
- [ ] Any yes/no dropdown with long option labels

**How to test polarity guard:**
1. Filter console: `[YH-Option] POLARITY`
2. If you see ANY result, the guard prevented a wrong selection
3. Investigate the trace: what was `intendedPolarity` vs `selectedPolarity`?
4. Check if the option text starts with the wrong word (e.g. "No, I am not..." when "Yes" was intended)

---

### Failure Layer Identification Guide

When a field fails, the trace tells you which layer broke:

| Symptom in trace | Failing layer | What to fix |
|-----------------|---------------|-------------|
| `intent: "unknown"` | Classification | Add pattern to `INTENT_PATTERNS` for this label |
| `adaptedAnswer` same as `rawAnswer` and `score < 40` | Answer adaptation | Add equivalence to `adaptAnswerToOptions` for this intent |
| `adapted: true` but wrong option selected | Option scoring | Check `fuzzyMatch` — is the adapted value ambiguous? |
| `commitSignals.valueUpdated: false` | Native select commit | Portal uses non-standard value mechanism — check DOM |
| `commitSignals.indexChanged: false` | Native select commit | React controlled select — try `selectedIndex` setter |
| `polarityMismatch: true` | Polarity guard (blocked) | Good — guard prevented mistake. But why did the wrong option score higher? |
| `ok: false, reason: "no matching option"` | Option scoring | Check `[YH-Fill] select miss` for `sampleOptions` |
| `[YH-Combo] FAIL` with `no_options_found` | Portal selector | Options rendered in unknown container — add selector |
| `[YH-Combo] FAIL` with `aria_navigation_failed` | Strategy E | Combobox filters differently — try different search text |
