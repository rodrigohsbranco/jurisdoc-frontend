<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { type Cliente, useClientesStore } from '@/stores/clientes'

  const store = useClientesStore()
  const router = useRouter()

  // UI state
  const search = ref('')
  const page = ref(1)
  const itemsPerPage = ref(10)
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'nome_completo', order: 'asc' },
  ])

  const dialog = ref(false)
  const editing = ref<Cliente | null>(null)
  const form = ref<Partial<Cliente>>({})

  // CEP helpers/estado
  const cepLoading = ref(false)
  const cepStatus = ref('')

  // ==== utils locais ====
  // utils locais
  function onlyDigits (v: string) {
    return (v || '').replace(/\D/g, '')
  }

  function goContas (c: Cliente) {
    router.push({ name: 'contas', params: { id: c.id } })
  }

  function isValidCPF (v?: string): boolean {
    const s = onlyDigits(v || '')
    if (s.length !== 11) return false
    if (/^(\d)\1{10}$/.test(s)) return false // rejeita 000... 111... etc.

    // dígito 1
    let sum = 0
    for (let i = 0; i < 9; i++) sum += Number.parseInt(s[i], 10) * (10 - i)
    let d1 = 11 - (sum % 11)
    if (d1 >= 10) d1 = 0
    if (d1 !== Number.parseInt(s[9], 10)) return false

    // dígito 2
    sum = 0
    for (let i = 0; i < 10; i++) sum += Number.parseInt(s[i], 10) * (11 - i)
    let d2 = 11 - (sum % 11)
    if (d2 >= 10) d2 = 0
    return d2 === Number.parseInt(s[10], 10)
  }

  function formatCPF (v: string) {
    const s = onlyDigits(v).slice(0, 11)
    if (s.length <= 3) return s
    if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`
    if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`
  }

  // regras Vuetify

  function formatCEP (v: string) {
    const s = onlyDigits(v).slice(0, 8)
    if (s.length <= 5) return s
    return `${s.slice(0, 5)}-${s.slice(5)}`
  }
  const rules = {
    cepOptional: (v: string) =>
      !v || onlyDigits(v).length === 8 || 'CEP inválido',
    ufOptional: (v: string) => !v || /^[A-Za-z]{2}$/.test(v) || 'UF inválida',
    cpfRequired: (v: string) => (v && isValidCPF(v)) || 'CPF inválido',
  }

  const fieldErrors = ref<Record<string, string[]>>({})

  // EM openCreate(), ANTES de dialog.value = true:
  fieldErrors.value = {}

  // EM openEdit(), ANTES de dialog.value = true:
  fieldErrors.value = {}

  // ==== CEP lookup (ViaCEP) ====
  // Observação: se estiver offline/sem CORS, cai no catch e o usuário preenche manualmente.
  async function lookupCEP () {
    const raw = form.value.cep || ''
    const s = onlyDigits(raw)
    cepStatus.value = ''
    if (s.length !== 8) {
      // apenas limpa a máscara; não bloqueia nada
      form.value.cep = formatCEP(raw)
      return
    }
    cepLoading.value = true
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${s}/json/`)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      if (data.erro) throw new Error('CEP não encontrado')
      // preenche os campos (permanece editável)
      form.value.logradouro = data.logradouro || form.value.logradouro || ''
      form.value.bairro = data.bairro || form.value.bairro || ''
      form.value.cidade = data.localidade || form.value.cidade || ''
      form.value.uf = data.uf || form.value.uf || ''
      cepStatus.value = 'Endereço preenchido pelo CEP.'
    } catch {
      // Falha por offline/CORS/CEP inexistente: segue manual
      cepStatus.value = 'Não foi possível consultar o CEP. Preencha manualmente.'
    } finally {
      cepLoading.value = false
      form.value.cep = formatCEP(raw)
    }
  }

  // helpers de formulário
  function resetForm () {
    form.value = {
      nome_completo: '',
      qualificacao: '',
      cpf: '',
      rg: '',
      orgao_expedidor: '',
      se_idoso: false,
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    }
    cepStatus.value = ''
  }

  function openCreate () {
    editing.value = null
    resetForm()
    dialog.value = true
  }

  function openEdit (c: Cliente) {
    editing.value = c
    form.value = { ...c }
    cepStatus.value = ''
    dialog.value = true
  }

  async function save () {
    fieldErrors.value = {}
    try {
      if (!form.value.nome_completo || !String(form.value.nome_completo).trim()) {
        throw new Error('Informe o nome completo.')
      }
      // sanitiza antes de enviar
      const payload = { ...form.value } as any
      if (payload.cpf) payload.cpf = onlyDigits(payload.cpf)
      if (payload.cep) payload.cep = onlyDigits(payload.cep)
      if (payload.uf) payload.uf = String(payload.uf).toUpperCase()

      await (editing.value
        ? store.update(editing.value.id, payload)
        : store.create(payload))
      dialog.value = false
    } catch (error: any) {
      if (
        error?.response?.status === 400
        && error.response.data
        && typeof error.response.data === 'object'
      ) {
        fieldErrors.value = error.response.data as Record<string, string[]>
        store.error = '' // evita o alerta genérico
        return
      }
      store.error
        = error?.response?.data?.detail || error?.message || 'Erro ao salvar.'
    }
  }

  async function remove (c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome_completo}"?`)) return
    try {
      await store.remove(c.id)
    } catch (error: any) {
      store.error = error?.response?.data?.detail || 'Não foi possível excluir.'
    }
  }

  function formatDate (iso?: string) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR')
    } catch {
      return iso
    }
  }

  // headers simples
  const headers = [
    { title: 'Nome', key: 'nome_completo' },
    { title: 'CPF', key: 'cpf' },
    { title: 'Cidade', key: 'cidade' },
    { title: 'UF', key: 'uf' },
    { title: 'Criado em', key: 'criado_em', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
  ]

  onMounted(() => {
    // traz uma lista generosa; se crescer, migramos para server-side
    store.fetchList({ page: 1, page_size: 1000, ordering: 'nome_completo' })
  })
</script>

<template>
  <v-container fluid>
    <v-card class="rounded-xl" elevation="2">
      <v-card-title class="d-flex align-center">
        <span>Clientes</span>
        <v-spacer />
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Buscar"
          prepend-inner-icon="mdi-magnify"
          style="max-width: 320px"
        />
        <v-btn class="ml-2" color="primary" @click="openCreate">
          <v-icon icon="mdi-account-plus" start /> Novo cliente
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-alert
          v-if="store.hasError"
          class="mb-4"
          type="error"
          variant="tonal"
        >
          {{ store.error }}
        </v-alert>

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="store.items"
          :loading="store.loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.criado_em="{ item }">
            {{ formatDate(item.criado_em) }}
          </template>

          <template #item.actions="{ item }">
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="remove(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
            <v-btn
              color="indigo"
              icon
              size="small"
              variant="text"
              @click="goContas(item)"
            >
              <v-icon icon="mdi-bank" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum cliente encontrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialog" max-width="860">
      <v-card>
        <v-card-title>{{
          editing ? "Editar cliente" : "Novo cliente"
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="save">
            <v-row dense>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="form.nome_completo"
                  :error-messages="fieldErrors.nome_completo"
                  label="Nome completo"
                  :rules="[
                    (v) =>
                      (!!v && String(v).trim().length > 0) ||
                      'Nome é obrigatório',
                  ]"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.qualificacao"
                  label="Qualificação"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.cpf"
                  :error-messages="fieldErrors.cpf"
                  label="CPF"
                  :rules="[rules.cpfRequired]"
                  @blur="form.cpf = formatCPF(form.cpf || '')"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.rg" label="RG" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.orgao_expedidor"
                  label="Órgão expedidor"
                />
              </v-col>

              <!-- CEP vem antes do logradouro -->
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.cep"
                  append-inner-icon="mdi-magnify"
                  label="CEP"
                  :loading="cepLoading"
                  prepend-inner-icon="mdi-map-search"
                  :rules="[rules.cepOptional]"
                  @blur="lookupCEP"
                  @click:append-inner="lookupCEP"
                />
                <div
                  v-if="cepStatus"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  {{ cepStatus }}
                </div>
              </v-col>
              <v-col cols="12" md="5">
                <v-text-field v-model="form.logradouro" label="Logradouro" />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field v-model="form.numero" label="Número" />
              </v-col>
              <v-col cols="12" md="2">
                <v-switch
                  v-model="form.se_idoso"
                  color="secondary"
                  hide-details
                  label="Idoso?"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field v-model="form.bairro" label="Bairro" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.cidade" label="Cidade" />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="form.uf"
                  label="UF"
                  maxlength="2"
                  :rules="[rules.ufOptional]"
                  @blur="form.uf = (form.uf || '').toUpperCase()"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="save">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
