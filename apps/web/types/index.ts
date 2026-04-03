// ── Auth / User ───────────────────────────────────────────────────────────

export type ApplicationStatus = "SAVED" | "APPLIED" | "PHONE_SCREEN" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN"

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
  location?: string
  salary?: string
  notes?: string
  source?: string
  resumeUsed?: string
  appliedAt?: string
  workType?: string
  experienceLevel?: string
  industry?: string
  skills?: string[]
  description?: string
  externalJobId?: string
  postedAt?: string
  createdAt: string
  updatedAt: string
}

export interface JobBoardItem {
  id: string
  title: string
  company: string
  location: string
  postedDate: string
  workType: 'Remote' | 'Hybrid' | 'On-site'
  employmentType?: string
  experienceLevel: string
  salaryRange?: string
  industry?: string
  skills: string[]
  url?: string
  description?: string
  certifications?: string[]
  source: string
  companyLogo?: string
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

// ── Platform: Discover ───────────────────────────────────────────────────

export interface DiscoverJob {
  id: string
  title: string
  company: string
  location?: string
  url?: string
  descriptionText?: string
  salaryMin?: number
  salaryMax?: number
  salaryRaw?: string
  workType?: string
  employmentType?: string
  experienceLevel?: string
  industry?: string
  postedAt?: string
  isActive: boolean
  companyLogoUrl?: string
  skills: { name: string; canonical: string; isRequired: boolean }[]
  sources: { slug: string; name: string; externalId: string; sourceUrl?: string }[]
  createdAt?: string
}

export interface DiscoverResponse {
  jobs: DiscoverJob[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface JobSourceInfo {
  id: string
  slug: string
  name: string
  isActive: boolean
  lastSyncAt?: string
}

// ── Platform: Tracker ────────────────────────────────────────────────────

export type PipelineStage =
  | "INTERESTED"
  | "SHORTLISTED"
  | "RESUME_TAILORED"
  | "READY_TO_APPLY"
  | "APPLIED"
  | "PHONE_SCREEN"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED"

export interface TrackedJob {
  id: string
  jobId?: string
  title: string
  company: string
  url?: string
  location?: string
  salary?: string
  notes?: string
  source?: string
  workType?: string
  experienceLevel?: string
  industry?: string
  skills: string[]
  description?: string
  pipelineStage: PipelineStage
  priority: number
  resumeUsed?: string
  resumeVersionId?: string
  nextActionDate?: string
  archived: boolean
  appliedAt?: string
  createdAt: string
  updatedAt: string
}

export interface KanbanData {
  stages: Record<PipelineStage, { count: number; jobs: TrackedJob[] }>
}

export interface ApplicationEvent {
  id: string
  eventType: string
  oldValue?: string
  newValue?: string
  title?: string
  description?: string
  metadata: Record<string, unknown>
  eventDate?: string
  createdAt: string
}

// ── V2: Contacts ─────────────────────────────────────────────────────────

export interface Contact {
  id: string
  applicationId?: string
  name: string
  role?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  company?: string
  notes?: string
  createdAt: string
}

// ── V2: Reminders ────────────────────────────────────────────────────────

export interface Reminder {
  id: string
  applicationId?: string
  title: string
  description?: string
  remindAt: string
  isCompleted: boolean
  completedAt?: string
  createdAt: string
}

// ── V2: Preferences ──────────────────────────────────────────────────────

export interface UserPreferences {
  preferredTitles: string[]
  preferredLocations: string[]
  preferredWorkTypes: string[]
  preferredIndustries: string[]
  preferredSkills: string[]
  minSalary?: number
  maxSalary?: number
  experienceLevel?: string
  visaSponsorship?: boolean
}

// ── V2: Insights ─────────────────────────────────────────────────────────

export interface InsightsOverview {
  totalTracked: number
  totalApplied: number
  totalInterviewing: number
  totalOffers: number
  totalRejected: number
  responseRate: number
  interviewRate: number
  offerRate: number
  upcomingReminders: number
}

export interface PipelineCount {
  stage: string
  count: number
}

export interface ActivityWeek {
  week: string
  count: number
}

export interface SkillCount {
  skill: string
  count: number
}

export interface IndustryCount {
  industry: string
  count: number
}

export interface LocationData {
  topLocations: { location: string; count: number }[]
  remoteRatio: number
}
