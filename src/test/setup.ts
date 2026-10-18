import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { initI18n } from '@/i18n'

// api/ tests run in the node environment, where i18n (and the DOM) is not needed.
if (typeof document !== 'undefined') await initI18n('vi')
