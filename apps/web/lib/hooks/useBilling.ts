import { useQuery } from "@tanstack/react-query"
import { billingApi } from "@/lib/api/billing"

export function useUsage() {
  return useQuery({
    queryKey: ["usage"],
    queryFn: () => billingApi.getUsage(),
  })
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => billingApi.getSubscription(),
  })
}
