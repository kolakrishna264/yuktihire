import { apiFetch } from "./client"

export const insightsApi = {
  async overview() { return apiFetch("/insights/overview") },
  async pipeline() { return apiFetch("/insights/pipeline") },
  async activity() { return apiFetch("/insights/activity") },
  async skills() { return apiFetch("/insights/skills") },
  async industries() { return apiFetch("/insights/industries") },
  async locations() { return apiFetch("/insights/locations") },
}
