import { apiFetch } from "./client"

export const jobBoardApi = {
  async list(params?: {
    search?: string
    work_type?: string
    sort?: string
    page?: number
    per_page?: number
  }) {
    const sp = new URLSearchParams()
    if (params?.search) sp.set("search", params.search)
    if (params?.work_type) sp.set("work_type", params.work_type)
    if (params?.sort) sp.set("sort", params.sort)
    if (params?.page) sp.set("page", String(params.page))
    if (params?.per_page) sp.set("per_page", String(params.per_page))
    const qs = sp.toString()
    return apiFetch(`/job-board${qs ? `?${qs}` : ""}`)
  },
}
