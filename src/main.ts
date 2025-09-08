/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App
 */

import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'

// Plugins (Vuetify etc.)
import { registerPlugins } from '@/plugins'
// Router & Store
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
// Components
import App from './App.vue'

// Styles
import 'unfonts.css'

const app = createApp(App)

// Pinia com persistência (localStorage)
const pinia = createPinia()
pinia.use(piniaPersist)
app.use(pinia)

// Bootstrap de autenticação ANTES de montar a app
;(async () => {
  try {
    const auth = useAuthStore(pinia) // passa a instância do pinia explicitamente
    await auth.bootstrap() // reidrata tokens, agenda refresh e checa inatividade (24h)
  } catch {
    // silencioso: se falhar, o interceptor/lógica do auth lida com 401 depois
  }

  // Router, Vuetify e demais plugins
  app.use(router)
  registerPlugins(app)

  // Monta a aplicação
  app.mount('#app')
})()
