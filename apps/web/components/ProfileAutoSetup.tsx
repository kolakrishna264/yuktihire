"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Check, Upload, Loader2, Sparkles, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { profileApi } from "@/lib/api/profile"
import { useProfile, useUpdateProfile, useAddSkill, useAddExperience, useAddEducation } from "@/lib/hooks/useProfile"
import Link from "next/link"

export function ProfileAutoSetup() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { mutateAsync: updateProfile } = useUpdateProfile()
  const { mutateAsync: addSkill } = useAddSkill()
  const { mutateAsync: addExperience } = useAddExperience()
  const { mutateAsync: addEducation } = useAddEducation()

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
        await updateProfile(profileUpdate)
      }

      // 2. Add skills
      const skills = parsed.skills || []
      for (const skill of skills.slice(0, 20)) {
        const name = typeof skill === "string" ? skill : skill.name || skill
        if (name && name.length > 1) {
          try { await addSkill({ name, category: "From Resume" }) } catch {}
        }
      }

      // 3. Add experiences
      for (const exp of (parsed.experiences || []).slice(0, 5)) {
        try {
          await addExperience({
            title: exp.title || exp.role || "",
            company: exp.company || "",
            location: exp.location || "",
            start_date: exp.start_date || exp.startDate || "",
            end_date: exp.end_date || exp.endDate || "",
            current: exp.current || false,
            bullets: exp.bullets || exp.achievements || [],
          })
        } catch {}
      }

      // 4. Add education
      for (const edu of (parsed.educations || parsed.education || []).slice(0, 3)) {
        try {
          await addEducation({
            degree: edu.degree || "",
            field: edu.field || edu.major || "",
            school: edu.school || edu.institution || "",
            start_date: edu.start_date || "",
            end_date: edu.end_date || "",
          })
        } catch {}
      }

      setSaved(true)
      toast.success("Profile updated from resume!")
    } catch (err: any) {
      toast.error("Some fields failed to save")
    }
    setSaving(false)
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
    if (parsed.full_name || parsed.name) extractedFields.push("Name")
    if (parsed.email) extractedFields.push("Email")
    if (parsed.phone) extractedFields.push("Phone")
    if (parsed.location) extractedFields.push("Location")
    if (parsed.linkedin) extractedFields.push("LinkedIn")
    if (parsed.github) extractedFields.push("GitHub")
    if (parsed.skills?.length) extractedFields.push(`${parsed.skills.length} Skills`)
    if (parsed.experiences?.length) extractedFields.push(`${parsed.experiences.length} Experiences`)
    if ((parsed.educations || parsed.education)?.length) extractedFields.push("Education")
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
          <Button onClick={handleConfirmAndSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving to profile...</> : "Confirm & Save to Profile"}
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
