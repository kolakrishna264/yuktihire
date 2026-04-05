"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Check, Upload, Loader2, Sparkles, ArrowRight, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { profileApi } from "@/lib/api/profile"
import { apiFetch } from "@/lib/api/client"
import { useProfile } from "@/lib/hooks/useProfile"
import Link from "next/link"

type ExtractedSection = {
  name: string
  status: "extracted" | "missing" | "review"
  detail?: string
}

export function ProfileAutoSetup() {
  const { data: profile, isLoading: profileLoading, refetch } = useProfile()

  const [uploading, setUploading] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveStatus, setSaveStatus] = useState("")

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await profileApi.importResume(file)
      setParsed(result?.parsed ?? result)
      toast.success("Resume parsed! Review the extracted data below.")
    } catch (err: any) {
      toast.error(err.message || "Failed to parse resume")
    }
    setUploading(false)
  }

  const handleConfirmAndSave = async () => {
    if (!parsed) return
    setSaving(true)
    setSaveProgress(0)
    let savedCount = 0
    const totalSteps = 6

    try {
      // 1. Split name into first/last and save
      setSaveStatus("Saving basic info...")
      setSaveProgress(10)
      const fullName = parsed.full_name || parsed.name || ""
      const nameParts = fullName.trim().split(" ")
      const firstName = nameParts[0] || ""
      const lastName = nameParts.slice(1).join(" ") || ""

      // Save first/last name to users table
      if (firstName) {
        try {
          await apiFetch("/extension/update-name", {
            method: "POST",
            body: JSON.stringify({ first_name: firstName, last_name: lastName }),
          })
          savedCount++
        } catch {}
      }

      // Save profile fields
      const profileUpdate: Record<string, unknown> = {}
      if (fullName) profileUpdate.full_name = fullName
      if (parsed.headline) profileUpdate.headline = parsed.headline
      if (parsed.summary) profileUpdate.summary = parsed.summary
      if (parsed.phone) profileUpdate.phone = parsed.phone
      if (parsed.location) profileUpdate.location = parsed.location
      if (parsed.linkedin) profileUpdate.linkedin = parsed.linkedin
      if (parsed.github) profileUpdate.github = parsed.github
      if (parsed.portfolio) profileUpdate.portfolio = parsed.portfolio

      if (Object.keys(profileUpdate).length > 0) {
        try {
          await apiFetch("/profiles/me", { method: "PATCH", body: JSON.stringify(profileUpdate) })
          savedCount++
        } catch (e) { console.error("Profile update failed:", e) }
      }

      // 2. Add skills
      setSaveStatus("Saving skills...")
      setSaveProgress(30)
      const skills = (parsed.skills || []).slice(0, 30)
      for (const skill of skills) {
        const name = typeof skill === "string" ? skill : skill?.name || ""
        if (name && name.length > 1) {
          try {
            await apiFetch("/profiles/me/skills", { method: "POST", body: JSON.stringify({ name }) })
            savedCount++
          } catch {}
        }
      }

      // 3. Add experiences
      setSaveStatus("Saving experiences...")
      setSaveProgress(50)
      for (const exp of (parsed.experiences || []).slice(0, 8)) {
        try {
          await apiFetch("/profiles/me/experiences", {
            method: "POST",
            body: JSON.stringify({
              title: exp.title || exp.role || "Unknown Role",
              company: exp.company || "Unknown Company",
              location: exp.location || "",
              start_date: parseDate(exp.start_date || exp.startDate),
              end_date: exp.current ? null : parseDate(exp.end_date || exp.endDate),
              current: exp.current || (exp.end_date === "Present") || false,
              bullets: (exp.bullets || exp.achievements || []).slice(0, 8),
              skills_used: exp.skills_used || [],
            }),
          })
          savedCount++
        } catch (e) { console.error("Experience save failed:", e) }
      }

      // 4. Add education
      setSaveStatus("Saving education...")
      setSaveProgress(70)
      for (const edu of (parsed.educations || parsed.education || []).slice(0, 5)) {
        if (!edu.degree || edu.degree === "Not specified") continue
        try {
          await apiFetch("/profiles/me/educations", {
            method: "POST",
            body: JSON.stringify({
              degree: edu.degree || "",
              field: edu.field || "",
              school: edu.school || "",
              start_date: parseDate(edu.start_date),
              end_date: parseDate(edu.end_date),
              gpa: edu.gpa || null,
            }),
          })
          savedCount++
        } catch (e) { console.error("Education save failed:", e) }
      }

      // 5. Add projects (NEW — previously parsed but never saved)
      setSaveStatus("Saving projects...")
      setSaveProgress(85)
      for (const proj of (parsed.projects || []).slice(0, 10)) {
        if (!proj.name) continue
        try {
          await apiFetch("/profiles/me/projects", {
            method: "POST",
            body: JSON.stringify({
              name: proj.name,
              description: proj.description || "",
              url: proj.url || "",
              bullets: proj.bullets || [],
              skills: proj.skills || [],
            }),
          })
          savedCount++
        } catch (e) { console.error("Project save failed:", e) }
      }

      // 6. Store resume content for autofill AI context
      setSaveStatus("Finalizing...")
      setSaveProgress(100)

      setSaved(true)
      refetch()
      toast.success(`Profile auto-populated! ${savedCount} items saved from resume.`)
    } catch (err: any) {
      toast.error("Some fields failed to save")
    }
    setSaving(false)
  }

  function parseDate(d: string | null | undefined): string | null {
    if (!d || d === "null" || d === "Present" || d === "present") return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    if (/^\d{4}-\d{2}$/.test(d)) return d + "-01"
    if (/^\d{4}$/.test(d)) return d + "-01-01"
    const monthMap: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" }
    const match = d.match(/^(\w{3,})\s+(\d{4})$/)
    if (match) {
      const mm = monthMap[match[1].toLowerCase().slice(0, 3)]
      if (mm) return `${match[2]}-${mm}-01`
    }
    return null
  }

  // ── Build completion checklist ──
  function getChecklist(): ExtractedSection[] {
    if (!parsed) return []
    const sections: ExtractedSection[] = []

    sections.push({ name: "Name", status: (parsed.name || parsed.full_name) ? "extracted" : "missing", detail: parsed.name || parsed.full_name })
    sections.push({ name: "Email", status: parsed.email ? "extracted" : "missing", detail: parsed.email })
    sections.push({ name: "Phone", status: parsed.phone ? "extracted" : "missing", detail: parsed.phone })
    sections.push({ name: "Location", status: parsed.location ? "extracted" : "missing", detail: parsed.location })
    sections.push({ name: "LinkedIn", status: parsed.linkedin ? "extracted" : "missing" })
    sections.push({ name: "GitHub", status: parsed.github ? "extracted" : "missing" })
    sections.push({ name: "Headline", status: parsed.headline ? "extracted" : "missing" })
    sections.push({ name: "Summary", status: parsed.summary ? "extracted" : "missing" })

    const expCount = parsed.experiences?.length || 0
    sections.push({ name: "Experience", status: expCount > 0 ? "extracted" : "missing", detail: expCount > 0 ? `${expCount} positions` : undefined })

    const eduCount = (parsed.educations || parsed.education || []).length
    sections.push({ name: "Education", status: eduCount > 0 ? "extracted" : "missing", detail: eduCount > 0 ? `${eduCount} entries` : undefined })

    const skillCount = parsed.skills?.length || 0
    sections.push({ name: "Skills", status: skillCount > 0 ? "extracted" : "missing", detail: skillCount > 0 ? `${skillCount} skills` : undefined })

    const projCount = (parsed.projects || []).length
    sections.push({ name: "Projects", status: projCount > 0 ? "extracted" : "missing", detail: projCount > 0 ? `${projCount} projects` : undefined })

    // Always manual/review
    sections.push({ name: "Work Authorization", status: "review" })
    sections.push({ name: "Sponsorship", status: "review" })
    sections.push({ name: "EEO Preferences", status: "review" })

    return sections
  }

  const completeness = profile?.completeness ?? 0
  const checklist = getChecklist()
  const extractedCount = checklist.filter(s => s.status === "extracted").length
  const totalCheckable = checklist.filter(s => s.status !== "review").length
  const extractionPct = totalCheckable > 0 ? Math.round((extractedCount / totalCheckable) * 100) : 0

  // ── SAVED STATE ──
  if (saved) {
    const missingFields = checklist.filter(s => s.status === "missing" || s.status === "review")
    return (
      <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800">Profile auto-populated from resume!</p>
              <p className="text-xs text-emerald-600">{extractedCount} sections filled automatically</p>
            </div>
          </div>

          {missingFields.length > 0 && (
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-2">Complete remaining details:</p>
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map(f => (
                  <Badge key={f.name} variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                    {f.status === "review" ? "⚠" : "✗"} {f.name}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Go to <strong>Application Info</strong> tab to set work authorization, sponsorship, and EEO preferences
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/dashboard/profile" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">Review Profile</Button>
            </Link>
            <Link href="/dashboard/jobs" className="flex-1">
              <Button size="sm" className="w-full text-xs">Continue to Jobs <ArrowRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── PARSED STATE — show checklist ──
  if (parsed) {
    return (
      <Card className="mb-6 border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Resume Parsed — {extractionPct}% extracted</p>
              <p className="text-xs text-gray-500">{extractedCount} of {totalCheckable} sections found</p>
            </div>
            <Badge variant="secondary" className="text-xs">{extractionPct}%</Badge>
          </div>

          <Progress value={extractionPct} className="h-2" />

          {/* Completion checklist */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {checklist.map(item => (
              <div key={item.name} className="flex items-center gap-2 text-xs py-1">
                {item.status === "extracted" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : item.status === "review" ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                )}
                <span className={item.status === "extracted" ? "text-gray-700" : item.status === "review" ? "text-amber-600" : "text-gray-400"}>
                  {item.name}
                  {item.detail && <span className="text-gray-400 ml-1">({item.detail})</span>}
                </span>
              </div>
            ))}
          </div>

          {/* Experience preview */}
          {(parsed.experiences?.length || 0) > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-semibold text-gray-700">Experience</p>
              {(parsed.experiences || []).slice(0, 3).map((exp: any, i: number) => (
                <div key={i} className="ml-3 text-gray-500">
                  <span className="font-medium text-gray-700">{exp.title || exp.role}</span> at {exp.company}
                  {exp.start_date && <span className="text-gray-400"> ({exp.start_date} – {exp.end_date || "Present"})</span>}
                </div>
              ))}
              {(parsed.experiences?.length || 0) > 3 && <p className="ml-3 text-gray-400">+{parsed.experiences.length - 3} more</p>}
            </div>
          )}

          {/* Education preview */}
          {(parsed.educations || parsed.education || []).length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-semibold text-gray-700">Education</p>
              {(parsed.educations || parsed.education || []).slice(0, 2).map((edu: any, i: number) => (
                <div key={i} className="ml-3 text-gray-500">
                  <span className="font-medium text-gray-700">{edu.degree}</span> in {edu.field} — {edu.school}
                </div>
              ))}
            </div>
          )}

          {/* Skills preview */}
          {(parsed.skills?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {parsed.skills.slice(0, 12).map((s: any) => (
                <Badge key={typeof s === "string" ? s : s.name} variant="secondary" className="text-[10px] bg-white">
                  {typeof s === "string" ? s : s.name}
                </Badge>
              ))}
              {parsed.skills.length > 12 && <Badge variant="secondary" className="text-[10px]">+{parsed.skills.length - 12}</Badge>}
            </div>
          )}

          {saving ? (
            <div className="space-y-2">
              <Progress value={saveProgress} className="h-2" />
              <p className="text-xs text-center text-gray-500">{saveStatus}</p>
            </div>
          ) : (
            <Button onClick={handleConfirmAndSave} className="w-full">
              <Sparkles className="w-4 h-4" />
              Confirm & Build Profile ({extractedCount} sections)
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── UPLOAD STATE ──
  if (!profileLoading) {
    return (
      <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">
                {completeness > 50 ? "Re-upload resume to update profile" : "Upload resume to auto-build profile"}
              </p>
              <p className="text-xs text-gray-500">
                {completeness > 50
                  ? "Upload a new resume to refresh your profile data"
                  : "We'll extract your name, experience, education, skills, and more automatically"
                }
              </p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".pdf,.docx,.doc,.txt,.rtf" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Parsing..." : "Upload Resume"}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
