/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  // adicione outras VITE_* aqui se precisar
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// fallback caso sua template não injete o declare de .vue
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
