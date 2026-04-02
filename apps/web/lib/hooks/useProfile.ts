import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { profileApi } from "@/lib/api/profile"
import { toast } from "sonner"
import type { ProfileData } from "@/types"

export function useProfile() {
  return useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: () => profileApi.getMe() as Promise<ProfileData>,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => profileApi.update(data),
    onSuccess: () => {
      toast.success("Profile updated")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  })
}

export function useAddExperience() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      profileApi.addExperience(data),
    onSuccess: () => {
      toast.success("Experience added")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add"),
  })
}

export function useUpdateExperience() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Record<string, unknown>
    }) => profileApi.updateExperience(id, data),
    onSuccess: () => {
      toast.success("Experience saved")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  })
}

export function useDeleteExperience() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => profileApi.deleteExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}

export function useAddEducation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      profileApi.addEducation(data),
    onSuccess: () => {
      toast.success("Education added")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add"),
  })
}

export function useDeleteEducation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => profileApi.deleteEducation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}

export function useAddSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => profileApi.addSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add"),
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => profileApi.deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}
