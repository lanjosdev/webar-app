import {readFileSync} from 'node:fs'

import {describe, expect, it} from 'vitest'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const catalogHtml = readFileSync(new URL('../design-system.html', import.meta.url), 'utf8')
const tokensCss = readFileSync(
  new URL('../src/styles/design-system/tokens.css', import.meta.url),
  'utf8',
)
const componentsCss = readFileSync(
  new URL('../src/styles/design-system/components.css', import.meta.url),
  'utf8',
)
const globalCss = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')
const catalogCss = readFileSync(
  new URL('../src/styles/design-system/catalog.css', import.meta.url),
  'utf8',
)

const REQUIRED_APP_IDS = [
  'app',
  'camera-feed',
  'placement-reticle',
  'interaction-blocker',
  'motion-permission-blocker',
  'status-panel',
  'status-message',
  'error-details',
  'start-ar',
  'recenter-ar',
  'capture-controls',
  'capture-mode-photo',
  'capture-mode-video',
  'capture-shutter',
  'capture-timer',
  'capture-feedback',
  'capture-retry',
  'capture-flash',
  'capture-processing',
  'capture-processing-message',
  'capture-processing-progress',
  'capture-preview',
  'capture-preview-title',
  'capture-preview-status',
  'capture-preview-image',
  'capture-preview-video',
  'capture-retake',
  'capture-save',
  'capture-share',
  'recenter-confirmation',
  'cancel-recenter',
  'confirm-recenter',
  'motion-permission-sheet',
  'cancel-motion-permission',
  'confirm-motion-permission',
  'diagnostics-panel',
  'diagnostics-live',
  'diagnostics-device-model',
  'diagnostics-lighting',
  'diagnostics-connection',
  'diagnostics-heating',
  'diagnostics-stability',
  'diagnostics-copy',
  'diagnostics-download',
  'diagnostics-feedback',
]

const REQUIRED_TOKENS = [
  '--gray-0',
  '--gray-8',
  '--background',
  '--foreground',
  '--primary',
  '--muted-foreground',
  '--border',
  '--ring',
  '--hud',
  '--shadow-hud',
  '--gradient-scrim',
]

const REQUIRED_COMPONENTS = [
  '.ds-button',
  '.ds-icon-button',
  '.ds-pill',
  '.ds-panel',
  '.ds-sheet',
  '.ds-field',
]

describe('BIZSYS design system contract', () => {
  it('keeps every TypeScript DOM hook unique in the application document', () => {
    for (const id of REQUIRED_APP_IDS) {
      const occurrences = indexHtml.match(new RegExp(`id=["']${id}["']`, 'g')) ?? []
      expect(occurrences, `#${id}`).toHaveLength(1)
    }
  })

  it('exports the required semantic tokens and component primitives', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokensCss).toContain(`${token}:`)
    }

    for (const component of REQUIRED_COMPONENTS) {
      expect(componentsCss).toContain(component)
    }
  })

  it('shares the same foundation between the AR application and catalog', () => {
    expect(indexHtml).toContain('/src/styles/global.css')
    expect(catalogHtml).toContain('/src/styles/design-system/catalog.css')
    expect(globalCss).toContain("@import './design-system/index.css'")
    expect(catalogCss).toContain("@import './index.css'")
  })
})
