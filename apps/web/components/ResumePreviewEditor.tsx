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

// Client-side skill categorizer — matches the PDF backend logic exactly
function categorizeSkills(skills: string[]): Array<{category: string, items: string[]}> {
  const CATS: [string, string[]][] = [
    ["Languages", ["python","java","javascript","typescript","c#","c++","golang","go","ruby","rust","scala","julia","sql","bash","php","swift","kotlin","perl","matlab","r","lua","dart","html","css","nosql"]],
    ["AI/ML", ["pytorch","tensorflow","keras","scikit","xgboost","lightgbm","catboost","hugging face","transformers","opencv","spacy","nltk","langchain","llamaindex","openai","anthropic","claude","gemini","llama","gpt","bert","faiss","pinecone","weaviate","chroma","milvus","mlflow","wandb","tensorboard","machine learning","deep learning","neural","computer vision","nlp","natural language","llm","rag","retrieval-augmented","fine-tuning","fine tuning","prompt engineering","embedding","generative ai","agentic ai","ai agent","ai agents","reinforcement learning","gan","diffusion","recommendation","anomaly detection","feature engineering","model training","classification","regression","clustering","model capabilities","big data","vector database","ml libraries","sentiment","ner"]],
    ["Cloud Platforms", ["aws","amazon web services","azure","microsoft azure","gcp","google cloud","ec2","s3","lambda","sagemaker","bedrock","cloudformation","cloudwatch","ecs","eks","fargate","rds","redshift","kinesis","sns","sqs","azure devops","azure ml","cosmos db","cloud functions","cloud run","vertex ai","bigquery","dataflow","pubsub","heroku","vercel","netlify","railway","digitalocean","cloud"]],
    ["DevOps & Infrastructure", ["docker","kubernetes","k8s","terraform","ansible","puppet","chef","ci/cd","github actions","gitlab ci","jenkins","circleci","helm","istio","nginx","devops","devsecops","infrastructure as code","iac","linux","unix","monitoring","prometheus","grafana","datadog","new relic","splunk","elk","logging","observability","site reliability","sre"]],
    ["Databases & Storage", ["postgresql","postgres","mysql","mariadb","sqlite","mongodb","redis","elasticsearch","opensearch","cassandra","couchbase","neo4j","snowflake","databricks","duckdb","clickhouse","supabase","firebase","dynamodb","memcached","vector databases"]],
    ["Web Frameworks", ["react","angular","vue","svelte","next.js","nextjs","nuxt","gatsby","node","nodejs","express","fastapi","flask","django","spring","spring boot",".net","asp.net","rails","ruby on rails","laravel","rest api","graphql","grpc","websocket"]],
    ["Data Engineering", ["spark","pyspark","kafka","airflow","prefect","dagster","dbt","hadoop","hive","flink","beam","etl","elt","data pipeline","data lake","data warehouse","data mesh","pandas","numpy","polars","dask","matplotlib","seaborn","plotly","streamlit","gradio"]],
    ["Tools & Practices", ["git","github","gitlab","jira","jupyter","colab","rabbitmq","sdk","postman","insomnia","oop","functional programming","design patterns","solid","tdd","bdd","agile","scrum","kanban"]],
  ]
  const result: Array<{category: string, items: string[]}> = []
  const used = new Set<string>()
  const overflow: string[] = []

  for (const [cat, patterns] of CATS) {
    const matched: string[] = []
    for (const skill of skills) {
      if (used.has(skill.toLowerCase())) continue
      const sl = skill.toLowerCase().trim()
      if (patterns.some(p => sl === p || sl.includes(p) || p.includes(sl))) {
        matched.push(skill)
        used.add(skill.toLowerCase())
      }
    }
    if (matched.length > 0) result.push({ category: cat, items: matched })
  }
  // Remaining uncategorized
  for (const skill of skills) {
    if (!used.has(skill.toLowerCase())) overflow.push(skill)
  }
  // Overflow goes to "Other" — NEVER merged into Languages or other real categories
  if (overflow.length > 0) {
    result.push({ category: "Other", items: overflow })
  }

  // Keep all categories as-is. No merging small into large.
  return result.filter(cat => cat.items.length > 0)
}

function skillName(s: any): string {
  if (!s) return ""
  if (typeof s === "string") return s
  if (typeof s === "object" && s.name) return s.name
  return String(s)
}

// Normalize skill categories — handle both backend "skills" key and frontend "items" key
function normalizeSkillCategories(skills: any[]): Array<{category: string, items: string[]}> {
  return skills.map((s: any) => {
    if (s?.items) return { category: s.category || "Other", items: filterConceptPhrases(s.items) }
    if (s?.skills) return { category: s.category || "Other", items: filterConceptPhrases(s.skills) }
    return null
  }).filter(Boolean) as Array<{category: string, items: string[]}>
}

// Concept phrases that should NEVER appear in Technical Skills section
// These belong in experience bullets or summary, not as skill items
const CONCEPT_BLOCKLIST = new Set([
  "error handling", "incident response", "observability", "reliability",
  "error propagation", "sandboxing", "production systems", "client library",
  "distributed systems", "system design", "api design", "full lifecycle",
  "cloud-native", "scalability", "high availability", "fault tolerance",
  "performance optimization", "code review", "product instincts",
  "product thinking", "go-to-market", "stakeholder management",
  "cross-functional collaboration", "strategic thinking", "mentoring",
  "leadership", "communication", "problem solving", "critical thinking",
  "team management", "project management", "data-driven", "customer-facing",
  "user-facing", "real-time", "end-to-end", "full-stack thinking",
  "technical depth", "penetration testing", "cloud-native engineering",
  "full lifecycle engineering", "cloud-native ai/ml engineering",
  "full lifecycle product engineering", "product instincts and product thinking",
  "agentic ai framework development", "generative ai solution delivery",
  "llm fine-tuning and prompt engineering", "retrieval-augmented generation pipelines",
  "ai-powered cybersecurity products", "experimentation frameworks",
  "agile methodologies", "big data technologies", "model capabilities",
  "ml libraries", "data structures", "algorithms", "microservices",
  "documentation", "technical writing", "sdlc", "paas", "faas", "sdk",
])

function filterConceptPhrases(items: any[]): string[] {
  return items.filter((item: any) => {
    if (typeof item !== "string") return true
    const lower = item.toLowerCase().trim()
    // Remove if in blocklist
    if (CONCEPT_BLOCKLIST.has(lower)) return false
    // Remove if too long to be a real skill (>5 words or >50 chars)
    if (lower.split(" ").length > 5 || lower.length > 50) return false
    // Remove multi-word phrases containing concept signals (3+ words only)
    // "Prompt Engineering" (2 words) is valid; "cloud-native AI/ML engineering" (3+ words) is not
    if (lower.split(" ").length > 2) {
      const signals = ["engineering", "lifecycle", "instinct", "thinking", "management",
        "collaboration", "driven", "facing", "solution delivery", "framework development",
        "methodologies", "capabilities"]
      if (signals.some(s => lower.includes(s))) return false
    }
    return true
  }).map((item: any) => typeof item === "string" ? item : String(item))
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
      // Only fill in MISSING fields from profile — never overwrite existing resume content
      // Resume content (especially after tailoring) takes priority over profile tables
      if (!c.name && !c.full_name) c.name = profile.fullName || ""
      if (!c.email) c.email = (profile as any).email || ""
      if (!c.phone) c.phone = profile.phone || ""
      if (!c.location) c.location = profile.location || ""
      if (!c.linkedin) c.linkedin = profile.linkedinUrl || ""
      if (!c.summary) c.summary = profile.summary || profile.headline || ""

      // Only use profile experiences/education if resume content has NONE
      // After tailoring, resume.content has rewritten bullets — do NOT overwrite them
      if (!c.experiences?.length && (profile as any).experiences?.length) {
        const seen = new Set<string>()
        c.experiences = (profile as any).experiences.filter((e: any) => {
          const k = `${(e.company||"").toLowerCase()}|${(e.title||"").toLowerCase()}`
          if (seen.has(k)) return false; seen.add(k); return true
        }).map((e: any) => ({
          title: e.title, company: e.company, location: e.location,
          start_date: e.startDate, end_date: e.endDate, current: e.current, bullets: e.bullets || [],
        }))
      }
      if (!c.educations?.length && (profile as any).educations?.length) {
        const seen = new Set<string>()
        c.educations = (profile as any).educations.filter((e: any) => {
          const k = `${(e.degree||"").toLowerCase()}|${(e.school||"").toLowerCase()}`
          if (seen.has(k)) return false; seen.add(k); return true
        }).map((e: any) => ({
          degree: e.degree, field: e.field, school: e.school,
          start_date: e.startDate, end_date: e.endDate, gpa: e.gpa,
        }))
      }
      // Skills: keep categorized format if present
      if (!c.skills?.length && (profile as any).skills?.length) {
        c.skills = (profile as any).skills.map((s: any) => skillName(s))
      }
    }

    // Normalize skills to consistent categorized format
    // CRITICAL: filter out concept phrases that were incorrectly stuffed into skills
    if (c.skills?.length) {
      const hasCategorized = c.skills.some((s: any) => s?.items || s?.skills)
      if (hasCategorized) {
        // Normalize keys and filter concept phrases from each category
        c.skills = normalizeSkillCategories(c.skills)
      } else {
        // Flat string array — filter concepts FIRST, then categorize
        const flat = c.skills.map(skillName).filter((s: string) => s && s.length < 60)
        const cleaned = filterConceptPhrases(flat)
        c.skills = categorizeSkills(cleaned)
      }
      // Remove empty categories after filtering
      if (Array.isArray(c.skills)) {
        c.skills = c.skills.filter((cat: any) => cat?.items?.length > 0)
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
      // Add skill into the correct category (or "Other")
      set(c => {
        if (!c.skills) c.skills = []
        const isCat = c.skills.some((sk: any) => sk?.items)
        if (isCat) {
          // Find matching category or add to last one
          const sl = s.toLowerCase()
          let placed = false
          for (const cat of c.skills) {
            if (cat.items?.some((i: string) => sl.includes(i.toLowerCase().split(" ")[0]))) {
              cat.items.push(s)
              placed = true
              break
            }
          }
          if (!placed) {
            // Add to last category or create "Other"
            if (c.skills.length > 0) c.skills[c.skills.length - 1].items.push(s)
            else c.skills.push({ category: "Other", items: [s] })
          }
        } else {
          c.skills.push(s)
        }
      })
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

  // Trim summary for preview (4 sentences max like PDF)
  const trimSummary = (s: string) => {
    if (!s || editing) return s
    const sentences = s.replace(/\. /g, ".\n").split("\n").filter(x => x.trim())
    if (sentences.length <= 4) return s
    return sentences.slice(0, 4).join(" ") + (s.endsWith(".") ? "" : ".")
  }

  const isCategorizedSkills = content.skills?.some((s: any) => s?.items)
  const contact = [content.email, content.phone, content.location, content.linkedin].filter(Boolean)

  // Styles matching PDF exactly
  const docStyle: React.CSSProperties = { fontFamily: "'Times New Roman', Times, serif", fontSize: "10.5pt", lineHeight: 1.3, color: "#000" }
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

      {/* Resume Document (scrollable, matches PDF) */}
      <div className="flex-1 overflow-y-auto bg-white border rounded shadow-sm">
        <div style={{ ...docStyle, padding: "32px 36px", minHeight: "100%" }}>

          {/* Header — matches PDF header exactly */}
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            {editing ? (
              <input value={content.name || ""} onChange={e => set(c => { c.name = e.target.value })}
                className={editBg} style={{ ...docStyle, fontSize: "16pt", fontWeight: "bold", textAlign: "center", width: "100%" }} />
            ) : (
              <div style={{ fontSize: "16pt", fontWeight: "bold" }}>{content.name || "Your Name"}</div>
            )}
            {editing ? (
              <div style={{ marginTop: 2 }}>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                  <input value={content.email || ""} onChange={e => set(c => { c.email = e.target.value })} placeholder="Email"
                    className={editBg} style={{ ...docStyle, fontSize: "9.5pt", textAlign: "center", width: 180 }} />
                  <input value={content.phone || ""} onChange={e => set(c => { c.phone = e.target.value })} placeholder="Phone"
                    className={editBg} style={{ ...docStyle, fontSize: "9.5pt", textAlign: "center", width: 120 }} />
                  <input value={content.location || ""} onChange={e => set(c => { c.location = e.target.value })} placeholder="Location"
                    className={editBg} style={{ ...docStyle, fontSize: "9.5pt", textAlign: "center", width: 140 }} />
                  <input value={content.linkedin || ""} onChange={e => set(c => { c.linkedin = e.target.value })} placeholder="LinkedIn"
                    className={editBg} style={{ ...docStyle, fontSize: "9.5pt", textAlign: "center", width: 200 }} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "9.5pt", color: "#333", marginTop: 2 }}>{contact.join(" | ")}</div>
            )}
            <hr style={{ border: "none", borderTop: "1px solid #000", marginTop: 5 }} />
          </div>

          {/* Summary */}
          {(content.summary || editing) && (
            <DocSection title="Professional Summary">
              {editing ? (
                <textarea value={content.summary || ""} onChange={e => set(c => { c.summary = e.target.value })}
                  className={editBg} style={{ ...docStyle, width: "100%", minHeight: 60, resize: "vertical", lineHeight: "1.4" }} />
              ) : (
                <div style={{ fontSize: "10pt", lineHeight: "1.35" }}>{trimSummary(content.summary || "")}</div>
              )}
            </DocSection>
          )}

          {/* Professional Experience */}
          {(content.experiences?.length > 0 || editing) && (
            <DocSection title="Professional Experience">
              {(content.experiences || []).map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    {editing ? (
                      <input value={exp.company || ""} onChange={e => set(c => { c.experiences[i].company = e.target.value })}
                        className={editBg} style={{ ...docStyle, fontWeight: "bold", fontSize: "10.5pt", flex: 1 }} />
                    ) : (
                      <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>{exp.company}</span>
                    )}
                    {editing ? (
                      <div style={{ display: "flex", gap: 2, alignItems: "center", marginLeft: 8 }}>
                        <input value={exp.start_date || exp.startDate || ""} onChange={e => set(c => { c.experiences[i].start_date = e.target.value })}
                          placeholder="Start" className={editBg} style={{ ...docStyle, fontSize: "9.5pt", width: 70, textAlign: "center" }} />
                        <span style={{ fontSize: "9.5pt" }}>–</span>
                        <input value={exp.current ? "Present" : (exp.end_date || exp.endDate || "")} onChange={e => set(c => { c.experiences[i].end_date = e.target.value; c.experiences[i].current = e.target.value === "Present" })}
                          placeholder="End" className={editBg} style={{ ...docStyle, fontSize: "9.5pt", width: 70, textAlign: "center" }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: "9.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: 8 }}>
                        {fmtDate(exp.start_date || exp.startDate || "")} – {exp.current ? "Present" : fmtDate(exp.end_date || exp.endDate || "")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    {editing ? (
                      <input value={exp.title || ""} onChange={e => set(c => { c.experiences[i].title = e.target.value })}
                        className={editBg} style={{ ...docStyle, fontStyle: "italic", fontSize: "10pt", color: "#222", flex: 1 }} />
                    ) : (
                      <span style={{ fontStyle: "italic", fontSize: "10pt", color: "#222" }}>
                        {exp.title}{exp.location ? `, ${exp.location}` : ""}
                      </span>
                    )}
                    {editing && (
                      <button onClick={() => set(c => { c.experiences.splice(i, 1) })}
                        style={{ color: "#ccc", cursor: "pointer", marginLeft: 4 }} title="Remove experience"><Trash2 size={11} /></button>
                    )}
                  </div>
                  {exp.bullets?.length > 0 && (
                    <ul style={{ listStyleType: "disc", marginLeft: 18, padding: 0, marginTop: 2 }}>
                      {exp.bullets.map((b: string, bi: number) => (
                        <li key={bi} style={{ fontSize: "10pt", marginBottom: 1, lineHeight: 1.3, color: "#000" }}>
                          {editing ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                              <textarea value={b} onChange={e => set(c => { c.experiences[i].bullets[bi] = e.target.value })}
                                className={editBg} style={{ ...docStyle, fontSize: "10pt", flex: 1, resize: "vertical", minHeight: 18 }} />
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
                <button onClick={() => set(c => { if (!c.experiences) c.experiences = []; c.experiences.push({ company: "", title: "", location: "", bullets: [""], start_date: "", end_date: "", current: false }) })}
                  style={{ fontSize: "10px", color: "#6c63ff", cursor: "pointer", fontWeight: "bold" }}>+ Add Experience</button>
              )}
            </DocSection>
          )}

          {/* Technical Skills — categorized like PDF */}
          {content.skills?.length > 0 && (
            <DocSection title="Technical Skills">
              {isCategorizedSkills ? (
                content.skills.map((cat: any, ci: number) => (
                  <div key={ci} style={{ marginBottom: 1, fontSize: "10pt", lineHeight: 1.35 }}>
                    {editing ? (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                        <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                          <input value={cat.category || ""} onChange={e => set(c => { c.skills[ci].category = e.target.value })}
                            className={editBg} style={{ ...docStyle, fontSize: "10pt", fontWeight: "bold", width: 120 }} />
                          {" – "}
                        </span>
                        <input value={(cat.items || []).join(", ")} onChange={e => set(c => { c.skills[ci].items = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                          className={editBg} style={{ ...docStyle, fontSize: "10pt", flex: 1 }} />
                        <button onClick={() => set(c => { c.skills.splice(ci, 1) })} style={{ color: "#ccc", cursor: "pointer" }}><Trash2 size={10} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: "bold" }}>{cat.category} – </span>
                        <span>{(cat.items || []).join(", ")}</span>
                      </>
                    )}
                  </div>
                ))
              ) : (
                editing ? (
                  <textarea value={content.skills.map(skillName).join(", ")} onChange={e => set(c => { c.skills = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                    className={editBg} style={{ ...docStyle, width: "100%", minHeight: 40, resize: "vertical" }} />
                ) : (
                  <div style={{ fontSize: "10pt", lineHeight: 1.5 }}>{content.skills.map(skillName).join("  \u00B7  ")}</div>
                )
              )}
              {editing && isCategorizedSkills && (
                <button onClick={() => set(c => { c.skills.push({ category: "New Category", items: [] }) })}
                  style={{ fontSize: "9px", color: "#6c63ff", cursor: "pointer", marginTop: 3 }}>+ Add skill category</button>
              )}
            </DocSection>
          )}

          {/* Education — editable, matches PDF layout */}
          {(content.educations?.length > 0 || editing) && (
            <DocSection title="Education">
              {(content.educations || []).map((edu: any, i: number) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  {editing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ display: "flex", gap: 4, flex: 1 }}>
                          <input value={edu.degree || ""} onChange={e => set(c => { c.educations[i].degree = e.target.value })}
                            placeholder="Degree" className={editBg} style={{ ...docStyle, fontWeight: "bold", width: 180 }} />
                          <input value={edu.field || ""} onChange={e => set(c => { c.educations[i].field = e.target.value })}
                            placeholder="Field of study" className={editBg} style={{ ...docStyle, width: 160 }} />
                        </div>
                        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                          <input value={edu.end_date || edu.endDate || ""} onChange={e => set(c => { c.educations[i].end_date = e.target.value })}
                            placeholder="Year" className={editBg} style={{ ...docStyle, fontSize: "9.5pt", width: 60, textAlign: "center" }} />
                          <button onClick={() => set(c => { c.educations.splice(i, 1) })} style={{ color: "#ccc", cursor: "pointer" }}><Trash2 size={10} /></button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <input value={edu.school || ""} onChange={e => set(c => { c.educations[i].school = e.target.value })}
                          placeholder="School/University" className={editBg} style={{ ...docStyle, color: "#222", flex: 1 }} />
                        <input value={edu.gpa || ""} onChange={e => set(c => { c.educations[i].gpa = e.target.value })}
                          placeholder="GPA" className={editBg} style={{ ...docStyle, fontSize: "8.5pt", width: 60 }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>{edu.degree}{edu.field ? `, ${edu.field}` : ""}</span>
                        <span style={{ fontSize: "10pt", color: "#222", marginLeft: 8 }}>— {edu.school}</span>
                        {edu.gpa && <span style={{ fontSize: "8.5pt", color: "#666", marginLeft: 4 }}>(GPA: {edu.gpa})</span>}
                      </div>
                      <span style={{ fontSize: "9.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: 8 }}>{fmtDate(edu.end_date || edu.endDate || "")}</span>
                    </div>
                  )}
                </div>
              ))}
              {editing && (
                <button onClick={() => set(c => { if (!c.educations) c.educations = []; c.educations.push({ degree: "", field: "", school: "", end_date: "", gpa: "" }) })}
                  style={{ fontSize: "10px", color: "#6c63ff", cursor: "pointer", fontWeight: "bold" }}>+ Add Education</button>
              )}
            </DocSection>
          )}

          {/* Projects — matches PDF layout */}
          {(content.projects?.length > 0 || editing) && (
            <DocSection title="Projects">
              {(content.projects || []).map((proj: any, i: number) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    {editing ? (
                      <input value={proj.name || ""} onChange={e => set(c => { c.projects[i].name = e.target.value })}
                        className={editBg} style={{ ...docStyle, fontWeight: "bold", fontSize: "10.5pt", flex: 1 }} />
                    ) : (
                      <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>{proj.name}</span>
                    )}
                    {editing && (
                      <button onClick={() => set(c => { c.projects.splice(i, 1) })} style={{ color: "#ccc", cursor: "pointer", marginLeft: 4 }}><Trash2 size={11} /></button>
                    )}
                  </div>
                  {(proj.description || editing) && (
                    editing ? (
                      <input value={proj.description || ""} onChange={e => set(c => { c.projects[i].description = e.target.value })}
                        className={editBg} style={{ ...docStyle, fontStyle: "italic", fontSize: "10pt", color: "#222", width: "100%" }} />
                    ) : (
                      proj.description && <div style={{ fontStyle: "italic", fontSize: "10pt", color: "#222" }}>{proj.description}</div>
                    )
                  )}
                  {proj.bullets?.length > 0 && (
                    <ul style={{ listStyleType: "disc", marginLeft: 18, padding: 0, marginTop: 2 }}>
                      {proj.bullets.map((b: string, bi: number) => (
                        <li key={bi} style={{ fontSize: "10pt", marginBottom: 1, lineHeight: 1.3, color: "#000" }}>
                          {editing ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                              <textarea value={b} onChange={e => set(c => { c.projects[i].bullets[bi] = e.target.value })}
                                className={editBg} style={{ ...docStyle, fontSize: "10pt", flex: 1, resize: "vertical", minHeight: 18 }} />
                              <button onClick={() => set(c => { c.projects[i].bullets.splice(bi, 1) })} style={{ color: "#ccc", cursor: "pointer", marginTop: 2 }}><Trash2 size={10} /></button>
                            </div>
                          ) : b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editing && (
                    <button onClick={() => set(c => { if (!c.projects[i].bullets) c.projects[i].bullets = []; c.projects[i].bullets.push("") })}
                      style={{ fontSize: "9px", color: "#6c63ff", cursor: "pointer", marginTop: 2 }}>+ Add bullet</button>
                  )}
                </div>
              ))}
              {editing && (
                <button onClick={() => set(c => { if (!c.projects) c.projects = []; c.projects.push({ name: "", description: "", bullets: [""] }) })}
                  style={{ fontSize: "10px", color: "#6c63ff", cursor: "pointer", fontWeight: "bold" }}>+ Add Project</button>
              )}
            </DocSection>
          )}

          {/* Certifications — if present */}
          {content.certifications?.length > 0 && (
            <DocSection title="Certifications">
              {content.certifications.map((cert: any, i: number) => (
                <div key={i} style={{ fontSize: "10pt", marginBottom: 1, lineHeight: 1.35 }}>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input value={typeof cert === "string" ? cert : cert.name || ""} onChange={e => set(c => { c.certifications[i] = e.target.value })}
                        className={editBg} style={{ ...docStyle, flex: 1 }} />
                      <button onClick={() => set(c => { c.certifications.splice(i, 1) })} style={{ color: "#ccc", cursor: "pointer" }}><Trash2 size={10} /></button>
                    </div>
                  ) : (
                    <span>{typeof cert === "string" ? cert : cert.name || ""}</span>
                  )}
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
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: "10.5pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 2, paddingTop: 3 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
