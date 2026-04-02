// ResumeAI — Shared TypeScript Types

// ── Auth ──────────────────────────────────────────────────────────────────
export type Plan = "FREE" | "PRO" | "PRO_ANNUAL" | "TEAM"

export interface AuthUser {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
  plan: Plan
  onboardingDone: boolean
}

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

export interface Skill {
  id: string
  name: string
  category?: string
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"
  sortOrder: number
}

export interface Project {
  id: string
  name: string
  description?: string
  url?: string
  bullets: string[]
  skills: string[]
}

export interface Profile {
  id: string
  headline?: string
  summary?: string
  phone?: string
  location?: string
  linkedin?: string
  github?: string
  portfolio?: string
  completeness: number
  workExperiences: WorkExperience[]
  educations: Education[]
  skills: Skill[]
  projects: Project[]
}

// ── Resume ────────────────────────────────────────────────────────────────
export type ResumeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED"

export interface Resume {
  id: string
  name: string
  status: ResumeStatus
  templateId: string
  isDefault: boolean
  content: ResumeContent
  createdAt: string
  updatedAt: string
}

export interface ResumeContent {
  name?: string
  contact?: {
    email?: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    portfolio?: string
    fullName?: string
  }
  summary?: string
  experiences?: WorkExperience[]
  educations?: Education[]
  skills?: string[] | Skill[]
  projects?: Project[]
}

export interface ResumeVersion {
  id: string
  label?: string
  createdAt: string
  sessionId?: string
}

// ── Tailoring ─────────────────────────────────────────────────────────────
export type SessionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"
export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "IGNORED"

export interface JDAnalysis {
  jobDescriptionId: string
  company?: string
  role?: string
  requiredSkills: string[]
  niceToHaveSkills: string[]
  mustHaveKeywords: string[]
  domainPhrases: string[]
  seniorityLevel: string
  yearsRequired?: number
  atsRisks: string[]
  confidence: number
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

export interface AtsScore {
  overallScore: number
  keywordScore: number
  skillsScore: number
  experienceScore: number
  educationScore: number
  formatScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  sectionScores: Record<string, number>
  tips: string[]
}

export interface TailoringSession {
  id: string
  status: SessionStatus
  matchScore?: number
  passesCompleted: number
  createdAt: string
  resumeId: string
}

export interface TailoringResult {
  session: TailoringSession
  recommendations: Recommendation[]
  atsScore: AtsScore | null
}

// ── Jobs ──────────────────────────────────────────────────────────────────
export type ApplicationStatus =
  | "SAVED" | "APPLIED" | "PHONE_SCREEN"
  | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN"

export interface JobApplication {
  id: string
  company: string
  role: string
  url?: string
  location?: string
  salary?: string
  status: ApplicationStatus
  appliedAt?: string
  notes?: string
  source?: string
  createdAt: string
  updatedAt: string
}

// ── Billing ───────────────────────────────────────────────────────────────
export interface UsageInfo {
  tailoring: { used: number; max: number }
  atsScans: { used: number; max: number }
  exports: { used: number; max: number }
  resumesMax: number
  periodEnd?: string
}

export interface SubscriptionInfo {
  plan: Plan
  status: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
}

// ── API Responses ─────────────────────────────────────────────────────────
export interface ApiError {
  detail: string | { message: string; upgradeRequired?: boolean }
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
}
