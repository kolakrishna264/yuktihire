import { apiFetch } from "./client"

export const profileApi = {
  async getMe() {
    return apiFetch("/profiles/me")
  },

  async update(data: Record<string, unknown>) {
    return apiFetch("/profiles/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async addExperience(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/experiences", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateExperience(id: string, data: Record<string, unknown>) {
    return apiFetch(`/profiles/me/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async deleteExperience(id: string) {
    return apiFetch(`/profiles/me/experiences/${id}`, { method: "DELETE" })
  },

  async addEducation(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/educations", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async deleteEducation(id: string) {
    return apiFetch(`/profiles/me/educations/${id}`, { method: "DELETE" })
  },

  async addSkill(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/skills", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async deleteSkill(id: string) {
    return apiFetch(`/profiles/me/skills/${id}`, { method: "DELETE" })
  },
}
