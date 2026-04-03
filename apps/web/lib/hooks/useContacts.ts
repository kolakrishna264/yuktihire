import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { contactsApi } from "@/lib/api/contacts"
import { toast } from "sonner"
import type { Contact } from "@/types"

export function useContacts() {
  return useQuery<Contact[]>({ queryKey: ["contacts"], queryFn: async () => { const d = await contactsApi.list(); return Array.isArray(d) ? d : [] } })
}

export function useApplicationContacts(appId: string) {
  return useQuery<Contact[]>({ queryKey: ["contacts", appId], queryFn: async () => { const d = await contactsApi.forApplication(appId); return Array.isArray(d) ? d : [] }, enabled: !!appId })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { application_id?: string; name: string; role?: string; email?: string; phone?: string; linkedin_url?: string; company?: string; notes?: string }) => contactsApi.create(data),
    onSuccess: () => { toast.success("Contact added"); qc.invalidateQueries({ queryKey: ["contacts"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to add contact"),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => contactsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => { toast.success("Contact removed"); qc.invalidateQueries({ queryKey: ["contacts"] }) },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  })
}
