import { useEffect, useState } from 'react'

/** True when the on-screen keyboard shrinks the visual viewport noticeably (iOS). */
export function useKeyboardOpen(threshold = 150): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setOpen(window.innerHeight - vv.height > threshold)
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [threshold])
  return open
}
