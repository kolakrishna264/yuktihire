import { apiFetch } from "./client"

export const jobsApi = {
  async getAll() {
    const data = await apiFetch("/applications/")
    return Array.isArray(data) ? data : (data?.applications ?? data ?? [])
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

  async getSavedUrls(): Promise<{ urls: string[]; externalJobIds: string[] }> {
    const data = await apiFetch("/applications/saved-urls")
    return {
      urls: data?.urls ?? [],
      externalJobIds: data?.externalJobIds ?? [],
    }
  },

  async markApplied(id: string) {
    return apiFetch(`/applications/${id}/apply`, {
      method: "POST",
    })
  },
}
