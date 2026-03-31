<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'

  const drawer = ref(true)
  const rail = ref(false)
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const navSections = [
    {
      title: 'Gestão',
      items: [
        { title: 'Dashboard', icon: 'mdi-view-dashboard-outline', to: { name: 'dashboard' } },
        { title: 'Clientes', icon: 'mdi-account-group-outline', to: { name: 'clientes' } },
        { title: 'Bancos Réus', icon: 'mdi-bank-outline', to: { name: 'conta-reu' } },
      ],
    },
    {
      title: 'Documentos',
      items: [
        { title: 'Templates', icon: 'mdi-file-word-outline', to: { name: 'templates' } },
        { title: 'Contratos', icon: 'mdi-file-sign', to: { name: 'contratos' } },
        { title: 'Petições', icon: 'mdi-file-document-outline', to: { name: 'peticoes' } },
        { title: 'Produção de Kits', icon: 'mdi-package-variant-closed', to: { name: 'producao-kits' } },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { title: 'Relatórios', icon: 'mdi-chart-bar', to: { name: 'reports' } },
        { title: 'Usuários', icon: 'mdi-account-cog-outline', to: { name: 'usuarios' } },
      ],
    },
  ]

  const userInitials = computed(() => {
    const name = auth.username || ''
    return name.slice(0, 2).toUpperCase()
  })

  function logout () {
    auth.logout(router)
  }

  function toggleNav () {
    if (!drawer.value) {
      drawer.value = true
      return
    }
    rail.value = !rail.value
  }

  const pageTitle = computed(() => {
    return (route.meta?.title as string) || (route.name as string) || 'Application'
  })
</script>

<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      app
      class="nav-drawer"
      color="primary"
      permanent
      :rail="rail"
      :width="260"
    >
      <!-- Brand -->
      <div class="brand-area d-flex align-center justify-center">
        <img
          v-show="!rail"
          alt="Azevedo Lima & Rebonatto"
          class="brand-logo"
          src="@/assets/logo-alr.jpg"
        >
        <span v-show="rail" class="brand-initials">AL&R</span>
      </div>

      <v-divider class="mx-3 mb-2" color="white" opacity="0.12" />

      <!-- Navegação agrupada -->
      <template v-for="section in navSections" :key="section.title">
        <div
          v-show="!rail"
          class="nav-section-title text-white text-uppercase text-center"
        >
          {{ section.title }}
        </div>

        <v-list class="px-2" density="comfortable" nav>
          <v-list-item
            v-for="item in section.items"
            :key="item.title"
            :active="route.name === item.to?.name"
            active-class="nav-item-active"
            class="mb-1 text-white"
            :prepend-icon="item.icon"
            rounded="lg"
            :to="item.to"
          >
            <v-list-item-title class="text-body-2">{{ item.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </template>

      <template #append>
        <v-divider class="mx-3" color="white" opacity="0.12" />
        <div class="pa-3">
          <v-list-item
            v-show="!rail"
            class="text-white rounded-lg mb-2"
            density="compact"
          >
            <template #prepend>
              <v-avatar color="secondary" size="30">
                <span class="text-caption font-weight-bold" style="color: #0F2B46">{{ userInitials }}</span>
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2">{{ auth.username }}</v-list-item-title>
          </v-list-item>
          <v-btn
            block
            color="secondary"
            rounded="lg"
            size="small"
            variant="tonal"
            @click="logout"
          >
            <v-icon icon="mdi-logout" size="18" start />
            <span v-show="!rail">Sair</span>
          </v-btn>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- App bar -->
    <v-app-bar app color="surface" elevation="0" flat>
      <v-app-bar-nav-icon @click="toggleNav" />
      <v-toolbar-title class="font-weight-medium">{{ pageTitle }}</v-toolbar-title>
      <v-spacer />
      <v-btn icon variant="text" size="small">
        <v-icon icon="mdi-bell-outline" size="22" />
      </v-btn>
      <v-btn icon variant="text" size="small">
        <v-icon icon="mdi-help-circle-outline" size="22" />
      </v-btn>
      <v-divider class="mx-2" vertical length="24" />
      <v-avatar class="mr-2" color="primary" size="32">
        <span class="text-caption text-white font-weight-bold">{{ userInitials }}</span>
      </v-avatar>
    </v-app-bar>

    <v-main>
      <v-container class="py-6" fluid>
        <router-view />
      </v-container>
    </v-main>

    <v-footer app color="transparent" elevation="0">
      <v-container class="py-2 text-caption text-medium-emphasis text-center">
        &copy; {{ new Date().getFullYear() }} Azevedo Lima & Rebonatto &mdash; JurisDoc
      </v-container>
    </v-footer>
  </v-app>
</template>

<style scoped>
.nav-drawer {
  background: linear-gradient(
    180deg,
    #0F2B46 0%,
    #0a1f33 100%
  ) !important;
  border-right: none !important;
  height: 100vh !important;
  top: 0 !important;
  position: fixed !important;
}

.nav-item-active {
  background: rgba(205, 166, 96, 0.15) !important;
  color: #CDA660 !important;
}

.nav-item-active .v-icon {
  color: #CDA660 !important;
}

.v-list-item:hover:not(.nav-item-active) {
  background: rgba(255, 255, 255, 0.06) !important;
}

.nav-section-title {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  opacity: 0.5;
  padding: 12px 0 4px;
}

.brand-area {
  padding: 20px 16px;
  min-height: 72px;
}

.brand-logo {
  max-width: 160px;
  max-height: 48px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 2px;
}

.brand-initials {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0043c8;
  letter-spacing: 0.05em;
  background-color: aliceblue;
  padding: 8px 2px;
  border-radius: 4px;
  opacity: 50%;
}
</style>
