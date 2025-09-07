<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'

  const drawer = ref(true)
  const rail = ref(false) // modo estreito (retraído)
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const navItems = [
    { title: 'Dashboard', icon: 'mdi-view-dashboard', to: { name: 'dashboard' } },
    { title: 'Usuários', icon: 'mdi-account-cog', to: { name: 'usuarios' } },
    { title: 'Clientes', icon: 'mdi-account-group', to: { name: 'clientes' } },
    { title: 'Templates', icon: 'mdi-file-word', to: { name: 'templates' } },
  // { title: 'Petições',  icon: 'mdi-file-document', to: { name: 'peticoes' } },
  ]

  function logout () {
    auth.logout(router)
  }

  // ÚNICO controle: hambúrguer
  function toggleNav () {
    if (!drawer.value) {
      drawer.value = true
      return
    }
    rail.value = !rail.value
  }

  const pageTitle = computed(() => {
    return (
      (route.meta?.title as string) || (route.name as string) || 'Application'
    )
  })
</script>

<template>
  <v-app>
    <!-- Drawer com identidade visual -->
    <v-navigation-drawer
      v-model="drawer"
      app
      class="text-white"
      color="primary"
      elevation="2"
      :rail="rail"
    >
      <!-- Brand -->
      <v-list-item class="py-4">
        <template #prepend>
          <v-avatar size="40">
            <v-img alt="ALR" cover src="@/assets/logo-alr.jpg" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-bold">
          ALR JurisDoc
        </v-list-item-title>
      </v-list-item>

      <v-divider opacity="0.2" />

      <!-- Navegação -->
      <v-list class="mt-2" density="comfortable" nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :active="route.name === item.to?.name"
          color="secondary"
          :prepend-icon="item.icon"
          rounded="lg"
          :to="item.to"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <template #append>
        <div class="px-4 pb-4">
          <div v-show="!rail" class="text-caption mb-2">
            Usuário: <strong>{{ auth.username }}</strong>
          </div>
          <v-btn block color="secondary" variant="elevated" @click="logout">
            <v-icon icon="mdi-logout" start /> Sair
          </v-btn>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- App bar -->
    <v-app-bar app color="surface" elevation="1" flat>
      <v-app-bar-nav-icon @click="toggleNav" />
      <v-toolbar-title>{{ pageTitle }}</v-toolbar-title>
      <v-spacer />
      <v-btn icon variant="text"><v-icon icon="mdi-bell-outline" /></v-btn>
      <v-btn
        icon
        variant="text"
      ><v-icon icon="mdi-help-circle-outline" /></v-btn>
    </v-app-bar>

    <v-main>
      <v-container class="py-6" fluid>
        <router-view />
      </v-container>
    </v-main>

    <v-footer app color="surface" elevation="1">
      <v-container class="py-2 text-caption">
        © {{ new Date().getFullYear() }} Azevedo Lima & Rebonatto — JurisDoc
      </v-container>
    </v-footer>
  </v-app>
</template>

<style scoped>
.v-navigation-drawer {
  background-image: linear-gradient(
    180deg,
    rgba(15, 43, 70, 1) 0%,
    rgba(15, 43, 70, 0.95) 100%
  );
}
</style>
