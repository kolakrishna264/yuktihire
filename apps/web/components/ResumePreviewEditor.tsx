"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Save, Edit3, Eye, Loader2 } from "lucide-react"
import { useProfile } from "@/lib/hooks/useProfile"

interface ResumePreviewEditorProps {
  resumeData: any
  resumeId: string
  onUpdate: (content: any) => Promise<void>
}

export function ResumePreviewEditor({ resumeData, resumeId, onUpdate }: ResumePreviewEditorProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [content, setContent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const { data: profile } = useProfile()

  useEffect(() => {
    const raw = (resumeData as any)?.resume ?? resumeData
    let c = raw?.content ? { ...raw.content } : (raw ? { ...raw } : {})

    if (profile) {
      if (!c.name && !c.full_name) c.name = profile.fullName || ""
      if (!c.email) c.email = (profile as any).email || ""
      if (!c.phone) c.phone = profile.phone || ""
      if (!c.location) c.location = profile.location || ""
      if (!c.linkedin) c.linkedin = profile.linkedinUrl || ""
      if (!c.summary) c.summary = profile.summary || profile.headline || ""

      if (!c.experiences?.length && (profile as any).experiences?.length) {
        c.experiences = (profile as any).experiences.map((e: any) => ({
          title: e.title, company: e.company, location: e.location,
          start_date: e.startDate, end_date: e.endDate, current: e.current,
          bullets: e.bullets || [], skills_used: e.skillsUsed || [],
        }))
      }
      if (!c.educations?.length && (profile as any).educations?.length) {
        // Deduplicate by degree+school
        const seen = new Set<string>()
        c.educations = (profile as any).educations.filter((e: any) => {
          const key = `${e.degree}|${e.school}`.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }).map((e: any) => ({
          degree: e.degree, field: e.field, school: e.school,
          end_date: e.endDate, gpa: e.gpa,
        }))
      }
      if (!c.skills?.length && (profile as any).skills?.length) {
        c.skills = (profile as any).skills.map((s: any) => s.name || s)
      }
      if (!c.projects?.length && (profile as any).projects?.length) {
        c.projects = (profile as any).projects.map((p: any) => ({
          name: p.name, description: p.description, bullets: p.bullets || [],
        }))
      }
    }

    // Deduplicate educations in content too
    if (c.educations?.length > 0) {
      const seen = new Set<string>()
      c.educations = c.educations.filter((e: any) => {
        const key = `${e.degree || ""}|${e.school || ""}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    setContent(c)
  }, [resumeData, profile])

  if (!content) return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading resume...
    </div>
  )

  const handleSave = async () => {
    setSaving(true)
    await onUpdate(content)
    setSaving(false)
  }

  const updateField = (path: string, value: any) => {
    setContent((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      const keys = path.split(".")
      let obj = next
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      return next
    })
  }

  const contactParts = [
    content.email || content.contact?.email,
    content.phone || content.contact?.phone,
    content.location || content.contact?.location,
    content.linkedin || content.contact?.linkedin,
  ].filter(Boolean)

  const displayName = content.name || content.full_name || content.contact?.full_name || ""
  const displaySummary = content.summary || ""

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button onClick={() => setMode("preview")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "preview" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <Eye className="w-3 h-3 inline mr-1" />Preview
          </button>
          <button onClick={() => setMode("edit")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "edit" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <Edit3 className="w-3 h-3 inline mr-1" />Edit
          </button>
        </div>
        {mode === "edit" && (
          <Button size="sm" loading={saving} onClick={handleSave} className="text-xs h-7">
            <Save className="w-3 h-3" /> Save Changes
          </Button>
        )}
      </div>

      {/* Resume Document */}
      <div className="bg-white border rounded-lg shadow-sm px-8 py-6 space-y-4" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "11pt", lineHeight: "1.4" }}>

        {/* Header */}
        <div className="text-center pb-2" style={{ borderBottom: "1px solid #999" }}>
          {mode === "edit" ? (
            <input value={displayName}
              onChange={(e) => updateField("name", e.target.value)}
              className="text-2xl font-bold text-center w-full focus:outline-none focus:bg-blue-50 rounded px-1"
              style={{ fontFamily: "inherit" }} />
          ) : (
            <h1 className="text-2xl font-bold">{displayName || "Your Name"}</h1>
          )}
          {contactParts.length > 0 && (
            <p className="text-[10pt] text-gray-600 mt-1">{contactParts.join("  |  ")}</p>
          )}
        </div>

        {/* Summary */}
        {(displaySummary || mode === "edit") && (
          <div>
            <h2 className="text-[11pt] font-bold uppercase tracking-wide mb-1" style={{ borderBottom: "1px solid #ccc", paddingBottom: "2px" }}>
              Professional Summary
            </h2>
            {mode === "edit" ? (
              <textarea value={displaySummary}
                onChange={(e) => updateField("summary", e.target.value)}
                className="w-full text-[10.5pt] leading-relaxed focus:outline-none focus:bg-blue-50 rounded p-1 resize-none"
                style={{ fontFamily: "inherit", minHeight: "60px" }} />
            ) : (
              <p className="text-[10.5pt] leading-relaxed">{displaySummary}</p>
            )}
          </div>
        )}

        {/* Experience */}
        {content.experiences?.length > 0 && (
          <div>
            <h2 className="text-[11pt] font-bold uppercase tracking-wide mb-1" style={{ borderBottom: "1px solid #ccc", paddingBottom: "2px" }}>
              Professional Experience
            </h2>
            {content.experiences.map((exp: any, i: number) => (
              <div key={i} className="mb-3">
                <div className="flex justify-between items-baseline">
                  {mode === "edit" ? (
                    <input value={exp.company || ""} onChange={(e) => updateField(`experiences.${i}.company`, e.target.value)}
                      className="font-bold text-[10.5pt] focus:outline-none focus:bg-blue-50 rounded px-1 flex-1" style={{ fontFamily: "inherit" }} />
                  ) : (
                    <span className="font-bold text-[10.5pt]">{exp.company}</span>
                  )}
                  <span className="text-[9.5pt] text-gray-500 ml-2 whitespace-nowrap">
                    {exp.start_date || exp.startDate || ""} – {exp.current ? "Present" : (exp.end_date || exp.endDate || "")}
                  </span>
                </div>
                {mode === "edit" ? (
                  <input value={exp.title || ""} onChange={(e) => updateField(`experiences.${i}.title`, e.target.value)}
                    className="text-[10.5pt] italic text-gray-700 w-full focus:outline-none focus:bg-blue-50 rounded px-1" style={{ fontFamily: "inherit" }} />
                ) : (
                  <p className="text-[10.5pt] italic text-gray-700">{exp.title}</p>
                )}
                {exp.bullets?.length > 0 && (
                  <ul className="mt-1 ml-4" style={{ listStyleType: "disc" }}>
                    {exp.bullets.map((bullet: string, bi: number) => (
                      <li key={bi} className="text-[10pt] text-gray-700 mb-0.5 pl-1">
                        {mode === "edit" ? (
                          <input value={bullet}
                            onChange={(e) => {
                              const newBullets = [...(exp.bullets || [])]
                              newBullets[bi] = e.target.value
                              updateField(`experiences.${i}.bullets`, newBullets)
                            }}
                            className="w-full focus:outline-none focus:bg-blue-50 rounded px-1 text-[10pt]"
                            style={{ fontFamily: "inherit" }} />
                        ) : (
                          <span>{bullet}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {content.skills?.length > 0 && (
          <div>
            <h2 className="text-[11pt] font-bold uppercase tracking-wide mb-1" style={{ borderBottom: "1px solid #ccc", paddingBottom: "2px" }}>
              Technical Skills
            </h2>
            {mode === "edit" ? (
              <textarea
                value={content.skills.map((s: any) => typeof s === "string" ? s : s.name || "").join(", ")}
                onChange={(e) => updateField("skills", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                className="w-full text-[10pt] focus:outline-none focus:bg-blue-50 rounded p-1 resize-none"
                style={{ fontFamily: "inherit", minHeight: "40px" }} />
            ) : (
              <p className="text-[10pt]">
                {content.skills.map((s: any) => typeof s === "string" ? s : s.name || "").filter((s: string) => s.length < 60).join("  ·  ")}
              </p>
            )}
          </div>
        )}

        {/* Education */}
        {content.educations?.length > 0 && (
          <div>
            <h2 className="text-[11pt] font-bold uppercase tracking-wide mb-1" style={{ borderBottom: "1px solid #ccc", paddingBottom: "2px" }}>
              Education
            </h2>
            {content.educations.map((edu: any, i: number) => (
              <div key={i} className="flex justify-between items-baseline mb-1">
                <div>
                  <span className="text-[10.5pt] font-bold">{edu.degree}{edu.field ? `, ${edu.field}` : ""}</span>
                  <span className="text-[10pt] text-gray-600 ml-2">— {edu.school}</span>
                  {edu.gpa && <span className="text-[9.5pt] text-gray-500 ml-2">GPA: {edu.gpa}</span>}
                </div>
                <span className="text-[9.5pt] text-gray-500 whitespace-nowrap ml-2">{edu.end_date || edu.endDate || ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {content.projects?.length > 0 && (
          <div>
            <h2 className="text-[11pt] font-bold uppercase tracking-wide mb-1" style={{ borderBottom: "1px solid #ccc", paddingBottom: "2px" }}>
              Projects
            </h2>
            {content.projects.map((proj: any, i: number) => (
              <div key={i} className="mb-2">
                <span className="text-[10.5pt] font-bold">{proj.name}</span>
                {proj.description && <p className="text-[10pt] text-gray-600">{proj.description}</p>}
                {proj.bullets?.length > 0 && (
                  <ul className="ml-4" style={{ listStyleType: "disc" }}>
                    {proj.bullets.map((b: string, bi: number) => (
                      <li key={bi} className="text-[10pt] text-gray-700 pl-1">{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === "edit" && (
        <p className="text-[10px] text-center text-muted-foreground">
          Click any field to edit. Save when done, then use Download PDF / Word buttons above.
        </p>
      )}
    </div>
  )
}
