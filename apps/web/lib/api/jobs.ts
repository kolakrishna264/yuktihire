import { apiFetch } from "./client"

export const jobsApi = {
  async getAll() {
    const data = await apiFetch("/applications/")
    return Array.isArray(data) ? data : []
  },

  async create(data: any) {
    return apiFetch("/applications/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: any) {
    return apiFetch(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async remove(id: string) {
    return apiFetch(`/applications/${id}`, {
      method: "DELETE",
    })
  },
}