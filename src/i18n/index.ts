import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Language } from '@/domain/types'
import { en } from './locales/en'
import { vi } from './locales/vi'

export const LANGUAGES: Language[] = ['vi', 'en']

export function detectLanguage(navigatorLanguage: string | undefined): Language {
  return navigatorLanguage?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

export function isLanguage(value: string | undefined): value is Language {
  return value === 'vi' || value === 'en'
}

export async function initI18n(language: Language) {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, vi: { translation: vi } },
    lng: language,
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  })
  document.documentElement.lang = language
  return i18n
}

export async function changeLanguage(language: Language) {
  await i18n.changeLanguage(language)
  document.documentElement.lang = language
}

export { i18n }
