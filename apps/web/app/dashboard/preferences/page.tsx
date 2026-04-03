"use client"

import { useEffect, useState } from "react"
import { usePreferences, useUpdatePreferences } from "@/lib/hooks/usePreferences"
import { Input } from "@/components/ui/Input"
import { Loader2, CheckCircle2 } from "lucide-react"

const WORK_TYPES = ["Remote", "Hybrid", "On-site"] as const

const EXPERIENCE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "0-2 years", value: "0-2" },
  { label: "1+ years", value: "1+" },
  { label: "3-5 years", value: "3-5" },
  { label: "5+ years", value: "5+" },
]

const SUGGESTED_TITLES = [
  "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
  "Data Engineer", "Data Analyst", "Data Scientist", "ML Engineer", "AI Engineer",
  "DevOps Engineer", "Cloud Engineer", "Platform Engineer", "Security Engineer",
  "QA Engineer", "SRE", "Analytics Engineer", "MLOps Engineer", "Product Analyst",
]

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

export default function PreferencesPage() {
  const { data: prefs, isLoading } = usePreferences()
  const update = useUpdatePreferences()

  const [titles, setTitles] = useState("")
  const [locations, setLocations] = useState("")
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [industries, setIndustries] = useState("")
  const [skillsStack, setSkillsStack] = useState("")
  const [minSalary, setMinSalary] = useState("")
  const [maxSalary, setMaxSalary] = useState("")
  const [experience, setExperience] = useState("")
  const [visa, setVisa] = useState(false)
  const [saved, setSaved] = useState(false)

  /* pre-fill from server */
  useEffect(() => {
    if (!prefs) return
    setTitles((prefs.preferredTitles ?? []).join(", "))
    setLocations((prefs.preferredLocations ?? []).join(", "))
    setWorkTypes(prefs.preferredWorkTypes ?? [])
    setIndustries((prefs.preferredIndustries ?? []).join(", "))
    setSkillsStack((prefs.preferredSkills ?? []).join(", "))
    setMinSalary(prefs.minSalary != null ? String(prefs.minSalary) : "")
    setMaxSalary(prefs.maxSalary != null ? String(prefs.maxSalary) : "")
    setExperience(prefs.experienceLevel ?? "")
    setVisa(prefs.visaSponsorship ?? false)
  }, [prefs])

  function splitCSV(v: string): string[] {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function handleSave() {
    update.mutate(
      {
        preferredTitles: splitCSV(titles),
        preferredLocations: splitCSV(locations),
        preferredWorkTypes: workTypes,
        preferredIndustries: splitCSV(industries),
        preferredSkills: splitCSV(skillsStack),
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxSalary: maxSalary ? Number(maxSalary) : undefined,
        experienceLevel: experience || undefined,
        visaSponsorship: visa,
      },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  const titlesArr = splitCSV(titles)
  const sections = [
    { label: "Job Titles", filled: titlesArr.length > 0 },
    { label: "Locations", filled: splitCSV(locations).length > 0 },
    { label: "Work Type", filled: workTypes.length > 0 },
    { label: "Industries", filled: splitCSV(industries).length > 0 },
    { label: "Skills", filled: splitCSV(skillsStack).length > 0 },
    { label: "Salary", filled: !!minSalary },
    { label: "Experience", filled: !!experience && experience !== "" },
  ]
  const filledCount = sections.filter((s) => s.filled).length

  function toggleWorkType(wt: string) {
    setWorkTypes((prev) => (prev.includes(wt) ? prev.filter((x) => x !== wt) : [...prev, wt]))
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
        <p className="text-sm text-gray-500 mt-1">Personalize your job discovery</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Save success banner */}
        {saved && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">Preferences saved</p>
          </div>
        )}

        {/* Section completion progress */}
        {!isLoading && (
          <div className="mb-4 bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Profile preferences: {filledCount} of 7 sections completed
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
              className="space-y-5"
            >
              {/* Preferred Job Titles */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Preferred Job Titles
                </label>
                <Input
                  placeholder="e.g. Frontend Engineer, Full Stack Developer"
                  value={titles}
                  onChange={(e) => setTitles(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGGESTED_TITLES.filter((t) => !titlesArr.includes(t)).slice(0, 12).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTitles((prev) => (prev ? prev + ", " + t : t))}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Locations */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Preferred Locations
                </label>
                <Input
                  placeholder="e.g. San Francisco, New York, London"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
              </div>

              {/* Work Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Work Type</label>
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

              {/* Industries */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Industries</label>
                <Input
                  placeholder="e.g. Technology, Healthcare, Finance"
                  value={industries}
                  onChange={(e) => setIndustries(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
              </div>

              {/* Skills / Tech Stack */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Skills / Tech Stack
                </label>
                <Input
                  placeholder="e.g. React, TypeScript, Python, AWS"
                  value={skillsStack}
                  onChange={(e) => setSkillsStack(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
              </div>

              {/* Salary Range */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Salary Range (USD)
                </label>
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

              {/* Experience Level */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Experience Level
                </label>
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

              {/* Visa Sponsorship */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visa}
                    onChange={(e) => setVisa(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Visa Sponsorship Required
                  </span>
                </label>
              </div>

              {/* Save */}
              <button
                type="submit"
                disabled={update.isPending}
                className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-colors ${
                  saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {saved && <CheckCircle2 className="w-4 h-4" />}
                {update.isPending ? "Saving..." : saved ? "Saved" : "Save Preferences"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
