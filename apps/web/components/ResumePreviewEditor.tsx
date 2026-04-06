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

// Safely get skill name from string or object
function skillName(s: any): string {
  if (!s) return ""
  if (typeof s === "string") return s
  if (typeof s === "object" && s.name) return s.name
  return String(s)
}

export function ResumePreviewEditor({ resumeData, resumeId, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [userSuggestion, setUserSuggestion] = useState("")
  const { data: profile } = useProfile()

  useEffect(() => {
    const raw = (resumeData as any)?.resume ?? resumeData
    let c: any = {}
    try { c = raw?.content ? JSON.parse(JSON.stringify(raw.content)) : (raw ? JSON.parse(JSON.stringify(raw)) : {}) } catch { c = {} }

    if (profile) {
      if (!c.name && !c.full_name) c.name = profile.fullName || ""
      // DON'T override email from profile — profile.email is the ACCOUNT email
      // Resume content has the RESUME email from the uploaded PDF
      if (!c.phone) c.phone = profile.phone || ""
      if (!c.location) c.location = profile.location || ""
      if (!c.linkedin) c.linkedin = profile.linkedinUrl || ""
      if (!c.summary) c.summary = profile.summary || profile.headline || ""
      // ALWAYS use profile data as primary source for experiences/education/skills
      // Resume content may be stale or truncated from old parser runs
      if ((profile as any).experiences?.length) {
        // Deduplicate by company+title
        const seen = new Set<string>()
        c.experiences = (profile as any).experiences.filter((e: any) => {
          const key = `${(e.company||"").toLowerCase()}|${(e.title||"").toLowerCase()}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }).map((e: any) => ({
          title: e.title, company: e.company, location: e.location,
          start_date: e.startDate, end_date: e.endDate, current: e.current, bullets: e.bullets || [],
        }))
      }
      if ((profile as any).educations?.length) {
        const seen = new Set<string>()
        c.educations = (profile as any).educations.filter((e: any) => {
          const key = `${(e.degree||"").toLowerCase()}|${(e.school||"").toLowerCase()}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }).map((e: any) => ({
          degree: e.degree, field: e.field, school: e.school, end_date: e.endDate, gpa: e.gpa,
        }))
      }
      // For skills: check if resume has categorized format, otherwise keep as-is
      if (!c.skills?.length && (profile as any).skills?.length) {
        c.skills = (profile as any).skills.map((s: any) => skillName(s))
      }
    }

    // Check if skills are flat strings but should be categorized
    // Preserve categorized skill format [{category, items}] — do NOT flatten
    // Only normalize if all skills are plain strings (legacy format)
    if (c.skills?.length) {
      const hasCategorized = c.skills.some((s: any) => s?.items || s?.category)
      if (!hasCategorized) {
        // Legacy flat format — normalize to strings
        c.skills = c.skills.map(skillName).filter((s: string) => s && s.length < 60)
      }
      // If categorized format [{category, items}], leave as-is for grouped rendering
    }

    // Deduplicate
    if (c.experiences?.length) {
      const seen = new Set<string>()
      c.experiences = c.experiences.filter((e: any) => {
        const k = `${(e.company||"").toLowerCase()}|${(e.title||"").toLowerCase()}`
        if (seen.has(k)) return false; seen.add(k); return true
      })
    }
    if (c.educations?.length) {
      const seen = new Set<string>()
      c.educations = c.educations.filter((e: any) => {
        const k = `${(e.degree||"").toLowerCase()}|${(e.school||"").toLowerCase()}`
        if (seen.has(k)) return false; seen.add(k); return true
      })
    }
    if (c.skills?.length) {
      const seen = new Set<string>()
      c.skills = c.skills.filter((s: string) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    }

    setContent(c)
  }, [resumeData, profile])

  if (!content) return <div className="flex items-center justify-center py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</div>

  const save = async () => { setSaving(true); await onUpdate(content); setSaving(false); toast.success("Resume saved") }

  const set = (fn: (c: any) => void) => {
    setContent((prev: any) => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next })
  }

  const applySuggestion = () => {
    if (!userSuggestion.trim()) return
    const s = userSuggestion.trim()
    // If it looks like a skill (short, no spaces or few words), add to skills
    if (s.split(" ").length <= 3 && s.length < 40) {
      set(c => { if (!c.skills) c.skills = []; c.skills.push(s) })
      toast.success(`Added "${s}" to skills`)
    } else {
      // Add as a bullet to the first experience or summary
      set(c => {
        if (c.experiences?.length) { c.experiences[0].bullets = [...(c.experiences[0].bullets || []), s] }
        else { c.summary = (c.summary || "") + " " + s }
      })
      toast.success("Added to resume")
    }
    setUserSuggestion("")
  }

  const contact = [content.email, content.phone, content.location, content.linkedin].filter(Boolean).join("  |  ")

  // Trim summary to 4 sentences in preview (matches PDF)
  const trimmedSummary = (() => {
    const raw = content.summary || ""
    if (!raw || editing) return raw
    const sentences = raw.replace(/\. /g, ".\n").split("\n").filter((s: string) => s.trim())
    if (sentences.length <= 4) return raw
    let t = sentences.slice(0, 4).join(" ")
    if (!t.endsWith(".")) t += "."
    return t
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button onClick={() => setEditing(false)} className={`px-2.5 py-1 rounded text-[11px] font-medium ${!editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
            <Eye className="w-3 h-3 inline mr-1" />Preview
          </button>
          <button onClick={() => setEditing(true)} className={`px-2.5 py-1 rounded text-[11px] font-medium ${editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}>
            <Edit3 className="w-3 h-3 inline mr-1" />Edit
          </button>
        </div>
        {editing && <Button size="sm" loading={saving} onClick={save} className="text-[11px] h-6"><Save className="w-3 h-3" />Save</Button>}
      </div>

      {/* User suggestion input */}
      <div className="flex gap-1.5 mb-2 shrink-0">
        <input value={userSuggestion} onChange={e => setUserSuggestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && applySuggestion()}
          placeholder="Type a skill or improvement to add..."
          className="flex-1 text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
        <Button size="sm" variant="outline" onClick={applySuggestion} disabled={!userSuggestion.trim()} className="text-[11px] h-7">
          <Plus className="w-3 h-3" />Add
        </Button>
      </div>

      {/* Resume Document */}
      <div className="flex-1 overflow-y-auto bg-white border rounded-lg shadow-sm">
        <div className="px-7 py-5 space-y-3" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt", lineHeight: 1.35 }}>

          {/* Header */}
          <div className="text-center pb-2">
            {editing ? (
              <input value={content.name || ""} onChange={e => set(c => { c.name = e.target.value })}
                className="text-lg font-bold text-center w-full outline-none bg-yellow-50 rounded px-1" style={{ fontFamily: "inherit" }} />
            ) : (
              <div className="text-lg font-bold">{content.name || "Your Name"}</div>
            )}
            {contact && <div className="text-[8.5pt] text-gray-500 mt-0.5">{contact}</div>}
            <hr style={{ border: "none", borderTop: "1px solid #000", marginTop: 4 }} />
          </div>

          {/* Summary */}
          {(content.summary || editing) && (
            <Sec title="Professional Summary">
              {editing ? (
                <textarea value={content.summary || ""} onChange={e => set(c => { c.summary = e.target.value })}
                  className="w-full outline-none bg-yellow-50 rounded p-1 resize-none text-[9.5pt]" style={{ fontFamily: "inherit", minHeight: 50, lineHeight: "1.4" }} />
              ) : <p className="text-[9.5pt]" style={{ lineHeight: "1.4" }}>{trimmedSummary}</p>}
            </Sec>
          )}

          {/* Experience */}
          {content.experiences?.length > 0 && (
            <Sec title="Professional Experience">
              {content.experiences.map((exp: any, i: number) => (
                <div key={i} className="mb-3">
                  <div className="flex justify-between items-baseline">
                    {editing ? (
                      <input value={exp.company || ""} onChange={e => set(c => { c.experiences[i].company = e.target.value })}
                        className="font-bold outline-none bg-yellow-50 rounded px-0.5 flex-1 text-[10pt]" style={{ fontFamily: "inherit" }} />
                    ) : <span className="font-bold text-[10pt]">{exp.company}</span>}
                    <span className="text-[8.5pt] text-gray-500 ml-2 whitespace-nowrap">
                      {exp.start_date || exp.startDate || ""} – {exp.current ? "Present" : (exp.end_date || exp.endDate || "")}
                    </span>
                  </div>
                  {editing ? (
                    <input value={exp.title || ""} onChange={e => set(c => { c.experiences[i].title = e.target.value })}
                      className="italic outline-none bg-yellow-50 rounded px-0.5 w-full text-[9.5pt]" style={{ fontFamily: "inherit", color: "#444" }} />
                  ) : <div className="italic text-[9.5pt]" style={{ color: "#444" }}>{exp.title}</div>}
                  {exp.bullets?.length > 0 && (
                    <ul style={{ listStyleType: "disc", marginLeft: 14, marginTop: 2 }}>
                      {exp.bullets.map((b: string, bi: number) => (
                        <li key={bi} className="text-[9pt] mb-0.5" style={{ color: "#222" }}>
                          {editing ? (
                            <div className="flex items-start gap-0.5">
                              <input value={b} onChange={e => set(c => { c.experiences[i].bullets[bi] = e.target.value })}
                                className="flex-1 outline-none bg-yellow-50 rounded px-0.5 text-[9pt]" style={{ fontFamily: "inherit" }} />
                              <button onClick={() => set(c => { c.experiences[i].bullets.splice(bi, 1) })} className="text-red-300 hover:text-red-500 mt-0.5"><Trash2 className="w-2.5 h-2.5" /></button>
                            </div>
                          ) : b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editing && (
                    <button onClick={() => set(c => { c.experiences[i].bullets = [...(c.experiences[i].bullets || []), ""] })}
                      className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5 flex items-center gap-0.5"><Plus className="w-2.5 h-2.5" />bullet</button>
                  )}
                </div>
              ))}
            </Sec>
          )}

          {/* Skills — preserve original category structure */}
          {content.skills?.length > 0 && (
            <Sec title="Technical Skills">
              {(() => {
                // Detect format: categorized [{category, items}] or flat strings
                const isCategorized = content.skills.some((s: any) => s?.items)
                const isLegacy = content.skills.some((s: any) => s?.category && s?.name)

                if (isCategorized) {
                  // New format: [{category: "Languages", items: ["Python", ...]}]
                  return content.skills.map((cat: any, ci: number) => (
                    <div key={ci} style={{ marginBottom: 2, fontSize: "9.5pt", lineHeight: 1.35 }}>
                      <span style={{ fontWeight: "bold" }}>{cat.category} – </span>
                      {editing ? (
                        <input
                          value={(cat.items || []).join(", ")}
                          onChange={e => set(c => { c.skills[ci].items = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                          className="outline-none bg-yellow-50 rounded px-0.5 w-3/4"
                          style={{ fontFamily: "inherit", fontSize: "9.5pt" }} />
                      ) : (
                        <span>{(cat.items || []).join(", ")}</span>
                      )}
                    </div>
                  ))
                }

                // Flat format or legacy
                const flatSkills = content.skills.map(skillName).filter((s: string) => s)
                return editing ? (
                  <textarea
                    value={flatSkills.join(", ")}
                    onChange={e => set(c => { c.skills = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                    className="w-full outline-none bg-yellow-50 rounded p-1 resize-none text-[9pt]"
                    style={{ fontFamily: "inherit", minHeight: 40 }} />
                ) : (
                  <div className="text-[9pt]" style={{ lineHeight: "1.5" }}>
                    {flatSkills.join("  ·  ")}
                  </div>
                )
              })()}
            </Sec>
          )}

          {/* Education */}
          {content.educations?.length > 0 && (
            <Sec title="Education">
              {content.educations.map((edu: any, i: number) => (
                <div key={i} className="flex justify-between items-baseline mb-1">
                  <div>
                    <span className="font-bold text-[9.5pt]">{edu.degree}{edu.field ? `, ${edu.field}` : ""}</span>
                    <span className="text-[9pt] text-gray-500 ml-1.5">— {edu.school}</span>
                  </div>
                  <span className="text-[8.5pt] text-gray-500 ml-2">{edu.end_date || edu.endDate || ""}</span>
                </div>
              ))}
            </Sec>
          )}
        </div>
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-bold uppercase text-[9.5pt] tracking-wide mb-1" style={{ borderBottom: "0.5px solid #bbb", paddingBottom: 1 }}>{title}</h2>
      {children}
    </div>
  )
}
