<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import bg from '@/assets/bg-login.jpg' // <= coloque sua imagem em src/assets/bg-login.jpg
  import { useAuthStore } from '@/stores/auth'

  const username = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const error = ref('')
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  // background inline (garante resolução correta do path pelo bundler)
  const bgCss = computed(() => ({
    backgroundImage: `url(${bg})`,
  }))

  // Regras Vuetify (retornam true ou string com a mensagem)
  const rules = {
    required: (v: string) => (!!v && v.trim().length > 0) || 'Campo obrigatório',
    minUser: (v: string) => v?.trim().length >= 3 || 'Mínimo de 3 caracteres',
    minPass: (v: string) => v?.length >= 6 || 'Mínimo de 6 caracteres',
  }

  const canSubmit = computed(
    () => !!username.value.trim() && password.value.length >= 6 && !loading.value,
  )

  function normalizeUser (u: string) {
    return u.trim()
  }

  function mapError (e: any): string {
    const status = e?.response?.status
    const detail = e?.response?.data?.detail
    if (detail) return String(detail)
    if (status === 401) return 'Usuário ou senha inválidos.'
    if (status === 403) return 'Acesso negado.'
    if (!e?.response)
      return 'Não foi possível conectar à API. Verifique se o backend está no ar.'
    return 'Falha no login. Verifique as credenciais.'
  }

  async function onSubmit () {
    if (!canSubmit.value) return
    error.value = ''
    loading.value = true
    try {
      await auth.login(normalizeUser(username.value), password.value)
      
      // Verifica se o login foi realmente bem-sucedido
      if (!auth.isAuthenticated) {
        throw new Error('Login falhou: autenticação não foi estabelecida')
      }
      
      // Verifica se os tokens foram salvos no localStorage
      try {
        const stored = localStorage.getItem('auth')
        if (!stored) {
          throw new Error('Tokens não foram salvos no localStorage')
        }
        const parsed = JSON.parse(stored)
        if (!parsed.accessToken || !parsed.refreshToken) {
          throw new Error('Tokens incompletos no localStorage')
        }
      } catch (e: any) {
        console.error('Erro ao verificar localStorage após login:', e)
        throw new Error('Falha ao salvar sessão. Tente novamente.')
      }
      
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
    } catch (error_: any) {
      error.value = mapError(error_)
    } finally {
      password.value = ''
      loading.value = false
    }
  }

  onMounted(() => {
    if (auth.isAuthenticated) {
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
    }
  })
</script>

<template>
  <v-app>
    <v-main class="login-main d-flex align-center justify-center">
      <!-- background + scrim -->
      <div class="login-bg" :style="bgCss" />
      <div class="login-scrim" />

      <!-- card -->
      <v-card class="login-card rounded-xl" elevation="8" width="420">
        <v-toolbar color="transparent" flat>
          <v-toolbar-title>Azevedo Lima & Rebonatto</v-toolbar-title>
        </v-toolbar>

        <v-card-text>
          <v-alert
            v-if="error"
            class="mb-4"
            density="comfortable"
            type="error"
            variant="tonal"
          >
            {{ error }}
          </v-alert>

          <v-form @submit.prevent="onSubmit">
            <v-text-field
              v-model.trim="username"
              autocomplete="username"
              density="comfortable"
              label="Usuário"
              required
              :rules="[rules.required, rules.minUser]"
            />
            <v-text-field
              v-model="password"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              autocomplete="current-password"
              density="comfortable"
              label="Senha"
              required
              :rules="[rules.required, rules.minPass]"
              :type="showPassword ? 'text' : 'password'"
              @click:append-inner="showPassword = !showPassword"
            />
            <v-btn
              block
              class="mt-2"
              color="primary"
              :disabled="!canSubmit"
              :loading="loading"
              type="submit"
            >
              Acessar
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-main>
  </v-app>
</template>

<style scoped>
.login-main {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

/* imagem de fundo */
.login-bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  transform: scale(1.02); /* leve zoom para evitar bordas em telas grandes */
  will-change: transform;
}

/* véu suave para legibilidade do card */
.login-scrim {
  position: absolute;
  inset: 0;
  /* background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.92),
    rgba(255, 255, 255, 0.75)
  ); */
}

/* card translúcido com leve blur – chique porém discreto */
.login-card {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(1.1) blur(2px);
}
</style>
