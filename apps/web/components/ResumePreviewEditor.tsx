"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Save, Edit3, Eye, Loader2, Plus, Trash2 } from "lucide-react"
import { useProfile } from "@/lib/hooks/useProfile"
import { toast } from "sonner"

interface Props {
  resumeData: any
  resumeId: string
  onUpdate: (content: any) => Promise<void>
}

export function ResumePreviewEditor({ resumeData, resumeId, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const { data: profile } = useProfile()

  useEffect(() => {
    const raw = (resumeData as any)?.resume ?? resumeData
    let c = raw?.content ? JSON.parse(JSON.stringify(raw.content)) : (raw ? JSON.parse(JSON.stringify(raw)) : {})

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
          bullets: e.bullets || [],
        }))
      }
      if (!c.educations?.length && (profile as any).educations?.length) {
        c.educations = (profile as any).educations.map((e: any) => ({
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

    // Deduplicate experiences by company+title
    if (c.experiences?.length) {
      const seen = new Set<string>()
      c.experiences = c.experiences.filter((e: any) => {
        const key = `${(e.company || "").toLowerCase()}|${(e.title || "").toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    // Deduplicate education by degree+school
    if (c.educations?.length) {
      const seen = new Set<string>()
      c.educations = c.educations.filter((e: any) => {
        const key = `${(e.degree || "").toLowerCase()}|${(e.school || "").toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    // Normalize skills to strings, deduplicate
    if (c.skills?.length) {
      const seen = new Set<string>()
      c.skills = c.skills.map((s: any) => typeof s === "string" ? s : s?.name || "").filter((s: string) => {
        if (!s || s.length > 60 || seen.has(s.toLowerCase())) return false
        seen.add(s.toLowerCase())
        return true
      })
    }

    setContent(c)
  }, [resumeData, profile])

  if (!content) return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</div>

  const save = async () => {
    setSaving(true)
    await onUpdate(content)
    setSaving(false)
    toast.success("Resume saved")
  }

  const set = (fn: (c: any) => void) => {
    setContent((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      fn(next)
      return next
    })
  }

  const contactLine = [content.email, content.phone, content.location, content.linkedin].filter(Boolean).join("  |  ")

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 sticky top-0 bg-background z-10 py-1">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button onClick={() => setEditing(false)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${!editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
            <Eye className="w-3 h-3 inline mr-1" />Preview
          </button>
          <button onClick={() => setEditing(true)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
            <Edit3 className="w-3 h-3 inline mr-1" />Edit
          </button>
        </div>
        {editing && (
          <Button size="sm" loading={saving} onClick={save} className="text-xs h-7">
            <Save className="w-3 h-3" /> Save
          </Button>
        )}
      </div>

      {/* Document */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="px-10 py-8 space-y-5" style={{ fontSize: "11pt", lineHeight: 1.45 }}>

          {/* Name + Contact */}
          <div className="text-center pb-3" style={{ borderBottom: "1.5px solid #333" }}>
            {editing ? (
              <input value={content.name || ""} onChange={e => set(c => { c.name = e.target.value })}
                className="text-[20pt] font-bold text-center w-full outline-none bg-yellow-50 rounded px-2 py-1" style={{ fontFamily: "inherit" }} />
            ) : (
              <h1 style={{ fontSize: "20pt", fontWeight: "bold" }}>{content.name || "Your Name"}</h1>
            )}
            {contactLine && <p className="mt-1" style={{ fontSize: "9.5pt", color: "#555" }}>{contactLine}</p>}
          </div>

          {/* Summary */}
          {(content.summary || editing) && (
            <Section title="Professional Summary">
              {editing ? (
                <textarea value={content.summary || ""} onChange={e => set(c => { c.summary = e.target.value })}
                  className="w-full outline-none bg-yellow-50 rounded p-2 resize-none" style={{ fontFamily: "inherit", fontSize: "10.5pt", minHeight: 70, lineHeight: 1.5 }} />
              ) : (
                <p style={{ fontSize: "10.5pt", lineHeight: 1.5 }}>{content.summary}</p>
              )}
            </Section>
          )}

          {/* Experience */}
          {content.experiences?.length > 0 && (
            <Section title="Professional Experience">
              {content.experiences.map((exp: any, i: number) => (
                <div key={i} className="mb-4">
                  <div className="flex justify-between items-baseline">
                    {editing ? (
                      <input value={exp.company || ""} onChange={e => set(c => { c.experiences[i].company = e.target.value })}
                        className="font-bold outline-none bg-yellow-50 rounded px-1 flex-1" style={{ fontFamily: "inherit", fontSize: "10.5pt" }} />
                    ) : (
                      <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>{exp.company}</span>
                    )}
                    <span style={{ fontSize: "9.5pt", color: "#666", whiteSpace: "nowrap", marginLeft: 8 }}>
                      {exp.start_date || exp.startDate || ""} – {exp.current ? "Present" : (exp.end_date || exp.endDate || "")}
                    </span>
                  </div>
                  {editing ? (
                    <input value={exp.title || ""} onChange={e => set(c => { c.experiences[i].title = e.target.value })}
                      className="italic outline-none bg-yellow-50 rounded px-1 w-full" style={{ fontFamily: "inherit", fontSize: "10pt", color: "#444" }} />
                  ) : (
                    <p style={{ fontStyle: "italic", fontSize: "10pt", color: "#444" }}>{exp.title}</p>
                  )}
                  {exp.bullets?.length > 0 && (
                    <ul style={{ listStyleType: "disc", marginLeft: 20, marginTop: 4 }}>
                      {exp.bullets.map((b: string, bi: number) => (
                        <li key={bi} style={{ fontSize: "10pt", marginBottom: 2, color: "#333", paddingLeft: 4 }}>
                          {editing ? (
                            <div className="flex items-start gap-1">
                              <input value={b} onChange={e => set(c => { c.experiences[i].bullets[bi] = e.target.value })}
                                className="flex-1 outline-none bg-yellow-50 rounded px-1" style={{ fontFamily: "inherit", fontSize: "10pt" }} />
                              <button onClick={() => set(c => { c.experiences[i].bullets.splice(bi, 1) })} className="text-red-400 hover:text-red-600 shrink-0 mt-0.5">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editing && (
                    <button onClick={() => set(c => { c.experiences[i].bullets = [...(c.experiences[i].bullets || []), ""] })}
                      className="text-xs text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add bullet
                    </button>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Skills — as categorized bullets */}
          {content.skills?.length > 0 && (
            <Section title="Technical Skills">
              {editing ? (
                <div className="space-y-1">
                  {content.skills.map((skill: string, i: number) => (
                    <div key={i} className="flex items-center gap-1">
                      <span style={{ fontSize: "10pt", color: "#666" }}>•</span>
                      <input value={skill} onChange={e => set(c => { c.skills[i] = e.target.value })}
                        className="flex-1 outline-none bg-yellow-50 rounded px-1" style={{ fontFamily: "inherit", fontSize: "10pt" }} />
                      <button onClick={() => set(c => { c.skills.splice(i, 1) })} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => set(c => { c.skills.push("") })} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add skill
                  </button>
                </div>
              ) : (
                /* Group skills in rows of ~8 for readability */
                <div style={{ fontSize: "10pt", lineHeight: 1.6 }}>
                  {chunkArray(content.skills, 8).map((row: string[], ri: number) => (
                    <div key={ri} style={{ marginBottom: 2 }}>
                      {row.map((s: string, si: number) => (
                        <span key={si}>
                          {si > 0 && <span style={{ color: "#999", margin: "0 6px" }}>·</span>}
                          {s}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Education */}
          {content.educations?.length > 0 && (
            <Section title="Education">
              {content.educations.map((edu: any, i: number) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>
                        {edu.degree}{edu.field ? `, ${edu.field}` : ""}
                      </span>
                      <span style={{ fontSize: "10pt", color: "#555", marginLeft: 8 }}>— {edu.school}</span>
                    </div>
                    <span style={{ fontSize: "9.5pt", color: "#666", whiteSpace: "nowrap", marginLeft: 8 }}>
                      {edu.end_date || edu.endDate || ""}
                    </span>
                  </div>
                  {edu.gpa && <p style={{ fontSize: "9.5pt", color: "#666" }}>GPA: {edu.gpa}</p>}
                </div>
              ))}
            </Section>
          )}

          {/* Projects */}
          {content.projects?.length > 0 && (
            <Section title="Projects">
              {content.projects.map((p: any, i: number) => (
                <div key={i} className="mb-2">
                  <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>{p.name}</span>
                  {p.description && <p style={{ fontSize: "10pt", color: "#555" }}>{p.description}</p>}
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px",
        borderBottom: "1px solid #bbb", paddingBottom: 2, marginBottom: 6 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function chunkArray(arr: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
