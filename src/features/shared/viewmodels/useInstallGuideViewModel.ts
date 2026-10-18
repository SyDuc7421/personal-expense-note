import { useLiveQuery } from 'dexie-react-hooks'
import { useRepositories } from '@/data/RepositoryProvider'

const DISMISSED_KEY = 'installGuideDismissed'

export function isIosSafariBrowser(nav: Navigator, standaloneMedia: boolean): boolean {
  const ua = nav.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && nav.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  const standalone = (nav as Navigator & { standalone?: boolean }).standalone === true || standaloneMedia
  return isIos && isSafari && !standalone
}

export interface InstallGuideViewModel {
  state: { visible: boolean }
  actions: { dismiss(): void }
}

/** Shows the "Add to Home Screen" hint in iOS Safari when not installed. */
export function useInstallGuideViewModel(): InstallGuideViewModel {
  const { meta } = useRepositories()
  const dismissed = useLiveQuery(() => meta.get(DISMISSED_KEY), [meta])
  const eligible = isIosSafariBrowser(navigator, window.matchMedia?.('(display-mode: standalone)').matches ?? false)
  return {
    state: { visible: eligible && dismissed === undefined },
    actions: { dismiss: () => void meta.set(DISMISSED_KEY, new Date().toISOString()) },
  }
}
