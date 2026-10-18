import { useTranslation } from 'react-i18next'
import type { QuickInputPreview } from '../viewmodels/useQuickInputViewModel'

/** "Chi 600.000 ₫ · Ăn uống · Nam, Huy, Linh nợ 150.000 ₫ mỗi người · phần bạn 150.000 ₫" */
export function ParsePreview({ preview }: { preview: QuickInputPreview }) {
  const { t } = useTranslation()
  const parts = [
    `${t(`preview.${preview.type}`)} ${preview.amountLabel}`,
    `${preview.categoryIcon} ${t(`categories.${preview.categoryId}`)}`,
    preview.dateLabel,
  ]
  if (preview.eachLabel) {
    const names = preview.debtorNames.join(', ')
    parts.push(
      t(preview.debtorNames.length > 1 ? 'preview.owesEach' : 'preview.owes', { names, amount: preview.eachLabel }),
      t('preview.myShare', { amount: preview.myShareLabel }),
    )
  }
  return (
    <div className="flex flex-col gap-1 text-sm" aria-live="polite" data-testid="parse-preview">
      <p className="tabular-nums">{parts.join(' · ')}</p>
      {preview.newFriendNames.length > 0 && (
        <p className="text-amber-700 dark:text-amber-400">
          {t('preview.createFriends', { names: preview.newFriendNames.map((n) => `“${n}”`).join(', ') })}
        </p>
      )}
    </div>
  )
}
