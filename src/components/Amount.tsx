import { cn } from '@/lib/utils'

/** Money label that never wraps; the surrounding note is what should truncate. */
export function Amount({ label, tone, className }: { label: string; tone?: 'positive' | 'negative' | 'muted'; className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap tabular-nums',
        tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        tone === 'negative' && 'text-destructive',
        tone === 'muted' && 'text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
