import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@/i18n'
import { resetSession } from './session'

beforeEach(() => {
  resetSession()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
