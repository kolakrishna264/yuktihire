import { api } from "./client"
import type { JobApplication, ApplicationStatus } from "@/types"

export const jobsApi = {
  list: (status?: ApplicationStatus) =>
    api.get<{ applications: JobApplication[]; total: number }>(
      `/applications${status ? `?status=${status}` : ""}`
    ),

  get: (id: string) => api.get<JobApplication>(`/applications/${id}`),

  create: (data: Partial<JobApplication>) =>
    api.post<JobApplication>("/applications", data),

  update: (id: string, data: Partial<JobApplication>) =>
    api.patch<JobApplication>(`/applications/${id}`, data),

  delete: (id: string) => api.delete(`/applications/${id}`),

  listSaved: () =>
    api.get<{ savedJobs: Array<{ id: string; url: string; title?: string; company?: string }> }>("/saved-jobs"),

  saveJob: (data: { url: string; title?: string; company?: string }) =>
    api.post("/saved-jobs", data),

  convertSaved: (id: string) =>
    api.post<{ applicationId: string }>(`/saved-jobs/${id}/convert`),
}
