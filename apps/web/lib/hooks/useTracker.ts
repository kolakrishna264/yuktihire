import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { trackerApi } from "@/lib/api/tracker"
import { toast } from "sonner"
import type { TrackedJob, KanbanData, ApplicationEvent, PipelineStage } from "@/types"

export function useTrackerList(stage?: string) {
  return useQuery<TrackedJob[]>({
    queryKey: ["tracker", stage],
    queryFn: async () => {
      const data = await trackerApi.list(stage)
      return Array.isArray(data) ? data : []
    },
  })
}

export function useTrackerKanban() {
  return useQuery<KanbanData>({
    queryKey: ["tracker-kanban"],
    queryFn: () => trackerApi.getKanban(),
  })
}

export function useTrackerDetail(id: string) {
  return useQuery<TrackedJob & { events: ApplicationEvent[] }>({
    queryKey: ["tracker-detail", id],
    queryFn: () => trackerApi.get(id),
    enabled: !!id,
  })
}

export function useAddToTracker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      job_id?: string
      title: string
      company: string
      url?: string
      location?: string
      salary?: string
      work_type?: string
      experience_level?: string
      industry?: string
      skills?: string[]
      description?: string
      source?: string
      notes?: string
      pipeline_stage?: PipelineStage
    }) => trackerApi.add(data),
    onSuccess: () => {
      toast.success("Job saved to tracker")
      queryClient.invalidateQueries({ queryKey: ["tracker"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-kanban"] })
    },
    onError: (err: Error) => {
      if (err.message?.includes("409") || err.message?.includes("already")) {
        toast.info("Job already tracked")
      } else {
        toast.error(err.message || "Failed to save job")
      }
    },
  })
}

export function useUpdateTracker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trackerApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["tracker"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-kanban"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-detail", id] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  })
}

export function useChangeStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: PipelineStage }) =>
      trackerApi.changeStage(id, stage),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["tracker"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-kanban"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-detail", id] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to change stage"),
  })
}

export function useDeleteTracked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => trackerApi.remove(id),
    onSuccess: () => {
      toast.success("Removed from tracker")
      queryClient.invalidateQueries({ queryKey: ["tracker"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-kanban"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove"),
  })
}

export function useArchiveTracked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => trackerApi.archive(id),
    onSuccess: () => {
      toast.success("Job archived")
      queryClient.invalidateQueries({ queryKey: ["tracker"] })
      queryClient.invalidateQueries({ queryKey: ["tracker-kanban"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to archive"),
  })
}

export function useTrackerEvents(trackerId: string) {
  return useQuery<ApplicationEvent[]>({
    queryKey: ["tracker-events", trackerId],
    queryFn: async () => {
      const data = await trackerApi.listEvents(trackerId)
      return Array.isArray(data) ? data : []
    },
    enabled: !!trackerId,
  })
}

export function useAddEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ trackerId, data }: { trackerId: string; data: any }) =>
      trackerApi.addEvent(trackerId, data),
    onSuccess: (_, { trackerId }) => {
      toast.success("Event added")
      queryClient.invalidateQueries({ queryKey: ["tracker-events", trackerId] })
      queryClient.invalidateQueries({ queryKey: ["tracker-detail", trackerId] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add event"),
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ trackerId, eventId }: { trackerId: string; eventId: string }) =>
      trackerApi.deleteEvent(trackerId, eventId),
    onSuccess: (_, { trackerId }) => {
      queryClient.invalidateQueries({ queryKey: ["tracker-events", trackerId] })
      queryClient.invalidateQueries({ queryKey: ["tracker-detail", trackerId] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete event"),
  })
}
