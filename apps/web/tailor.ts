import { api } from "./client"
import type { JDAnalysis, TailoringResult, RecommendationStatus } from "@/types"

export const tailorApi = {
  analyzeJD: (data: { text?: string; url?: string }) =>
    api.post<JDAnalysis>("/tailor/analyze-jd", data),

  run: (resumeId: string, jobDescriptionId: string) =>
    api.post<{ sessionId: string; status: string; estimatedSeconds: number }>("/tailor", {
      resume_id: resumeId,
      job_description_id: jobDescriptionId,
    }),

  getSession: (sessionId: string) =>
    api.get<TailoringResult>(`/tailor/${sessionId}`),

  updateRecommendation: (sessionId: string, recId: string, status: RecommendationStatus) =>
    api.patch(`/tailor/${sessionId}/recommendations/${recId}`, { status }),

  applyRecommendations: (sessionId: string, label?: string) =>
    api.post<{ versionId: string; resumeId: string; appliedCount: number }>(
      `/tailor/${sessionId}/apply`,
      { label }
    ),

  listSessions: () =>
    api.get<{ sessions: Array<{ id: string; status: string; matchScore: number; createdAt: string }> }>("/tailor"),
}
