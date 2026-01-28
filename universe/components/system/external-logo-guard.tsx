'use client'

import { useEffect } from 'react'

const BLOCKED_HOST = 'cdn.aitopia.com'
const FALLBACK_LOGO_SRC = '/images/civilx-ai-logo.svg'

const isAitopiaLogo = (src: string | null) => {
  if (!src) return false
  try {
    const url = new URL(src, window.location.origin)
    return url.hostname === BLOCKED_HOST && url.pathname.includes('/ai_logo/')
  } catch {
    return false
  }
}

const replaceLogo = (img: HTMLImageElement) => {
  if (img.dataset.aitopiaReplaced === 'true') {
    return
  }
  if (isAitopiaLogo(img.getAttribute('src'))) {
    img.dataset.aitopiaReplaced = 'true'
    img.removeAttribute('srcset')
    img.src = FALLBACK_LOGO_SRC
  }
}

export function ExternalLogoGuard() {
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
          replaceLogo(mutation.target)
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            replaceLogo(node)
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll('img').forEach((img) => replaceLogo(img))
          }
        })
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['src'],
      childList: true,
      subtree: true,
    })

    document.querySelectorAll('img').forEach((img) => replaceLogo(img))

    return () => observer.disconnect()
  }, [])

  return null
}








