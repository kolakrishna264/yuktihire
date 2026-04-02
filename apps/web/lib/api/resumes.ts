import { apiFetch } from "./client"

export const resumesApi = {
  async list() {
    return apiFetch("/resumes")
  },

  async get(id: string) {
    return apiFetch(`/resumes/${id}`)
  },

  async create(data?: any) {
    return apiFetch("/resumes", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    })
  },

  async update(id: string, data?: any) {
    return apiFetch(`/resumes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data ?? {}),
    })
  },

  async remove(id: string) {
    return apiFetch(`/resumes/${id}`, {
      method: "DELETE",
    })
  },

  async listVersions(id: string) {
    return apiFetch(`/resumes/${id}/versions`)
  },

  async createVersion(id: string, data?: any) {
    return apiFetch(`/resumes/${id}/versions`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    })
  },

  async restoreVersion(resumeId: string, versionId: string) {
    return apiFetch(`/resumes/${resumeId}/versions/${versionId}/restore`, {
      method: "POST",
    })
  },
}