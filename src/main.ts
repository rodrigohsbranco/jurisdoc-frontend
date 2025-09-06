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
// Components
import App from './App.vue'

// Styles
import 'unfonts.css'

const app = createApp(App)

// Pinia com persistência (localStorage)
const pinia = createPinia()
pinia.use(piniaPersist)

app.use(pinia)
app.use(router)

// Vuetify e demais plugins centralizados
registerPlugins(app)

app.mount('#app')
