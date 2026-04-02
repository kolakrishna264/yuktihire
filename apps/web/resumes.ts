import { api } from "./client"
import type { Resume, ResumeContent, ResumeStatus, ResumeVersion } from "@/types"

export const resumesApi = {
  list: () => api.get<{ resumes: Resume[] }>("/resumes"),

  get: (id: string) => api.get<Resume>(`/resumes/${id}`),

  create: (data: { name: string; content?: ResumeContent; templateId?: string }) =>
    api.post<Resume>("/resumes", data),

  update: (id: string, data: { name?: string; content?: ResumeContent; status?: ResumeStatus }) =>
    api.patch<{ id: string; updatedAt: string }>(`/resumes/${id}`, data),

  delete: (id: string) => api.delete(`/resumes/${id}`),

  listVersions: (id: string) =>
    api.get<{ versions: ResumeVersion[] }>(`/resumes/${id}/versions`),

  createVersion: (id: string, label?: string, sessionId?: string) =>
    api.post<ResumeVersion>(`/resumes/${id}/versions`, { label, sessionId }),

  restoreVersion: (resumeId: string, versionId: string) =>
    api.post(`/resumes/${resumeId}/versions/${versionId}/restore`),
}
