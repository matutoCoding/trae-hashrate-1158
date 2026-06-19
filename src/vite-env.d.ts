/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => string
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, callback: (...args: unknown[]) => void) => void
  }
}
