"use client"

import { useState, useEffect } from "react"
import { useProfile, useUpdateProfile, useAddExperience, useDeleteExperience, useAddEducation, useDeleteEducation, useAddSkill, useDeleteSkill } from "@/lib/hooks/useProfile"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/EmptyState"
import { User, Briefcase, GraduationCap, Zap, Plus, Trash2, Save, X, FileText } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { ProfileAutoSetup } from "@/components/ProfileAutoSetup"

type Tab = "basics" | "experience" | "education" | "skills" | "application"

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("basics")
  const { data: profile, isLoading } = useProfile()
  const { mutate: updateProfile, isPending: saving } = useUpdateProfile()

  const [basics, setBasics] = useState({
    firstName: "", lastName: "", headline: "", summary: "", phone: "", location: "",
    linkedinUrl: "", githubUrl: "", portfolioUrl: "",
  })
  const [basicsLoaded, setBasicsLoaded] = useState(false)

  if (profile && !basicsLoaded) {
    const nameParts = (profile.fullName ?? "").trim().split(" ")
    setBasics({
      firstName: (profile as any).firstName ?? nameParts[0] ?? "",
      lastName: (profile as any).lastName ?? nameParts.slice(1).join(" ") ?? "",
      headline: profile.headline ?? "",
      summary: profile.summary ?? "",
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      githubUrl: profile.githubUrl ?? "",
      portfolioUrl: profile.portfolioUrl ?? "",
    })
    setBasicsLoaded(true)
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "basics", label: "Basic Info", icon: User },
    { id: "experience", label: "Experience", icon: Briefcase },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "skills", label: "Skills", icon: Zap },
    { id: "application", label: "Application Info", icon: Zap },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your career data used for tailoring
        </p>
      </div>

      <ProfileAutoSetup />

      {/* Completeness bar */}
      {profile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Profile Strength</span>
              <span className="text-sm font-bold text-primary">{profile.completeness}%</span>
            </div>
            <Progress value={profile.completeness} />
            {profile.completeness < 100 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                A complete profile improves AI tailoring accuracy
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <>
          {tab === "basics" && (
            <BasicsTab
              basics={basics}
              onChange={(k, v) => setBasics((p) => ({ ...p, [k]: v }))}
              onSave={async () => {
                // Save name separately (first_name + last_name)
                try {
                  await apiFetch("/extension/update-name", {
                    method: "POST",
                    body: JSON.stringify({ first_name: basics.firstName, last_name: basics.lastName }),
                  })
                } catch {}
                // Save rest of profile
                updateProfile({
                  full_name: `${basics.firstName} ${basics.lastName}`.trim(),
                  headline: basics.headline,
                  summary: basics.summary,
                  phone: basics.phone,
                  location: basics.location,
                  linkedin: basics.linkedinUrl,
                  github: basics.githubUrl,
                  portfolio: basics.portfolioUrl,
                })
              }}
              saving={saving}
            />
          )}
          {tab === "experience" && <ExperienceTab />}
          {tab === "education" && <EducationTab />}
          {tab === "skills" && <SkillsTab />}
          {tab === "application" && <ApplicationInfoTab />}
        </>
      )}
    </div>
  )
}

// ── Basics Tab ────────────────────────────────────────────────────────────

function BasicsTab({
  basics,
  onChange,
  onSave,
  saving,
}: {
  basics: Record<string, string>
  onChange: (k: string, v: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
          <Input value={basics.firstName} onChange={(e) => onChange("firstName", e.target.value)} placeholder="Jane" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
          <Input value={basics.lastName} onChange={(e) => onChange("lastName", e.target.value)} placeholder="Smith" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
        <Input value={basics.location} onChange={(e) => onChange("location", e.target.value)} placeholder="San Francisco, CA" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Headline</label>
        <Input value={basics.headline} onChange={(e) => onChange("headline", e.target.value)} placeholder="Senior Software Engineer at Acme Corp" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Professional Summary</label>
        <Textarea
          value={basics.summary}
          onChange={(e) => onChange("summary", e.target.value)}
          placeholder="Brief overview of your experience and career goals…"
          className="min-h-[120px]"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
          <Input value={basics.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="+1 555 123 4567" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">LinkedIn URL</label>
          <Input value={basics.linkedinUrl} onChange={(e) => onChange("linkedinUrl", e.target.value)} placeholder="linkedin.com/in/janesmith" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">GitHub URL</label>
          <Input value={basics.githubUrl} onChange={(e) => onChange("githubUrl", e.target.value)} placeholder="github.com/janesmith" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Portfolio URL</label>
          <Input value={basics.portfolioUrl} onChange={(e) => onChange("portfolioUrl", e.target.value)} placeholder="janesmith.dev" />
        </div>
      </div>

      <Button loading={saving} onClick={onSave} className="w-full sm:w-auto">
        <Save className="w-4 h-4" />
        Save Changes
      </Button>
    </div>
  )
}

// ── Experience Tab ────────────────────────────────────────────────────────

function ExperienceTab() {
  const { data: profile } = useProfile()
  const { mutate: addExp, isPending: adding } = useAddExperience()
  const { mutate: deleteExp } = useDeleteExperience()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: "", company: "", location: "", start_date: "", end_date: "",
    current: false, bullets: "", skills_used: "",
  })

  const handleAdd = () => {
    addExp(
      {
        title: form.title,
        company: form.company,
        location: form.location || undefined,
        start_date: form.start_date,
        end_date: form.current ? undefined : (form.end_date || undefined),
        current: form.current,
        bullets: form.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
        skills_used: form.skills_used.split(",").map((s) => s.trim()).filter(Boolean),
      },
      { onSuccess: () => setShowForm(false) }
    )
  }

  const experiences = profile?.experiences ?? []

  return (
    <div className="space-y-4">
      {experiences.length === 0 && !showForm ? (
        <EmptyState
          icon={Briefcase}
          title="No experience yet"
          description="Add your work history to improve tailoring accuracy"
          actionLabel="Add Experience"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <>
          {experiences.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{exp.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {exp.company} {exp.location ? `· ${exp.location}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {exp.startDate} – {exp.current ? "Present" : (exp.endDate ?? "—")}
                    </p>
                    {exp.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {exp.bullets.slice(0, 3).map((b, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="shrink-0 mt-1">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                        {exp.bullets.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{exp.bullets.length - 3} more bullets
                          </li>
                        )}
                      </ul>
                    )}
                    {exp.skillsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {exp.skillsUsed.slice(0, 5).map((s) => (
                          <Badge key={s} variant="secondary">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteExp(exp.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!showForm && (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Add Experience
            </Button>
          )}
        </>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Add Experience</p>
              <button onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Job Title *</label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Software Engineer" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Company *</label>
                <Input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="San Francisco, CA" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Start Date *</label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                </div>
                {!form.current && (
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
                  </div>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.current} onChange={(e) => setForm((p) => ({ ...p, current: e.target.checked }))} />
              I currently work here
            </label>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Bullets (one per line)
              </label>
              <Textarea
                value={form.bullets}
                onChange={(e) => setForm((p) => ({ ...p, bullets: e.target.value }))}
                placeholder="• Built scalable microservices handling 1M+ requests/day&#10;• Led team of 5 engineers to deliver feature on time"
                className="min-h-[100px] text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Skills Used (comma-separated)
              </label>
              <Input
                value={form.skills_used}
                onChange={(e) => setForm((p) => ({ ...p, skills_used: e.target.value }))}
                placeholder="Python, React, PostgreSQL, AWS"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                loading={adding}
                disabled={!form.title || !form.company || !form.start_date}
                onClick={handleAdd}
              >
                Save Experience
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Education Tab ─────────────────────────────────────────────────────────

function EducationTab() {
  const { data: profile } = useProfile()
  const { mutate: addEdu, isPending: adding } = useAddEducation()
  const { mutate: deleteEdu } = useDeleteEducation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    degree: "", field: "", school: "", start_date: "", end_date: "", gpa: "",
  })

  const handleAdd = () => {
    addEdu(
      {
        degree: form.degree,
        field: form.field,
        school: form.school,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        gpa: form.gpa || undefined,
      },
      { onSuccess: () => setShowForm(false) }
    )
  }

  const educations = profile?.educations ?? []

  return (
    <div className="space-y-4">
      {educations.length === 0 && !showForm ? (
        <EmptyState
          icon={GraduationCap}
          title="No education yet"
          description="Add your degrees and certifications"
          actionLabel="Add Education"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <>
          {educations.map((edu) => (
            <Card key={edu.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{edu.degree} in {edu.field}</p>
                    <p className="text-sm text-muted-foreground">{edu.school}</p>
                    {(edu.startDate || edu.endDate) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {edu.startDate} – {edu.endDate ?? "—"}
                      </p>
                    )}
                    {edu.gpa && (
                      <p className="text-xs text-muted-foreground">GPA: {edu.gpa}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteEdu(edu.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!showForm && (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Add Education
            </Button>
          )}
        </>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Add Education</p>
              <button onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Degree *</label>
                <Input value={form.degree} onChange={(e) => setForm((p) => ({ ...p, degree: e.target.value }))} placeholder="Bachelor of Science" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Field *</label>
                <Input value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))} placeholder="Computer Science" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">School *</label>
                <Input value={form.school} onChange={(e) => setForm((p) => ({ ...p, school: e.target.value }))} placeholder="University of California, Berkeley" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GPA (optional)</label>
                <Input value={form.gpa} onChange={(e) => setForm((p) => ({ ...p, gpa: e.target.value }))} placeholder="3.8" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                loading={adding}
                disabled={!form.degree || !form.field || !form.school}
                onClick={handleAdd}
              >
                Save Education
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Skills Tab ────────────────────────────────────────────────────────────

function SkillsTab() {
  const { data: profile } = useProfile()
  const { mutate: addSkill, isPending: adding } = useAddSkill()
  const { mutate: deleteSkill } = useDeleteSkill()
  const [input, setInput] = useState("")
  const [category, setCategory] = useState("")

  const handleAdd = () => {
    const name = input.trim()
    if (!name) return
    addSkill(
      { name, category: category.trim() || undefined },
      { onSuccess: () => { setInput(""); setCategory("") } }
    )
  }

  const skills = profile?.skills ?? []

  const grouped = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.category || "Other"
    acc[cat] = acc[cat] ? [...acc[cat], s] : [s]
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Add skill inline form */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add skill (e.g. TypeScript)"
          className="flex-1"
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional)"
          className="w-40"
        />
        <Button loading={adding} disabled={!input.trim()} onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {skills.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No skills yet"
          description="Add your technical and professional skills to improve ATS matching"
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catSkills]) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {catSkills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-sm"
                  >
                    <span>{s.name}</span>
                    <button
                      onClick={() => deleteSkill(s.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Application Info Tab ──────────────────────────────────────────────────

// ── Work Authorization Type → deterministic mapping ──
const WORK_AUTH_TYPES = [
  { value: "", label: "Select your authorization type..." },
  { value: "us_citizen", label: "U.S. Citizen" },
  { value: "green_card", label: "U.S. Permanent Resident (Green Card)" },
  { value: "opt", label: "OPT (Optional Practical Training)" },
  { value: "stem_opt", label: "STEM OPT Extension" },
  { value: "h1b", label: "H-1B Visa" },
  { value: "o1", label: "O-1 Visa" },
  { value: "other_visa", label: "Other Work Visa" },
  { value: "not_authorized", label: "Not Authorized to Work in U.S." },
]

function getAuthAnswers(authType: string) {
  // Deterministic Tier 1 mapping — NO AI needed
  const map: Record<string, { authorized: string; sponsorship: string; visaStatus: string }> = {
    us_citizen:     { authorized: "Yes", sponsorship: "No",  visaStatus: "U.S. Citizen" },
    green_card:     { authorized: "Yes", sponsorship: "No",  visaStatus: "U.S. Permanent Resident" },
    opt:            { authorized: "Yes", sponsorship: "Yes", visaStatus: "OPT" },
    stem_opt:       { authorized: "Yes", sponsorship: "Yes", visaStatus: "STEM OPT" },
    h1b:            { authorized: "Yes", sponsorship: "Yes", visaStatus: "H-1B" },
    o1:             { authorized: "Yes", sponsorship: "Yes", visaStatus: "O-1" },
    other_visa:     { authorized: "Yes", sponsorship: "Yes", visaStatus: "Other Visa" },
    not_authorized: { authorized: "No",  sponsorship: "",    visaStatus: "" },  // Sponsorship ambiguous — review on application
  }
  return map[authType] || { authorized: "", sponsorship: "", visaStatus: "" }
}

function ApplicationInfoTab() {
  const [form, setForm] = useState({
    workAuthType: "",
    workAuthorization: "",
    sponsorship: "",
    earliestStart: "",
    gender: "",
    pronouns: "",
    veteranStatus: "",
    disabilityStatus: "",
    hispanicLatino: "",
    race: "",
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch("/preferences")
      .then((prefs: any) => {
        if (prefs?.applicationInfo) {
          const ai = prefs.applicationInfo
          setForm((prev) => ({
            workAuthType: ai.workAuthType || prev.workAuthType,
            workAuthorization: ai.workAuthorization || prev.workAuthorization,
            sponsorship: ai.sponsorship || prev.sponsorship,
            earliestStart: ai.earliestStart || prev.earliestStart,
            gender: ai.gender || prev.gender,
            pronouns: ai.pronouns || prev.pronouns,
            veteranStatus: ai.veteranStatus || prev.veteranStatus,
            disabilityStatus: ai.disabilityStatus || prev.disabilityStatus,
            hispanicLatino: ai.hispanicLatino || prev.hispanicLatino,
            race: ai.race || prev.race,
          }))
        }
      })
      .catch(() => {})
  }, [])

  // When work auth type changes, auto-set authorization + sponsorship
  const handleAuthTypeChange = (authType: string) => {
    const answers = getAuthAnswers(authType)
    setForm((prev) => ({
      ...prev,
      workAuthType: authType,
      workAuthorization: answers.authorized,
      sponsorship: answers.sponsorship,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch("/preferences", { method: "PUT", body: JSON.stringify(form) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  const authAnswers = getAuthAnswers(form.workAuthType)

  return (
    <div className="space-y-6">
      {/* Work Authorization Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">U.S. Work Authorization</h3>
        <p className="text-xs text-muted-foreground">
          Select your authorization type — we'll automatically answer work authorization and sponsorship questions on applications.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Work Authorization Type</label>
          <select
            value={form.workAuthType}
            onChange={(e) => handleAuthTypeChange(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {WORK_AUTH_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {form.workAuthType && (
          <div className="bg-indigo-50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-indigo-700">Auto-fill preview:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Authorized to work in U.S.?</span>
                <span className={`ml-2 font-bold ${authAnswers.authorized === "Yes" ? "text-emerald-600" : "text-red-600"}`}>
                  {authAnswers.authorized}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Require sponsorship?</span>
                <span className={`ml-2 font-bold ${authAnswers.sponsorship === "No" ? "text-emerald-600" : "text-amber-600"}`}>
                  {authAnswers.sponsorship}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-indigo-500">These answers will fill automatically on every application — no AI guessing.</p>
          </div>
        )}
      </div>

      {/* Application Preferences */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Application Preferences</h3>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Earliest start date</label>
          <select value={form.earliestStart} onChange={(e) => setForm((p) => ({ ...p, earliestStart: e.target.value }))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Not set</option>
            <option value="Immediately">Immediately</option>
            <option value="1 week from offer">1 week from offer</option>
            <option value="2 weeks from offer">2 weeks from offer</option>
            <option value="1 month from offer">1 month from offer</option>
            <option value="Flexible">Flexible</option>
          </select>
        </div>
      </div>

      {/* EEO / Self-Identification (optional) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Voluntary Self-Identification</h3>
        <p className="text-xs text-muted-foreground">
          These are optional. If set, the extension will fill EEO sections. If left blank, those fields will be marked for manual review.
        </p>
        {[
          { key: "gender", label: "Gender", options: ["", "Male", "Female", "Non-binary", "Prefer not to say"] },
          { key: "pronouns", label: "Pronouns", options: ["", "He/him/his", "She/her/hers", "They/them/theirs", "Prefer not to say"] },
          { key: "hispanicLatino", label: "Are you Hispanic/Latino?", options: ["", "Yes", "No", "Prefer not to say"] },
          { key: "race", label: "Race / Ethnicity", options: ["", "American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races", "Prefer not to say"] },
          { key: "veteranStatus", label: "Veteran Status", options: ["", "I am not a protected veteran", "I identify as one or more of the classifications of protected veteran", "I don't wish to answer"] },
          { key: "disabilityStatus", label: "Disability Status", options: ["", "Yes, I have a disability", "No, I do not have a disability", "I do not want to answer"] },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
            <select value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {f.options.map((opt) => (
                <option key={opt} value={opt}>{opt || "Not set (manual review on applications)"}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <Button loading={saving} onClick={handleSave} className="w-full sm:w-auto">
        <Save className="w-4 h-4" />
        {saved ? "Saved ✓" : "Save Application Info"}
      </Button>
      {saved && (
        <p className="text-xs text-emerald-600 font-medium">✓ Saved — the extension will use these answers for autofill.</p>
      )}
    </div>
  )
}
