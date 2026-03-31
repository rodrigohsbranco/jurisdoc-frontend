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

  const rules = {
    required: (v: string) => (!!v && v.trim().length > 0) || 'Campo obrigatório',
    minUser: (v: string) => v?.trim().length >= 3 || 'Mínimo de 3 caracteres',
    minPass: (v: string) => v?.length >= 6 || 'Mínimo de 6 caracteres',
  }

  const canSubmit = computed(
    () => !!username.value.trim() && password.value.length >= 6 && !loading.value,
  )

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
      await auth.login(username.value.trim(), password.value)

      if (!auth.isAuthenticated) {
        throw new Error('Login falhou: autenticação não foi estabelecida')
      }

      try {
        const stored = localStorage.getItem('auth')
        if (!stored) throw new Error('Tokens não foram salvos')
        const parsed = JSON.parse(stored)
        if (!parsed.accessToken || !parsed.refreshToken) {
          throw new Error('Tokens incompletos')
        }
      } catch (e: any) {
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
    <v-main class="login-main">
      <!-- Painel esquerdo: branding -->
      <div class="login-brand">
        <div class="brand-content">
          <img
            alt="ALR"
            class="brand-logo mb-6"
            src="@/assets/logo-alr.jpg"
          >

          <h1 class="brand-title">Azevedo Lima<br>& Rebonatto</h1>
          <div class="brand-divider" />
          <p class="brand-subtitle">Advocacia & Consultoria Jurídica</p>

          <div class="brand-footer">
            <div class="brand-system">JurisDoc</div>
            <div class="brand-system-desc">Sistema de Gestão Documental</div>
          </div>
        </div>
      </div>

      <!-- Painel direito: formulário -->
      <div class="login-form-panel">
        <div class="login-form-wrapper">
          <div class="mb-8">
            <h2 class="form-title">Acesso ao sistema</h2>
            <p class="form-subtitle">Informe suas credenciais para continuar</p>
          </div>

          <v-alert
            v-if="error"
            class="mb-6"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ error }}
          </v-alert>

          <v-form @submit.prevent="onSubmit">
            <div class="mb-5">
              <label class="field-label">Usuário</label>
              <v-text-field
                v-model.trim="username"
                autocomplete="username"
                density="comfortable"
                placeholder="Digite seu usuário"
                prepend-inner-icon="mdi-account-outline"
                :rules="[rules.required, rules.minUser]"
                variant="outlined"
              />
            </div>

            <div class="mb-6">
              <label class="field-label">Senha</label>
              <v-text-field
                v-model="password"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                autocomplete="current-password"
                density="comfortable"
                placeholder="Digite sua senha"
                prepend-inner-icon="mdi-lock-outline"
                :rules="[rules.required, rules.minPass]"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                @click:append-inner="showPassword = !showPassword"
              />
            </div>

            <v-btn
              block
              color="primary"
              :disabled="!canSubmit"
              :loading="loading"
              size="large"
              type="submit"
            >
              Entrar
            </v-btn>
          </v-form>

          <div class="login-footer-text">
            &copy; {{ new Date().getFullYear() }} Azevedo Lima & Rebonatto
          </div>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
.login-main {
  display: flex;
  min-height: 100vh;
}

/* ─── Painel esquerdo ─── */
.login-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45%;
  min-height: 100vh;
  background: linear-gradient(160deg, #0F2B46 0%, #0a1f33 60%, #071622 100%);
  position: relative;
  overflow: hidden;
}

/* Pattern decorativo sutil */
.login-brand::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 80%, rgba(205, 166, 96, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(205, 166, 96, 0.04) 0%, transparent 50%);
}

/* Linha dourada lateral */
.login-brand::after {
  content: '';
  position: absolute;
  right: 0;
  top: 10%;
  bottom: 10%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(205, 166, 96, 0.3), transparent);
}

.brand-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-logo {
  max-width: 200px;
  max-height: 80px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 0 16px 8px rgba(255, 255, 255, 0.2), 0 0 48px 16px rgba(255, 255, 255, 0.08);
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.brand-divider {
  width: 48px;
  height: 2px;
  background: #CDA660;
  margin: 20px auto;
  border-radius: 1px;
}

.brand-subtitle {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 500;
}

.brand-footer {
  position: absolute;
  bottom: -120px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.brand-system {
  font-size: 0.875rem;
  font-weight: 600;
  color: #CDA660;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.brand-system-desc {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
}

/* ─── Painel direito ─── */
.login-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FAFBFC;
  padding: 48px;
}

.login-form-wrapper {
  width: 100%;
  max-width: 380px;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0F2B46;
  letter-spacing: -0.01em;
}

.form-subtitle {
  font-size: 0.8125rem;
  color: rgba(15, 43, 70, 0.5);
  margin-top: 6px;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(15, 43, 70, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.login-footer-text {
  text-align: center;
  font-size: 0.6875rem;
  color: rgba(15, 43, 70, 0.3);
  margin-top: 48px;
}

/* ─── Responsivo ─── */
@media (max-width: 960px) {
  .login-main {
    flex-direction: column;
  }

  .login-brand {
    width: 100%;
    min-height: auto;
    padding: 48px 24px;
  }

  .login-brand::after {
    display: none;
  }

  .brand-footer {
    display: none;
  }

  .login-form-panel {
    padding: 32px 24px;
  }
}
</style>
