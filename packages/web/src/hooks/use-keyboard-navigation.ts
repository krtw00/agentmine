'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHotkeys } from 'react-hotkeys-hook'

interface KeyboardNavigationOptions {
  enabled?: boolean
}

// Sequence state for "g" prefix shortcuts
let gPrefixTimeout: ReturnType<typeof setTimeout> | null = null
let gPrefixActive = false

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const { enabled = true } = options
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Reset g prefix state
  const resetGPrefix = useCallback(() => {
    gPrefixActive = false
    if (gPrefixTimeout) {
      clearTimeout(gPrefixTimeout)
      gPrefixTimeout = null
    }
  }, [])

  // Handle g prefix activation
  useHotkeys(
    'g',
    () => {
      if (!enabled) return
      gPrefixActive = true
      // Reset after 1 second
      gPrefixTimeout = setTimeout(resetGPrefix, 1000)
    },
    { enabled, preventDefault: false }
  )

  // Navigate to Dashboard: g → d
  useHotkeys(
    'd',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/')
    },
    { enabled }
  )

  // Navigate to Tasks: g → t
  useHotkeys(
    't',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/tasks')
    },
    { enabled }
  )

  // Navigate to Sessions: g → s
  useHotkeys(
    's',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/sessions')
    },
    { enabled }
  )

  // Navigate to Agents: g → a
  useHotkeys(
    'a',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/agents')
    },
    { enabled }
  )

  // Navigate to Memory: g → m
  useHotkeys(
    'm',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/memory')
    },
    { enabled }
  )

  // Navigate to Settings: g → ,
  useHotkeys(
    ',',
    () => {
      if (!enabled || !gPrefixActive) return
      resetGPrefix()
      router.push('/settings')
    },
    { enabled }
  )

  // Show help: ?
  useHotkeys(
    'shift+/',
    () => {
      if (!enabled) return
      setShowHelp((prev) => !prev)
    },
    { enabled }
  )

  // Command palette: Cmd/Ctrl + K
  useHotkeys(
    'mod+k',
    (e) => {
      if (!enabled) return
      e.preventDefault()
      setShowCommandPalette((prev) => !prev)
    },
    { enabled, enableOnFormTags: false }
  )

  // Close modals: Escape
  useHotkeys(
    'escape',
    () => {
      if (!enabled) return
      setShowHelp(false)
      setShowCommandPalette(false)
    },
    { enabled }
  )

  return {
    showHelp,
    setShowHelp,
    showCommandPalette,
    setShowCommandPalette,
  }
}

interface ListNavigationOptions {
  items: { id: number | string }[]
  onSelect?: (id: number | string) => void
  enabled?: boolean
}

export function useListNavigation(options: ListNavigationOptions) {
  const { items, onSelect, enabled = true } = options
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // Navigate down: j or ↓
  useHotkeys(
    'j, down',
    () => {
      if (!enabled || items.length === 0) return
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
    },
    { enabled }
  )

  // Navigate up: k or ↑
  useHotkeys(
    'k, up',
    () => {
      if (!enabled || items.length === 0) return
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    },
    { enabled }
  )

  // Select item: Enter
  useHotkeys(
    'enter',
    () => {
      if (!enabled || selectedIndex < 0 || selectedIndex >= items.length) return
      const item = items[selectedIndex]
      if (item && onSelect) {
        onSelect(item.id)
      }
    },
    { enabled }
  )

  const selectedId = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex].id
    : null

  return {
    selectedIndex,
    setSelectedIndex,
    selectedId,
  }
}
