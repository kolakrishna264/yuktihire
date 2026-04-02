import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { tailorApi } from "@/lib/api/tailor"
import { toast } from "sonner"
import type { JDAnalysis, SessionData } from "@/types"

export function useTailor() {
  return useQuery({
    queryKey: ["tailor-sessions"],
    queryFn: async () => {
      const data = await tailorApi.listSessions()
      return Array.isArray(data) ? data : []
    },
  })
}

export function useAnalyzeJD() {
  return useMutation({
    mutationFn: (data: { text?: string; url?: string }) =>
      tailorApi.analyzeJobDescription(data) as Promise<JDAnalysis>,
    onError: (err: Error) =>
      toast.error(err.message || "Failed to analyze job description"),
  })
}

export function useRunTailoring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { resumeId: string; jobDescriptionId: string }) =>
      tailorApi.run({
        resume_id: data.resumeId,
        job_description_id: data.jobDescriptionId,
      }) as Promise<{ sessionId: string }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tailor-sessions"] })
    },
    onError: (err: Error) =>
      toast.error(err.message || "Failed to start tailoring"),
  })
}

export function useTailoringSession(sessionId: string | null) {
  const query = useQuery<SessionData>({
    queryKey: ["tailoring-session", sessionId],
    queryFn: () => tailorApi.getSession(sessionId!) as Promise<SessionData>,
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = (query.state.data as SessionData | undefined)?.session?.status
      return !query.state.data || status === "PENDING" || status === "RUNNING"
        ? 2000
        : false
    },
  })

  const status = query.data?.session?.status
  const isPolling =
    !!sessionId && (!status || status === "PENDING" || status === "RUNNING")

  return { ...query, isPolling }
}

export function useUpdateRecommendation(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recId,
      status,
    }: {
      recId: string
      status: string
    }) => tailorApi.updateRecommendation(sessionId, recId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tailoring-session", sessionId],
      })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  })
}

export function useApplyRecommendations(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label?: string) =>
      tailorApi.applyRecommendations(sessionId, { label }),
    onSuccess: () => {
      toast.success("Resume version saved!")
      queryClient.invalidateQueries({ queryKey: ["resumes"] })
      queryClient.invalidateQueries({ queryKey: ["tailor-sessions"] })
    },
    onError: (err: Error) =>
      toast.error(err.message || "Failed to save version"),
  })
}
