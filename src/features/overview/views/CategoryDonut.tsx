import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Amount } from '@/components/Amount'
import type { DonutSlice } from '../viewmodels/useOverviewViewModel'

/** Spending by category this month (myShare). The legend doubles as the table view. */
export function CategoryDonut({ slices }: { slices: DonutSlice[] }) {
  const { t } = useTranslation()
  const label = (s: DonutSlice) => `${s.icon} ${t(`categories.${s.category}`)}`

  return (
    <section className="px-4">
      <h2 className="pb-2 text-sm font-semibold text-muted-foreground uppercase">{t('overview.byCategory')}</h2>
      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('overview.noSpendThisMonth')}</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="size-36 shrink-0" role="img" aria-label={t('overview.byCategory')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="category"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="var(--background)"
                  strokeWidth={2}
                  isAnimationActive={!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
                >
                  {slices.map((s) => (
                    <Cell key={s.category} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const s = item.payload as DonutSlice
                    return [s.valueLabel, label(s)]
                  }}
                  contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            {slices.map((s) => (
              <li key={s.category} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{label(s)}</span>
                <Amount label={s.valueLabel} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
