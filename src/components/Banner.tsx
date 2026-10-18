import { Button } from '@/components/ui/button'

interface Props {
  message: string
  actionLabel?: string
  onAction?: () => void
  dismissLabel?: string
  onDismiss?: () => void
}

export function Banner({ message, actionLabel, onAction, dismissLabel, onDismiss }: Props) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="min-w-0 flex-1 py-2">{message}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {dismissLabel && onDismiss && (
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      )}
    </div>
  )
}
