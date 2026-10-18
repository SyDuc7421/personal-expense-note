import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation as a bottom sheet (thumb zone) instead of a centered dialog. */
export function ConfirmDrawer({ open, title, description, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: Props) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onCancel()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
