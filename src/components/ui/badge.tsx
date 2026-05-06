import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'outline'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300',
  success: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  error: 'bg-red-900/50 text-red-400 border border-red-800',
  outline: 'border border-zinc-700 text-zinc-400',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  )
}
