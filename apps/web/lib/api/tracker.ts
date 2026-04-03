import { apiFetch } from "./client"

export const trackerApi = {
  async list(stage?: string) {
    const qs = stage && stage !== "ALL" ? `?stage=${stage}` : ""
    return apiFetch(`/tracker${qs}`)
  },

  async getKanban() {
    return apiFetch("/tracker/kanban")
  },

  async get(id: string) {
    return apiFetch(`/tracker/${id}`)
  },

  async add(data: any) {
    return apiFetch("/tracker", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: any) {
    return apiFetch(`/tracker/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async changeStage(id: string, stage: string) {
    return apiFetch(`/tracker/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    })
  },

  async remove(id: string) {
    return apiFetch(`/tracker/${id}`, { method: "DELETE" })
  },

  async archive(id: string) {
    return apiFetch(`/tracker/${id}/archive`, { method: "POST" })
  },

  async listEvents(trackerId: string) {
    return apiFetch(`/tracker/${trackerId}/events`)
  },

  async addEvent(trackerId: string, data: any) {
    return apiFetch(`/tracker/${trackerId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async deleteEvent(trackerId: string, eventId: string) {
    return apiFetch(`/tracker/${trackerId}/events/${eventId}`, { method: "DELETE" })
  },

  async getResumeIntel(id: string) {
    return apiFetch(`/tracker/${id}/resume-intel`)
  },
}
