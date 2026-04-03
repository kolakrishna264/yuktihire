import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { extensionApi } from "@/lib/api/extension"
import { toast } from "sonner"
import type { ExtensionStatus, ExtensionCheckResult, ExtensionCaptureResult } from "@/types"

export function useExtensionStatus() {
  return useQuery<ExtensionStatus>({
    queryKey: ["extension-status"],
    queryFn: () => extensionApi.status(),
    retry: false,
  })
}

export function useCheckUrl(url: string) {
  return useQuery<ExtensionCheckResult>({
    queryKey: ["extension-check", url],
    queryFn: () => extensionApi.checkUrl(url),
    enabled: !!url,
  })
}

export function useCaptureJob() {
  const qc = useQueryClient()
  return useMutation<ExtensionCaptureResult, Error, any>({
    mutationFn: (data) => extensionApi.capture(data),
    onSuccess: (result) => {
      if (result.status === "saved") toast.success("Job captured and saved")
      else toast.info("Job already tracked")
      qc.invalidateQueries({ queryKey: ["tracker"] })
    },
    onError: (e) => toast.error(e.message || "Failed to capture"),
  })
}
