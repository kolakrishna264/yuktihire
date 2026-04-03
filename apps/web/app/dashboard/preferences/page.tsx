"use client"

import { useEffect, useState, useRef, KeyboardEvent } from "react"
import { usePreferences, useUpdatePreferences } from "@/lib/hooks/usePreferences"
import { Input } from "@/components/ui/Input"
import { Loader2, CheckCircle2, X } from "lucide-react"
import Link from "next/link"

const WORK_TYPES = ["Remote", "Hybrid", "On-site"] as const

const EXPERIENCE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Entry Level", value: "Entry Level" },
  { label: "Mid Level", value: "Mid Level" },
  { label: "Senior", value: "Senior" },
  { label: "Lead / Principal", value: "Lead / Principal" },
]

const VISA_OPTIONS = [
  { label: "Not Important", value: "" },
  { label: "Preferred", value: "Preferred" },
  { label: "Required", value: "Required" },
]

const SUGGESTED_TITLES = [
  "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
  "Data Engineer", "Data Analyst", "Data Scientist", "ML Engineer", "AI Engineer",
  "Machine Learning Engineer", "DevOps Engineer", "QA Engineer", "Test Engineer",
  "Cloud Engineer", "Platform Engineer", "Security Engineer", "SRE",
  "Analytics Engineer", "BI Analyst", "Product Analyst", "MLOps Engineer",
]

const SUGGESTED_LOCATIONS = [
  "Remote", "United States", "Texas", "California", "New York", "Seattle", "Austin",
  "Dallas", "Chicago", "San Francisco", "Boston", "Atlanta",
]

const SUGGESTED_INDUSTRIES = [
  "Technology", "Healthcare", "Finance", "Banking", "E-commerce", "SaaS",
  "Consulting", "Telecommunications", "Education", "Retail", "Manufacturing",
]

const SUGGESTED_SKILLS = [
  "Python", "SQL", "AWS", "Azure", "GCP", "Spark", "Airflow", "Snowflake", "Databricks",
  "Tableau", "Power BI", "Machine Learning", "Deep Learning", "NLP", "GenAI", "LLM",
  "React", "JavaScript", "TypeScript", "Java", "Docker", "Kubernetes", "Terraform", "ETL",
]

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

// -- Tag Input Component -------------------------------------------------------

function TagInput({
  values,
  onChange,
  suggestions,
  placeholder,
}: {
  values: string[]
  onChange: (values: string[]) => void
  suggestions: string[]
  placeholder: string
}) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput("")
  }

  function removeTag(tag: string) {
    onChange(values.filter((v) => v !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      removeTag(values[values.length - 1])
    }
  }

  const remainingSuggestions = suggestions.filter((s) => !values.includes(s))

  return (
    <div>
      {/* Current tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      />

      {/* Suggestions */}
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Section Header Component --------------------------------------------------

function SectionHeader({ label, filled }: { label: string; filled: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1.5">
      <span
        className={`text-sm ${filled ? "text-emerald-500" : "text-gray-300"}`}
      >
        {filled ? "\u2713" : "\u25CB"}
      </span>
      {label}
    </label>
  )
}

// -- Main Page Component -------------------------------------------------------

export default function PreferencesPage() {
  const { data: prefs, isLoading } = usePreferences()
  const update = useUpdatePreferences()

  const [titles, setTitles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [minSalary, setMinSalary] = useState("")
  const [maxSalary, setMaxSalary] = useState("")
  const [experience, setExperience] = useState("")
  const [visa, setVisa] = useState("")
  const [saved, setSaved] = useState(false)
  const [saveButtonState, setSaveButtonState] = useState<"idle" | "saving" | "success">("idle")

  /* pre-fill from server */
  useEffect(() => {
    if (!prefs) return
    setTitles(prefs.preferredTitles ?? [])
    setLocations(prefs.preferredLocations ?? [])
    setWorkTypes(prefs.preferredWorkTypes ?? [])
    setIndustries(prefs.preferredIndustries ?? [])
    setSkills(prefs.preferredSkills ?? [])
    setMinSalary(prefs.minSalary != null ? String(prefs.minSalary) : "")
    setMaxSalary(prefs.maxSalary != null ? String(prefs.maxSalary) : "")
    setExperience(prefs.experienceLevel ?? "")
    setVisa(prefs.visaSponsorship === true ? "Required" : (prefs.visaSponsorship as any) === "Preferred" ? "Preferred" : "")
  }, [prefs])

  function handleSave() {
    setSaveButtonState("saving")
    update.mutate(
      {
        preferredTitles: titles,
        preferredLocations: locations,
        preferredWorkTypes: workTypes,
        preferredIndustries: industries,
        preferredSkills: skills,
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxSalary: maxSalary ? Number(maxSalary) : undefined,
        experienceLevel: experience || undefined,
        visaSponsorship: visa === "Required" ? true : visa === "Preferred" ? ("Preferred" as any) : false,
      },
      {
        onSuccess: () => {
          setSaved(true)
          setSaveButtonState("success")
          setTimeout(() => setSaveButtonState("idle"), 3000)
        },
        onError: () => {
          setSaveButtonState("idle")
        },
      }
    )
  }

  const sections = [
    { label: "Job Titles", filled: titles.length > 0 },
    { label: "Locations", filled: locations.length > 0 },
    { label: "Work Type", filled: workTypes.length > 0 },
    { label: "Industries", filled: industries.length > 0 },
    { label: "Skills / Tech Stack", filled: skills.length > 0 },
    { label: "Salary Range", filled: !!minSalary || !!maxSalary },
    { label: "Experience Level", filled: !!experience },
  ]
  const filledCount = sections.filter((s) => s.filled).length

  function toggleWorkType(wt: string) {
    setWorkTypes((prev) => (prev.includes(wt) ? prev.filter((x) => x !== wt) : [...prev, wt]))
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Set Your Preferences</h1>
        <p className="text-sm text-gray-500 mt-1">Personalize your job discovery</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        {!isLoading && (
          <div className="mb-4 bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Setup progress: {filledCount} of 7 sections completed
              </p>
              <span className="text-xs font-semibold text-indigo-600">
                {Math.round((filledCount / 7) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(filledCount / 7) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <span
                  key={s.label}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    s.filled
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {s.filled ? "\u2713" : "\u25CB"} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Success banner */}
        {saved && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">Preferences saved successfully</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/discover"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Discover Jobs &rarr;
              </Link>
              <Link
                href="/dashboard/resumes"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Upload Resume &rarr;
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSave()
              }}
              className="space-y-6"
            >
              {/* Section 1: Job Titles */}
              <div>
                <SectionHeader label="Preferred Job Titles" filled={titles.length > 0} />
                <TagInput
                  values={titles}
                  onChange={setTitles}
                  suggestions={SUGGESTED_TITLES}
                  placeholder="Type a title and press Enter..."
                />
              </div>

              {/* Section 2: Locations */}
              <div>
                <SectionHeader label="Preferred Locations" filled={locations.length > 0} />
                <TagInput
                  values={locations}
                  onChange={setLocations}
                  suggestions={SUGGESTED_LOCATIONS}
                  placeholder="Type a location and press Enter..."
                />
              </div>

              {/* Section 3: Work Type */}
              <div>
                <SectionHeader label="Work Type" filled={workTypes.length > 0} />
                <div className="flex flex-wrap gap-4">
                  {WORK_TYPES.map((wt) => (
                    <label key={wt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workTypes.includes(wt)}
                        onChange={() => toggleWorkType(wt)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{wt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 4: Industries */}
              <div>
                <SectionHeader label="Industries" filled={industries.length > 0} />
                <TagInput
                  values={industries}
                  onChange={setIndustries}
                  suggestions={SUGGESTED_INDUSTRIES}
                  placeholder="Type an industry and press Enter..."
                />
              </div>

              {/* Section 5: Skills / Tech Stack */}
              <div>
                <SectionHeader label="Skills / Tech Stack" filled={skills.length > 0} />
                <TagInput
                  values={skills}
                  onChange={setSkills}
                  suggestions={SUGGESTED_SKILLS}
                  placeholder="Type a skill and press Enter..."
                />
              </div>

              {/* Section 6: Salary Range */}
              <div>
                <SectionHeader label="Salary Range (USD)" filled={!!minSalary || !!maxSalary} />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 7: Experience Level */}
              <div>
                <SectionHeader label="Experience Level" filled={!!experience} />
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 8: Visa Sponsorship */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Visa Sponsorship
                </label>
                <select
                  value={visa}
                  onChange={(e) => setVisa(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  {VISA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save button */}
              <button
                type="submit"
                disabled={saveButtonState === "saving"}
                className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-colors ${
                  saveButtonState === "success"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {saveButtonState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveButtonState === "success" && <CheckCircle2 className="w-4 h-4" />}
                {saveButtonState === "saving"
                  ? "Saving..."
                  : saveButtonState === "success"
                  ? "Saved!"
                  : "Save Preferences"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
