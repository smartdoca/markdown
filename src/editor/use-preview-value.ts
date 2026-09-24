import { useLayoutEffect, useRef, useState } from 'react'

function automaticDelay(source: string): number {
  if (source.length >= 10_000) return 150
  let lines = 1
  for (let n = 0; n < source.length; n++) if (source[n] === '\n' && ++lines >= 500) return 150
  return 0
}

/** Only defer the expensive read-only projection. Never delay a Yjs transaction or source read. */
export function usePreviewValue(source: string, enabled: boolean, configuredDelay?: number): string {
  const delay = configuredDelay === undefined ? automaticDelay(source)
    : Number.isFinite(configuredDelay) ? Math.min(2000, Math.max(0, configuredDelay)) : automaticDelay(source)
  const [snapshot, setSnapshot] = useState(source)
  const wasEnabled = useRef(enabled)
  useLayoutEffect(() => {
    const opening = enabled && !wasEnabled.current
    wasEnabled.current = enabled
    if (!enabled) return
    if (opening || delay === 0) { setSnapshot(source); return }
    const timer = window.setTimeout(() => setSnapshot(source), delay)
    return () => window.clearTimeout(timer)
  }, [source, enabled, delay])
  return delay === 0 ? source : snapshot
}
