import { apiFetch } from "./client"

export const extensionApi = {
  async status() { return apiFetch("/extension/status") },
  async checkUrl(url: string) { return apiFetch(`/extension/check-url?url=${encodeURIComponent(url)}`) },
  async capture(data: { url: string; page_title?: string; extracted_title?: string; extracted_company?: string; extracted_description?: string; source_domain?: string }) {
    return apiFetch("/extension/capture", { method: "POST", body: JSON.stringify(data) })
  },
  async quickSave(data: any) { return apiFetch("/extension/quick-save", { method: "POST", body: JSON.stringify(data) }) },
}
