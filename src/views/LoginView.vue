<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'

  const username = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const error = ref('')
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

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
    // Axios style errors
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
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
    } catch (error_: any) {
      error.value = mapError(error_)
    } finally {
      // segurança/conveniência
      password.value = ''
      loading.value = false
    }
  }

  onMounted(() => {
    // Se já estiver logado e caiu no /login, manda pro destino
    if (auth.isAuthenticated) {
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
    }
  })
</script>

<template>
  <v-app>
    <v-main
      class="d-flex align-center justify-center"
      style="min-height: 100vh"
    >
      <v-card width="420">
        <v-toolbar color="transparent" flat>
          <v-toolbar-title>Entrar</v-toolbar-title>
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
