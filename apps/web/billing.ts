import { api } from "./client"
import type { SubscriptionInfo, UsageInfo } from "@/types"

export const billingApi = {
  getPlans: () =>
    api.get<{ plans: Array<{ id: string; name: string; price: number; interval: string; features: string[] }> }>(
      "/billing/plans"
    ),

  getSubscription: () =>
    api.get<{ subscription: SubscriptionInfo; usage: UsageInfo }>("/billing/subscription"),

  createCheckout: (plan: string) =>
    api.post<{ checkoutUrl: string }>("/billing/create-checkout", {
      plan,
      success_url: `${window.location.origin}/dashboard/settings/billing?success=1`,
      cancel_url: `${window.location.origin}/dashboard/settings/billing`,
    }),

  createPortal: () =>
    api.post<{ portalUrl: string }>("/billing/create-portal"),

  getUsage: () => api.get<UsageInfo>("/usage"),
}
