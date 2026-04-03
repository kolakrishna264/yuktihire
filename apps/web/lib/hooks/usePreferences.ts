import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { preferencesApi } from "@/lib/api/preferences"
import { toast } from "sonner"
import type { UserPreferences } from "@/types"

export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["preferences"],
    queryFn: () => preferencesApi.get(),
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<UserPreferences>) => preferencesApi.update(data),
    onSuccess: () => { toast.success("Preferences saved"); qc.invalidateQueries({ queryKey: ["preferences"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to save"),
  })
}
