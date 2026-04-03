import { apiFetch } from "./client"

export const jobBoardApi = {
  async list(params?: { search?: string; work_type?: string; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set("search", params.search)
    if (params?.work_type) searchParams.set("work_type", params.work_type)
    if (params?.limit) searchParams.set("limit", String(params.limit))
    const qs = searchParams.toString()
    const url = `/job-board${qs ? `?${qs}` : ""}`
    return apiFetch(url)
  },
}
