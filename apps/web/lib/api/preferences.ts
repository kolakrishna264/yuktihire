import { apiFetch } from "./client"

export const preferencesApi = {
  async get() { return apiFetch("/preferences") },
  async update(data: any) { return apiFetch("/preferences", { method: "PUT", body: JSON.stringify(data) }) },
}
