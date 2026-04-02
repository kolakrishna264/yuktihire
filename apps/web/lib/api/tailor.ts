import { apiFetch } from "./client"

export const tailorApi = {
  async listSessions() {
    const data = await apiFetch("/tailor")
    return Array.isArray(data) ? data : []
  },

  async analyzeJobDescription(data: any) {
    return apiFetch("/tailor/analyze-jd", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async run(data: any) {
    return apiFetch("/tailor", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async getSession(id: string) {
    return apiFetch(`/tailor/${id}`)
  },

  async updateRecommendation(sessionId: string, recId: string, data: any) {
    return apiFetch(`/tailor/${sessionId}/recommendations/${recId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async applyRecommendations(sessionId: string, data: any) {
    return apiFetch(`/tailor/${sessionId}/apply`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
}