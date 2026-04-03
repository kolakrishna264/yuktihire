import { apiFetch } from "./client"

export const discoverApi = {
  async search(params?: {
    q?: string
    work_type?: string
    location?: string
    experience_level?: string
    industry?: string
    salary_min?: number
    source?: string
    sort?: string
    page?: number
    per_page?: number
  }) {
    const sp = new URLSearchParams()
    if (params?.q) sp.set("q", params.q)
    if (params?.work_type) sp.set("work_type", params.work_type)
    if (params?.location) sp.set("location", params.location)
    if (params?.experience_level) sp.set("experience_level", params.experience_level)
    if (params?.industry) sp.set("industry", params.industry)
    if (params?.salary_min) sp.set("salary_min", String(params.salary_min))
    if (params?.source) sp.set("source", params.source)
    if (params?.sort) sp.set("sort", params.sort)
    if (params?.page) sp.set("page", String(params.page))
    if (params?.per_page) sp.set("per_page", String(params.per_page))
    const qs = sp.toString()
    return apiFetch(`/discover${qs ? `?${qs}` : ""}`)
  },

  async getJob(id: string) {
    return apiFetch(`/discover/${id}`)
  },

  async getSources() {
    return apiFetch("/discover/sources")
  },

  async refreshSources() {
    return apiFetch("/discover/refresh", { method: "POST" })
  },
}
