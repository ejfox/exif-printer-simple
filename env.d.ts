/// <reference types="vite/client" />

declare global {
  interface Window {
    __TAURI__?: {
      tauri: {
        invoke: (command: string, args?: any) => Promise<any>
      }
      event: {
        listen: (event: string, handler: (event: any) => void) => Promise<() => void>
      }
    }
  }
}

export {}
