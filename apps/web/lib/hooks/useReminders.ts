import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { remindersApi } from "@/lib/api/reminders"
import { apiFetch } from "@/lib/api/client"
import { toast } from "sonner"
import type { Reminder } from "@/types"

export function useReminders() {
  return useQuery<Reminder[]>({ queryKey: ["reminders"], queryFn: async () => { const d = await remindersApi.list(); return Array.isArray(d) ? d : [] } })
}

export function useUpcomingReminders() {
  return useQuery<Reminder[]>({ queryKey: ["reminders-upcoming"], queryFn: async () => { const d = await remindersApi.upcoming(); return Array.isArray(d) ? d : [] } })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { application_id?: string; title: string; description?: string; remind_at: string }) => remindersApi.create(data),
    onSuccess: () => { toast.success("Reminder set"); qc.invalidateQueries({ queryKey: ["reminders"] }); qc.invalidateQueries({ queryKey: ["reminders-upcoming"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to create reminder"),
  })
}

export function useCompleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => remindersApi.complete(id),
    onSuccess: () => { toast.success("Reminder completed"); qc.invalidateQueries({ queryKey: ["reminders"] }); qc.invalidateQueries({ queryKey: ["reminders-upcoming"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to complete"),
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); qc.invalidateQueries({ queryKey: ["reminders-upcoming"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  })
}

export function useOverdueReminders() {
  return useQuery<Reminder[]>({
    queryKey: ["reminders-overdue"],
    queryFn: async () => { const d = await remindersApi.list(); return (Array.isArray(d) ? d : []).filter((r: any) => r.isOverdue && !r.isCompleted) },
  })
}

export function useSnoozeReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hours }: { id: string; hours: number }) =>
      apiFetch(`/reminders/${id}/snooze?hours=${hours}`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Reminder snoozed")
      qc.invalidateQueries({ queryKey: ["reminders"] })
      qc.invalidateQueries({ queryKey: ["reminders-upcoming"] })
      qc.invalidateQueries({ queryKey: ["reminders-overdue"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to snooze"),
  })
}
