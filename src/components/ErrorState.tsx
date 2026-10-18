import { Button } from '@/components/ui/button'

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && retryLabel && (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
