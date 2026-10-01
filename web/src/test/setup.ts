import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@/i18n'
import { useSelectedEventStore } from '@/features/events/selected-event'
import { resetSession } from './session'

// Pages are lazy-loaded; with every test file running in parallel on a slower machine the first
// render can take over a second, so findBy* waits up to 3 s instead of 1 s.
configure({ asyncUtilTimeout: 3000 })

// Animations finish instantly in tests, so exits don't keep elements around.
MotionGlobalConfig.skipAnimations = true

beforeEach(() => {
  resetSession()
  useSelectedEventStore.setState({ byUser: {} })
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
