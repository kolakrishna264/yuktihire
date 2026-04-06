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
  const [userInput, setUserInput] = useState("")
  const { data: profile } = useProfile()

  useEffect(() => {
    const raw = (resumeData as any)?.resume ?? resumeData
    let c: any = {}
    try { c = raw?.content ? JSON.parse(JSON.stringify(raw.content)) : (raw ? JSON.parse(JSON.stringify(raw)) : {}) } catch { c = {} }

    if (profile) {
      if (!c.name && !c.full_name) c.name = profile.fullName || ""
      // Don't override email — keep resume email
      if (!c.phone) c.phone = profile.phone || ""
      if (!c.location) c.location = profile.location || ""
      if (!c.linkedin) c.linkedin = profile.linkedinUrl || ""
      if (!c.summary) c.summary = profile.summary || profile.headline || ""

      // Always use profile experiences/education (source of truth)
      if ((profile as any).experiences?.length) {
        const seen = new Set<string>()
        c.experiences = (profile as any).experiences.filter((e: any) => {
          const k = `${(e.company||"").toLowerCase()}|${(e.title||"").toLowerCase()}`
          if (seen.has(k)) return false; seen.add(k); return true
        }).map((e: any) => ({
          title: e.title, company: e.company, location: e.location,
          start_date: e.startDate, end_date: e.endDate, current: e.current, bullets: e.bullets || [],
        }))
      }
      if ((profile as any).educations?.length) {
        const seen = new Set<string>()
        c.educations = (profile as any).educations.filter((e: any) => {
          const k = `${(e.degree||"").toLowerCase()}|${(e.school||"").toLowerCase()}`
          if (seen.has(k)) return false; seen.add(k); return true
        }).map((e: any) => ({
          degree: e.degree, field: e.field, school: e.school, end_date: e.endDate, gpa: e.gpa,
        }))
      }
      // Skills: keep categorized format if present
      if (!c.skills?.length && (profile as any).skills?.length) {
        c.skills = (profile as any).skills.map((s: any) => skillName(s))
      }
    }

    // Preserve categorized skill format
    if (c.skills?.length) {
      const hasCategorized = c.skills.some((s: any) => s?.items || (s?.category && s?.name))
      if (!hasCategorized) {
        c.skills = c.skills.map(skillName).filter((s: string) => s && s.length < 60)
      }
    }

    setContent(c)
  }, [resumeData, profile])

  if (!content) return <div className="flex items-center justify-center py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</div>

  const save = async () => { setSaving(true); await onUpdate(content); setSaving(false); toast.success("Resume saved") }
  const set = (fn: (c: any) => void) => { setContent((prev: any) => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next }) }

  const addUserInput = () => {
    if (!userInput.trim()) return
    const s = userInput.trim()
    if (s.split(" ").length <= 3) {
      set(c => { if (!c.skills) c.skills = []; c.skills.push(s) })
      toast.success(`Added "${s}" to skills`)
    } else {
      set(c => { if (c.experiences?.length) c.experiences[0].bullets.push(s) })
      toast.success("Added as experience bullet")
    }
    setUserInput("")
  }

  // Format dates for display
  const fmtDate = (d: string) => {
    if (!d || d === "Present") return d || ""
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    try {
      const parts = d.split("-")
      if (parts.length >= 2) return `${months[parseInt(parts[1])-1]} ${parts[0]}`
    } catch {}
    return d
  }

  // Trim summary for preview
  const trimSummary = (s: string) => {
    if (!s || editing) return s
    const sentences = s.replace(/\. /g, ".\n").split("\n").filter(x => x.trim())
    if (sentences.length <= 4) return s
    return sentences.slice(0, 4).join(" ") + (s.endsWith(".") ? "" : ".")
  }

  const isCategorizedSkills = content.skills?.some((s: any) => s?.items)
  const contact = [content.email, content.phone, content.location, content.linkedin].filter(Boolean)

  // ── Styles matching PDF exactly ──
  const docStyle: React.CSSProperties = { fontFamily: "'Times New Roman', Times, serif", fontSize: "10.5pt", lineHeight: 1.3, color: "#000" }
  const headingStyle: React.CSSProperties = { fontSize: "10.5pt", fontWeight: "bold", textTransform: "uppercase" as const, letterSpacing: "0.3px", marginBottom: 3, paddingTop: 3 }
  const editBg = "bg-yellow-50 outline-none rounded px-0.5"

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <div className="flex gap-0.5 bg-muted/50 rounded p-0.5">
          <button onClick={() => setEditing(false)} className={`px-2 py-1 rounded text-[10px] font-medium ${!editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}><Eye className="w-3 h-3 inline mr-0.5" />Preview</button>
          <button onClick={() => setEditing(true)} className={`px-2 py-1 rounded text-[10px] font-medium ${editing ? "bg-white shadow-sm" : "text-muted-foreground"}`}><Edit3 className="w-3 h-3 inline mr-0.5" />Edit</button>
        </div>
        <div className="flex gap-1">
          {editing && <Button size="sm" loading={saving} onClick={save} className="text-[10px] h-6"><Save className="w-3 h-3" />Save</Button>}
        </div>
      </div>

      {/* User input */}
      <div className="flex gap-1 mb-1.5 shrink-0">
        <input value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addUserInput()}
          placeholder="Add skill or bullet point..." className="flex-1 text-[10px] border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary" />
        <Button size="sm" variant="outline" onClick={addUserInput} disabled={!userInput.trim()} className="text-[10px] h-6"><Plus className="w-3 h-3" /></Button>
      </div>

      {/* ── Resume Document (scrollable, matches PDF) ── */}
      <div className="flex-1 overflow-y-auto bg-white border rounded shadow-sm">
        <div style={{ ...docStyle, padding: "32px 36px", minHeight: "100%" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            {editing ? (
              <input value={content.name || ""} onChange={e => set(c => { c.name = e.target.value })}
                className={editBg} style={{ ...docStyle, fontSize: "16pt", fontWeight: "bold", textAlign: "center", width: "100%" }} />
            ) : (
              <div style={{ fontSize: "16pt", fontWeight: "bold" }}>{content.name || "Your Name"}</div>
            )}
            <div style={{ fontSize: "9.5pt", color: "#333", marginTop: 2 }}>{contact.join(" | ")}</div>
            <hr style={{ border: "none", borderTop: "1px solid #000", marginTop: 5 }} />
          </div>

          {/* Summary */}
          {(content.summary || editing) && (
            <DocSection title="Professional Summary">
              {editing ? (
                <textarea value={content.summary || ""} onChange={e => set(c => { c.summary = e.target.value })}
                  className={editBg} style={{ ...docStyle, width: "100%", minHeight: 60, resize: "vertical", lineHeight: "1.4" }} />
              ) : (
                <div style={{ fontSize: "10pt", lineHeight: "1.4" }}>{trimSummary(content.summary || "")}</div>
              )}
            </DocSection>
          )}

          {/* Experience */}
          {content.experiences?.length > 0 && (
            <DocSection title="Professional Experience">
              {content.experiences.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    {editing ? (
                      <input value={exp.company || ""} onChange={e => set(c => { c.experiences[i].company = e.target.value })}
                        className={editBg} style={{ ...docStyle, fontWeight: "bold", flex: 1 }} />
                    ) : (
                      <span style={{ fontWeight: "bold" }}>{exp.company}</span>
                    )}
                    <span style={{ fontSize: "9.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: 8 }}>
                      {fmtDate(exp.start_date || exp.startDate || "")} – {exp.current ? "Present" : fmtDate(exp.end_date || exp.endDate || "")}
                    </span>
                  </div>
                  {editing ? (
                    <input value={exp.title || ""} onChange={e => set(c => { c.experiences[i].title = e.target.value })}
                      className={editBg} style={{ ...docStyle, fontStyle: "italic", color: "#222", width: "100%" }} />
                  ) : (
                    <div style={{ fontStyle: "italic", color: "#222" }}>{exp.title}</div>
                  )}
                  {exp.bullets?.length > 0 && (
                    <ul style={{ listStyleType: "disc", marginLeft: 18, marginTop: 3 }}>
                      {exp.bullets.map((b: string, bi: number) => (
                        <li key={bi} style={{ fontSize: "10pt", marginBottom: 1, lineHeight: 1.3 }}>
                          {editing ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                              <textarea value={b} onChange={e => set(c => { c.experiences[i].bullets[bi] = e.target.value })}
                                className={editBg} style={{ ...docStyle, flex: 1, resize: "vertical", minHeight: 18 }} />
                              <button onClick={() => set(c => { c.experiences[i].bullets.splice(bi, 1) })} style={{ color: "#ccc", cursor: "pointer", marginTop: 2 }}><Trash2 size={10} /></button>
                            </div>
                          ) : b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editing && (
                    <button onClick={() => set(c => { c.experiences[i].bullets.push("") })}
                      style={{ fontSize: "9px", color: "#6c63ff", cursor: "pointer", marginTop: 2 }}>+ Add bullet</button>
                  )}
                </div>
              ))}
              {editing && (
                <button onClick={() => set(c => { c.experiences.push({ company: "", title: "", bullets: [""], start_date: "", end_date: "", current: false }) })}
                  style={{ fontSize: "10px", color: "#6c63ff", cursor: "pointer", fontWeight: "bold" }}>+ Add Experience</button>
              )}
            </DocSection>
          )}

          {/* Skills */}
          {content.skills?.length > 0 && (
            <DocSection title="Technical Skills">
              {isCategorizedSkills ? (
                content.skills.map((cat: any, ci: number) => (
                  <div key={ci} style={{ marginBottom: 1, fontSize: "10pt", lineHeight: 1.35 }}>
                    <span style={{ fontWeight: "bold" }}>{cat.category} – </span>
                    {editing ? (
                      <input value={(cat.items || []).join(", ")} onChange={e => set(c => { c.skills[ci].items = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                        className={editBg} style={{ ...docStyle, width: "70%" }} />
                    ) : (
                      <span>{(cat.items || []).join(", ")}</span>
                    )}
                  </div>
                ))
              ) : (
                editing ? (
                  <textarea value={content.skills.join(", ")} onChange={e => set(c => { c.skills = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                    className={editBg} style={{ ...docStyle, width: "100%", minHeight: 40, resize: "vertical" }} />
                ) : (
                  <div style={{ fontSize: "10pt", lineHeight: 1.5 }}>{content.skills.join("  ·  ")}</div>
                )
              )}
            </DocSection>
          )}

          {/* Education */}
          {content.educations?.length > 0 && (
            <DocSection title="Education">
              {content.educations.map((edu: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <div>
                    <span style={{ fontWeight: "bold" }}>{edu.degree}{edu.field ? `, ${edu.field}` : ""}</span>
                    <span style={{ color: "#222", marginLeft: 8 }}>— {edu.school}</span>
                  </div>
                  <span style={{ fontSize: "9.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: 8 }}>{fmtDate(edu.end_date || edu.endDate || "")}</span>
                </div>
              ))}
            </DocSection>
          )}

        </div>
      </div>
    </div>
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontSize: "10.5pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 3, paddingTop: 3 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
