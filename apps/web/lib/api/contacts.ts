import { apiFetch } from "./client"

export const contactsApi = {
  async list() { return apiFetch("/contacts") },
  async forApplication(appId: string) { return apiFetch(`/contacts/for-application/${appId}`) },
  async create(data: any) { return apiFetch("/contacts", { method: "POST", body: JSON.stringify(data) }) },
  async update(id: string, data: any) { return apiFetch(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }) },
  async remove(id: string) { return apiFetch(`/contacts/${id}`, { method: "DELETE" }) },
}
