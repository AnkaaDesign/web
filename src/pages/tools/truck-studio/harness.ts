// Entry for harness.html — kept as a real module file instead of an inline
// <script>: vite's inline-script proxy ("html-proxy") breaks when the app's
// service worker serves harness.html from cache, because the proxy module is
// only registered when vite itself transforms the HTML in the same session.
import './engine/core/studio.css'
import './engine/ui/selector.css'
import './engine/ui/loader.css'
import './engine/ui/hud.css'
import { mountStudio } from './engine/index.ts'

declare global {
  interface Window {
    __harnessReady: boolean
    __harnessError?: string
  }
}

window.__harnessReady = false
mountStudio(document.getElementById('host')!)
  .then(() => { window.__harnessReady = true })
  .catch((e: unknown) => {
    window.__harnessError = String((e as Error)?.message || e)
    console.error(e)
  })
