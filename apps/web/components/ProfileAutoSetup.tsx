"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Check, Upload, Loader2, Sparkles, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { profileApi } from "@/lib/api/profile"
import { apiFetch } from "@/lib/api/client"
import { useProfile } from "@/lib/hooks/useProfile"
import Link from "next/link"

export function ProfileAutoSetup() {
  const { data: profile, isLoading: profileLoading } = useProfile()

  const [uploading, setUploading] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    let savedCount = 0

    try {
      // 1. Update basic profile fields
      const profileUpdate: Record<string, unknown> = {}
      if (parsed.full_name || parsed.name) profileUpdate.full_name = parsed.full_name || parsed.name
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

      // 2. Add skills (use direct API)
      for (const skill of (parsed.skills || []).slice(0, 30)) {
        const name = typeof skill === "string" ? skill : skill?.name || ""
        if (name && name.length > 1) {
          try {
            await apiFetch("/profiles/me/skills", { method: "POST", body: JSON.stringify({ name }) })
            savedCount++
          } catch {}
        }
      }

      // 3. Add experiences (parse dates properly)
      for (const exp of (parsed.experiences || []).slice(0, 5)) {
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
              bullets: (exp.bullets || exp.achievements || []).slice(0, 6),
              skills_used: exp.skills_used || [],
            }),
          })
          savedCount++
        } catch (e) { console.error("Experience save failed:", e) }
      }

      // 4. Add education (parse dates properly)
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

      setSaved(true)
      toast.success(`Profile updated! ${savedCount} items saved from resume.`)
    } catch (err: any) {
      toast.error("Some fields failed to save")
    }
    setSaving(false)
  }

  /** Convert date strings like "Jul 2024", "2024", "2024-07" to YYYY-MM-DD */
  function parseDate(d: string | null | undefined): string | null {
    if (!d || d === "null" || d === "Present" || d === "present") return null
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(d)) return d + "-01"
    // YYYY only
    if (/^\d{4}$/.test(d)) return d + "-01-01"
    // "Mon YYYY" like "Jul 2024"
    const monthMap: Record<string, string> = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" }
    const match = d.match(/^(\w{3})\s+(\d{4})$/)
    if (match) {
      const mm = monthMap[match[1].toLowerCase()]
      if (mm) return `${match[2]}-${mm}-01`
    }
    // "Month YYYY" like "July 2024"
    const longMatch = d.match(/^(\w+)\s+(\d{4})$/)
    if (longMatch) {
      const mm = monthMap[longMatch[1].toLowerCase().slice(0, 3)]
      if (mm) return `${longMatch[2]}-${mm}-01`
    }
    return null
  }

  // Calculate completion
  const completeness = profile?.completeness ?? 0

  if (saved) {
    return (
      <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800">Profile auto-populated from resume!</p>
              <p className="text-xs text-emerald-600">Review and edit your profile below if needed.</p>
            </div>
            <Link href="/dashboard/jobs">
              <Button size="sm">Continue to Jobs <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (parsed) {
    const extractedFields: string[] = []
    if (parsed.full_name || parsed.name) extractedFields.push(`Name: ${parsed.full_name || parsed.name}`)
    if (parsed.email) extractedFields.push(`Email: ${parsed.email}`)
    if (parsed.phone) extractedFields.push(`Phone: ${parsed.phone}`)
    if (parsed.location) extractedFields.push(`Location: ${parsed.location}`)
    if (parsed.linkedin) extractedFields.push("LinkedIn ✓")
    if (parsed.github) extractedFields.push("GitHub ✓")
    if (parsed.headline) extractedFields.push(`Headline: ${parsed.headline}`)
    if (parsed.skills?.length) extractedFields.push(`${parsed.skills.length} Skills`)

    const expCount = parsed.experiences?.length || 0
    if (expCount > 0) {
      extractedFields.push(`${expCount} Experiences`)
    }

    const eduCount = (parsed.educations || parsed.education || []).length
    if (eduCount > 0) {
      extractedFields.push(`${eduCount} Education entries`)
    }

    const certCount = (parsed.certifications || []).length
    if (certCount > 0) extractedFields.push(`${certCount} Certifications`)

    const projCount = (parsed.projects || []).length
    if (projCount > 0) extractedFields.push(`${projCount} Projects`)
    if (parsed.summary) extractedFields.push("Summary")

    return (
      <Card className="mb-6 border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm font-bold text-gray-900">Resume Parsed -- {extractedFields.length} fields extracted</p>
              <p className="text-xs text-gray-500">Click confirm to auto-populate your profile</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {extractedFields.map(f => (
              <Badge key={f} variant="secondary" className="text-xs bg-white">{f}</Badge>
            ))}
          </div>

          {/* Detailed preview */}
          <div className="space-y-3 text-xs">
            {/* Experiences */}
            {expCount > 0 && (
              <div>
                <p className="font-semibold text-gray-700 mb-1">Work Experience ({expCount})</p>
                {(parsed.experiences || []).map((exp: any, i: number) => (
                  <div key={i} className="ml-2 mb-1 text-gray-500">
                    • <span className="font-medium text-gray-700">{exp.title || exp.role}</span> at {exp.company}
                    {exp.start_date && <span className="text-gray-400"> ({exp.start_date} – {exp.end_date || "Present"})</span>}
                  </div>
                ))}
              </div>
            )}
            {/* Education */}
            {eduCount > 0 ? (
              <div>
                <p className="font-semibold text-gray-700 mb-1">Education ({eduCount})</p>
                {(parsed.educations || parsed.education || []).map((edu: any, i: number) => (
                  <div key={i} className="ml-2 mb-1 text-gray-500">
                    • <span className="font-medium text-gray-700">{edu.degree}</span> in {edu.field} — {edu.school}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="font-semibold text-amber-600 mb-1">⚠ Education not detected</p>
                <p className="ml-2 text-gray-400">Add your education manually in Profile after saving.</p>
              </div>
            )}
            {/* Skills preview */}
            {parsed.skills?.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700 mb-1">Skills ({parsed.skills.length})</p>
                <p className="ml-2 text-gray-500">{parsed.skills.slice(0, 15).join(", ")}{parsed.skills.length > 15 ? ` +${parsed.skills.length - 15} more` : ""}</p>
              </div>
            )}
          </div>

          <Button onClick={handleConfirmAndSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving to profile...</> : `Confirm & Save All ${extractedFields.length} Fields`}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show upload prompt if profile is incomplete
  if (!profileLoading && completeness < 60) {
    return (
      <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Auto-setup your profile</p>
              <p className="text-xs text-gray-500">Upload your resume and we'll extract everything automatically</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
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
