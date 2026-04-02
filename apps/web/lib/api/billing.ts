import { apiFetch } from "./client"

export const billingApi = {
  async getUsage() {
    try {
      return await apiFetch("/usage")
    } catch {
      return null
    }
  },

  async getSubscription() {
    try {
      return await apiFetch("/billing/subscription")
    } catch {
      return null
    }
  },

  async createCheckout() {
    return apiFetch("/billing/checkout", { method: "POST" })
  },

  async openPortal() {
    return apiFetch("/billing/portal", { method: "POST" })
  },
}
