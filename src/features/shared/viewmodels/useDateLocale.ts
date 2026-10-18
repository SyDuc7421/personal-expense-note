import { enUS, vi } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'

export function useDateLocale() {
  const { i18n } = useTranslation()
  return i18n.language === 'en' ? enUS : vi
}
