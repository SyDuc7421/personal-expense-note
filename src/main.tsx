import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { createDb } from '@/data/db'
import { createDexieRepositories } from '@/data/repositories/dexie'
import { startSyncTriggers } from '@/data/sync/triggers'
import { detectLanguage, initI18n, isLanguage } from '@/i18n'
import './index.css'

async function start() {
  // Best-effort: ask the browser not to evict IndexedDB under storage pressure.
  void navigator.storage?.persist?.()

  const repositories = createDexieRepositories(createDb())
  const saved = await repositories.meta.get('language').catch(() => undefined)
  await initI18n(isLanguage(saved) ? saved : detectLanguage(navigator.language))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App repositories={repositories} />
    </StrictMode>,
  )
  startSyncTriggers(repositories.sync)
}

void start()
