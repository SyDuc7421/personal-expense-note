import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FriendDetailViewModel } from '../viewmodels/useFriendDetailViewModel'

export function SettleDrawer({ vm }: { vm: FriendDetailViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  return (
    <Drawer open={state.settle.open} onOpenChange={(o) => !o && actions.closeSettle()}>
      <DrawerContent>
        <form
          className="mx-auto w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
            void actions.confirmSettle()
          }}
        >
          <DrawerHeader>
            <DrawerTitle>{t('debts.settleTitle', { name: state.name })}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('debts.settleTitle', { name: state.name })}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-1.5 px-4">
            <Label htmlFor="settle-amount">{t('debts.settleAmount')}</Label>
            <Input
              id="settle-amount"
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              value={state.settle.amount}
              aria-invalid={Boolean(state.settle.error)}
              onChange={(e) => actions.setSettleAmount(e.target.value)}
            />
            {state.settle.error && <p className="text-sm text-destructive">{t(state.settle.error)}</p>}
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={state.settle.isSaving}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={actions.closeSettle}>
              {t('common.cancel')}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
