import { Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDrawer } from '@/components/ConfirmDrawer'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SheetSelect } from '@/components/ui/sheet-select'
import type { CategoryId } from '@/domain/types'
import { formatAmountInput } from '@/lib/amountInput'
import { cn } from '@/lib/utils'
import { useTransactionFormViewModel } from '../viewmodels/useTransactionFormViewModel'

function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation()
  return message ? <p className="text-sm text-destructive">{t(message)}</p> : null
}

/** Full manual form (no parser). Mounted only while open. */
export function TransactionFormDrawer({ id, onClose }: { id?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { state, actions } = useTransactionFormViewModel({ id, onDone: onClose })
  const { values, errors } = state

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-md min-h-0 flex-col">
          <DrawerHeader>
            <DrawerTitle>{t(state.isEdit ? 'form.editTitle' : 'form.newTitle')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('form.newTitle')}</DrawerDescription>
          </DrawerHeader>
          {state.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <form
              className="flex min-h-0 flex-col"
              onSubmit={(e) => {
                e.preventDefault()
                void actions.save()
              }}
            >
              <div className="flex flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('form.type')}>
                  {(['expense', 'income'] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={values.type === type}
                      variant={values.type === type ? 'default' : 'outline'}
                      onClick={() => actions.setField('type', type)}
                    >
                      {t(`types.${type}`)}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-amount">{t('form.amount')}</Label>
                  <Input
                    id="tx-amount"
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.amount}
                    aria-invalid={Boolean(errors.amount)}
                    onChange={(e) => actions.setField('amount', formatAmountInput(e.target.value))}
                    className="tabular-nums"
                  />
                  <FieldError message={errors.amount} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-note">{t('form.note')}</Label>
                  <Input id="tx-note" value={values.note} onChange={(e) => actions.setField('note', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="tx-category">{t('form.category')}</Label>
                    <SheetSelect
                      id="tx-category"
                      label={t('form.category')}
                      value={values.category}
                      onValueChange={(v) => actions.setField('category', v as CategoryId)}
                      options={state.categories.map((c) => ({ value: c.id, label: t(`categories.${c.id}`), icon: c.icon }))}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor="tx-date">{t('form.date')}</Label>
                    <Input
                      id="tx-date"
                      type="date"
                      className="w-full min-w-0"
                      value={values.date}
                      onChange={(e) => e.target.value && actions.setField('date', e.target.value)}
                    />
                  </div>
                </div>

                {values.type === 'expense' && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium">{t('form.splits')}</legend>
                    {values.splits.map((split, index) => (
                      <div key={split.key} className="grid grid-cols-2 gap-2">
                        <SheetSelect
                          label={t('form.chooseFriend')}
                          className="min-w-0"
                          value={split.friendId}
                          onValueChange={(v) => actions.setSplit(index, { friendId: v })}
                          options={state.friends.map((f) => ({ value: f.id, label: f.name }))}
                        />
                        {/* Amount + remove share the second column so it lines up with Date above. */}
                        <div className="flex min-w-0 items-center gap-1">
                          <Input
                            aria-label={t('form.amount')}
                            inputMode="numeric"
                            className="min-w-0 flex-1 tabular-nums"
                            value={split.amount}
                            onChange={(e) => actions.setSplit(index, { amount: formatAmountInput(e.target.value) })}
                          />
                          <Button type="button" variant="ghost" size="icon" aria-label={t('form.removeSplit')} onClick={() => actions.removeSplit(index)}>
                            <X />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" onClick={actions.addSplit} disabled={state.friends.length === 0}>
                        {t('form.addSplit')}
                      </Button>
                      <Button type="button" variant="outline" onClick={actions.splitEvenly} disabled={values.splits.length === 0}>
                        {t('form.splitEvenly')}
                      </Button>
                    </div>
                    <FieldError message={errors.splits} />
                    <p className="text-sm text-muted-foreground tabular-nums">{t('form.myShare', { amount: state.myShareLabel })}</p>
                  </fieldset>
                )}
                <FieldError message={errors.form} />
              </div>

              <div className={cn('flex gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]')}>
                {state.isEdit && (
                  <Button type="button" variant="destructive" size="icon" aria-label={t('common.delete')} onClick={actions.askDelete}>
                    <Trash2 />
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={state.isSaving}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DrawerContent>
      <ConfirmDrawer
        open={state.confirmingDelete}
        title={t('form.deleteConfirmTitle')}
        description={t('form.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void actions.confirmDelete()}
        onCancel={actions.cancelDelete}
      />
    </Drawer>
  )
}
