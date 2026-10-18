import type { SyncService } from '../repositories/types'
import { startSyncTriggers } from './triggers'

function setup() {
  const sync = { sync: vi.fn(async () => {}) } as unknown as SyncService & { sync: ReturnType<typeof vi.fn> }
  let emit: (pending: boolean) => void = () => {}
  const unsubscribe = vi.fn()
  const pending = (onChange: (pending: boolean) => void) => {
    emit = onChange
    return unsubscribe
  }
  const stop = startSyncTriggers(sync, { pending })
  return { sync, stop, unsubscribe, emit: (p: boolean) => emit(p) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('syncs once at start', () => {
  const { sync, stop } = setup()
  expect(sync.sync).toHaveBeenCalledTimes(1)
  stop()
})

test('syncs when the network comes back', () => {
  const { sync, stop } = setup()
  window.dispatchEvent(new Event('online'))
  expect(sync.sync).toHaveBeenCalledTimes(2)
  stop()
})

test('syncs when the app returns to the foreground', () => {
  const { sync, stop } = setup()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(sync.sync).toHaveBeenCalledTimes(2)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(sync.sync).toHaveBeenCalledTimes(2)
  stop()
})

test('syncs 5 s after the last local write', () => {
  const { sync, stop, emit } = setup()
  emit(true)
  vi.advanceTimersByTime(2000)
  emit(true)
  vi.advanceTimersByTime(4999)
  expect(sync.sync).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(1)
  expect(sync.sync).toHaveBeenCalledTimes(2)
  emit(false)
  vi.advanceTimersByTime(10000)
  expect(sync.sync).toHaveBeenCalledTimes(2)
  stop()
})

test('cleanup stops every trigger', () => {
  const { sync, stop, emit, unsubscribe } = setup()
  emit(true)
  stop()
  vi.advanceTimersByTime(10000)
  window.dispatchEvent(new Event('online'))
  expect(sync.sync).toHaveBeenCalledTimes(1)
  expect(unsubscribe).toHaveBeenCalled()
})
