"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Save, Download, Edit3, Eye } from "lucide-react"

interface ResumePreviewEditorProps {
  resumeData: any
  resumeId: string
  onUpdate: (content: any) => Promise<void>
}

export function ResumePreviewEditor({ resumeData, resumeId, onUpdate }: ResumePreviewEditorProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [content, setContent] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const raw = (resumeData as any)?.resume ?? resumeData
    if (raw?.content) setContent({ ...raw.content })
    else if (raw) setContent({ ...raw })
  }, [resumeData])

  if (!content) return <div className="text-center text-sm text-muted-foreground py-8">Loading resume...</div>

  const handleSave = async () => {
    setSaving(true)
    await onUpdate(content)
    setSaving(false)
  }

  const updateField = (path: string, value: any) => {
    setContent((prev: any) => {
      const next = { ...prev }
      const keys = path.split(".")
      let obj: any = next
      for (let i = 0; i < keys.length - 1; i++) {
        if (Array.isArray(obj[keys[i]])) {
          obj[keys[i]] = [...obj[keys[i]]]
          obj = obj[keys[i]]
        } else {
          obj[keys[i]] = { ...obj[keys[i]] }
          obj = obj[keys[i]]
        }
      }
      obj[keys[keys.length - 1]] = value
      return next
    })
  }

  const handleDownload = async (format: string) => {
    try {
      const { apiDownload } = await import("@/lib/api/client")
      await apiDownload(`/extension/export?resume_id=${resumeId}&format=${format}`, `resume.${format}`)
    } catch (e: any) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setMode("preview")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${mode === "preview" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
            <Eye className="w-3 h-3 inline mr-1" />Preview
          </button>
          <button onClick={() => setMode("edit")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${mode === "edit" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
            <Edit3 className="w-3 h-3 inline mr-1" />Edit
          </button>
        </div>
        <div className="flex gap-2">
          {mode === "edit" && (
            <Button size="sm" variant="outline" loading={saving} onClick={handleSave} className="text-xs h-7">
              <Save className="w-3 h-3" /> Save
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => handleDownload("pdf")} className="text-xs h-7">
            <Download className="w-3 h-3" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("docx")} className="text-xs h-7">
            <Download className="w-3 h-3" /> Word
          </Button>
        </div>
      </div>

      {/* Resume Content */}
      <div className="bg-white border border-border rounded-xl shadow-sm p-6 space-y-5 text-sm" style={{ fontFamily: "Georgia, serif" }}>
        {/* Header */}
        <div className="text-center border-b pb-3">
          {mode === "edit" ? (
            <input value={content.name || content.full_name || content.contact?.full_name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              className="text-xl font-bold text-center w-full border-b border-dashed border-gray-300 focus:outline-none focus:border-primary pb-1" />
          ) : (
            <h1 className="text-xl font-bold">{content.name || content.full_name || content.contact?.full_name || "Your Name"}</h1>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {[content.email || content.contact?.email, content.phone || content.contact?.phone, content.location || content.contact?.location, content.linkedin || content.contact?.linkedin]
              .filter(Boolean).join(" | ")}
          </p>
        </div>

        {/* Summary */}
        {(content.summary || mode === "edit") && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">Professional Summary</h2>
            {mode === "edit" ? (
              <textarea value={content.summary || ""}
                onChange={(e) => updateField("summary", e.target.value)}
                className="w-full text-xs leading-relaxed border border-dashed border-gray-300 rounded p-2 min-h-[80px] focus:outline-none focus:border-primary resize-none" />
            ) : (
              <p className="text-xs leading-relaxed text-gray-700">{content.summary}</p>
            )}
          </div>
        )}

        {/* Experience */}
        {content.experiences?.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">Professional Experience</h2>
            {content.experiences.map((exp: any, i: number) => (
              <div key={i} className="mb-3">
                <div className="flex justify-between items-baseline">
                  {mode === "edit" ? (
                    <input value={exp.company || ""} onChange={(e) => updateField(`experiences.${i}.company`, e.target.value)}
                      className="font-bold text-xs border-b border-dashed border-gray-300 focus:outline-none focus:border-primary flex-1" />
                  ) : (
                    <span className="font-bold text-xs">{exp.company}</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">
                    {exp.start_date || exp.startDate || ""} – {exp.current ? "Present" : (exp.end_date || exp.endDate || "")}
                  </span>
                </div>
                {mode === "edit" ? (
                  <input value={exp.title || ""} onChange={(e) => updateField(`experiences.${i}.title`, e.target.value)}
                    className="text-xs italic text-gray-600 w-full border-b border-dashed border-gray-200 focus:outline-none focus:border-primary" />
                ) : (
                  <p className="text-xs italic text-gray-600">{exp.title}</p>
                )}
                {exp.bullets?.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {exp.bullets.map((bullet: string, bi: number) => (
                      <li key={bi} className="text-[11px] text-gray-600 flex">
                        <span className="mr-1.5 text-gray-400">•</span>
                        {mode === "edit" ? (
                          <textarea value={bullet}
                            onChange={(e) => {
                              const newBullets = [...(exp.bullets || [])]
                              newBullets[bi] = e.target.value
                              updateField(`experiences.${i}.bullets`, newBullets)
                            }}
                            className="flex-1 border-b border-dashed border-gray-200 focus:outline-none focus:border-primary text-[11px] resize-none min-h-[18px]"
                            rows={1} />
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">Technical Skills</h2>
            {mode === "edit" ? (
              <textarea
                value={content.skills.map((s: any) => typeof s === "string" ? s : s.name || "").join(", ")}
                onChange={(e) => updateField("skills", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                className="w-full text-[11px] border border-dashed border-gray-300 rounded p-2 focus:outline-none focus:border-primary resize-none min-h-[40px]" />
            ) : (
              <p className="text-[11px] text-gray-600">
                {content.skills.map((s: any) => typeof s === "string" ? s : s.name || "").filter((s: string) => s.length < 60).join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* Education */}
        {content.educations?.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">Education</h2>
            {content.educations.map((edu: any, i: number) => (
              <div key={i} className="flex justify-between mb-1">
                <div>
                  <span className="text-xs font-bold">{edu.degree}{edu.field ? `, ${edu.field}` : ""}</span>
                  <span className="text-xs text-gray-500 ml-2">{edu.school}</span>
                </div>
                <span className="text-[10px] text-gray-400">{edu.end_date || edu.endDate || ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {content.projects?.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">Projects</h2>
            {content.projects.map((proj: any, i: number) => (
              <div key={i} className="mb-2">
                <span className="text-xs font-bold">{proj.name}</span>
                {proj.description && <p className="text-[11px] text-gray-600">{proj.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === "edit" && (
        <p className="text-[10px] text-center text-muted-foreground">
          Edit any field above, then click Save. Download PDF/Word when ready.
        </p>
      )}
    </div>
  )
}
