import { cn } from "@/lib/utils/cn"

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative flex shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-medium", className)}
      {...props}
    />
  )
}
