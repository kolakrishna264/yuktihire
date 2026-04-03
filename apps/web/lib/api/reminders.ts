import { apiFetch } from "./client"

export const remindersApi = {
  async list() { return apiFetch("/reminders") },
  async upcoming() { return apiFetch("/reminders/upcoming") },
  async create(data: any) { return apiFetch("/reminders", { method: "POST", body: JSON.stringify(data) }) },
  async update(id: string, data: any) { return apiFetch(`/reminders/${id}`, { method: "PATCH", body: JSON.stringify(data) }) },
  async complete(id: string) { return apiFetch(`/reminders/${id}/complete`, { method: "POST" }) },
  async remove(id: string) { return apiFetch(`/reminders/${id}`, { method: "DELETE" }) },
}
