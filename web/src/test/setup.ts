import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@/i18n'
import { useSelectedEventStore } from '@/features/events/selected-event'
import { resetSession } from './session'

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
