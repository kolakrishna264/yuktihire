// ── Auth / User ───────────────────────────────────────────────────────────

export type ApplicationStatus = "SAVED" | "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED"

// ── Profile ───────────────────────────────────────────────────────────────

export interface WorkExperience {
  id: string
  title: string
  company: string
  location?: string
  startDate: string
  endDate?: string
  current: boolean
  bullets: string[]
  skillsUsed: string[]
  industry?: string
  sortOrder: number
}

export interface Education {
  id: string
  degree: string
  field: string
  school: string
  startDate?: string
  endDate?: string
  gpa?: string
  honors?: string
}

export interface SkillItem {
  id: string
  name: string
  category?: string
  level?: string
}

export interface ProfileData {
  id?: string
  fullName?: string
  email?: string
  headline?: string
  summary?: string
  phone?: string
  location?: string
  linkedinUrl?: string
  githubUrl?: string
  portfolioUrl?: string
  completeness: number
  experiences: WorkExperience[]
  educations: Education[]
  skills: SkillItem[]
}

// ── Resumes ───────────────────────────────────────────────────────────────

export interface ResumeItem {
  id: string
  name: string
  status: string
  templateId: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ResumeVersion {
  id: string
  label?: string
  createdAt: string
  sessionId?: string
}

// ── Tailoring ─────────────────────────────────────────────────────────────

export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "IGNORED"

export interface JDAnalysis {
  jobDescriptionId: string
  role: string
  company: string
  seniorityLevel: string
  requiredSkills: string[]
  preferredSkills: string[]
  mustHaveKeywords: string[]
  niceToHaveKeywords: string[]
  responsibilities: string[]
  risks: string[]
}

export interface AtsScore {
  overallScore: number
  keywordScore: number
  skillsScore: number
  experienceScore: number
  educationScore: number
  formatScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  tips: string[]
}

export interface Recommendation {
  id: string
  section: string
  field?: string
  original: string
  suggested: string
  reason: string
  confidence: number
  keywords: string[]
  status: RecommendationStatus
}

export type SessionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"

export interface TailoringSessionMeta {
  id: string
  status: SessionStatus
  matchScore: number | null
  resumeId: string
  passesCompleted: number
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export interface SessionData {
  session: TailoringSessionMeta
  recommendations: Recommendation[]
  atsScore: AtsScore | null
}

// ── Jobs ──────────────────────────────────────────────────────────────────

export interface JobApplication {
  id: string
  title: string
  company: string
  status: ApplicationStatus
  url?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ── Billing ───────────────────────────────────────────────────────────────

export interface UsageData {
  plan: string
  tailoring: { used: number; max: number }
  atsScans: { used: number; max: number }
  exports: { used: number; max: number }
  resumesMax: number
  periodEnd?: string
}
