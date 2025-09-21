<script setup lang="ts">
  import { onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    type Cliente,
    type Representante,
    useClientesStore,
  } from '@/stores/clientes'

  const store = useClientesStore()
  const router = useRouter()

  // UI state (lista)
  const search = ref('')
  const page = ref(1)
  const itemsPerPage = ref(10)
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'nome_completo', order: 'asc' },
  ])

  // Dialog cliente
  const dialog = ref(false)
  const editing = ref<Cliente | null>(null)
  const form = ref<Partial<Cliente>>({})

  // CEP helpers/estado
  const cepLoading = ref(false)
  const cepStatus = ref('')

  // ==== utils locais ====
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

  // ==== CEP lookup (ViaCEP) ====
  async function lookupCEP () {
    const raw = form.value.cep || ''
    const s = onlyDigits(raw)
    cepStatus.value = ''
    if (s.length !== 8) {
      form.value.cep = formatCEP(raw)
      return
    }
    cepLoading.value = true
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${s}/json/`)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      if (data.erro) throw new Error('CEP não encontrado')
      form.value.logradouro = data.logradouro || form.value.logradouro || ''
      form.value.bairro = data.bairro || form.value.bairro || ''
      form.value.cidade = data.localidade || form.value.cidade || ''
      form.value.uf = data.uf || form.value.uf || ''
      cepStatus.value = 'Endereço preenchido pelo CEP.'
    } catch {
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
      // qualificacao: '', // 🔕 oculto no UI; mantido no back
      cpf: '',
      rg: '',
      orgao_expedidor: '',

      // novos sinalizadores (apenas no cliente)
      se_idoso: false,
      se_incapaz: false,
      se_crianca_adolescente: false,

      // dados civis
      nacionalidade: '',
      estado_civil: '',
      profissao: '',

      // endereço
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    }
    cepStatus.value = ''
    fieldErrors.value = {}
  }

  function openCreate () {
    editing.value = null
    resetForm()
    dialog.value = true
  }

  async function openEdit (c: Cliente) {
    editing.value = c
    form.value = { ...c }
    cepStatus.value = ''
    fieldErrors.value = {}
    dialog.value = true
    // carrega representantes desse cliente
    try {
      await store.fetchRepresentantes(c.id, { force: true })
    } catch {
      /* erro tratado via store */
    }
  }

  async function save () {
    fieldErrors.value = {}
    try {
      if (!form.value.nome_completo || !String(form.value.nome_completo).trim()) {
        throw new Error('Informe o nome completo.')
      }
      const payload = { ...form.value } as any
      if (payload.cpf) payload.cpf = onlyDigits(payload.cpf)
      if (payload.cep) payload.cep = onlyDigits(payload.cep)
      if (payload.uf) payload.uf = String(payload.uf).toUpperCase()
      // (Se em algum momento o form voltar a carregar reps embutidos, sanitizar aqui.)

      await (editing.value
        ? store.update(editing.value.id, payload)
        : store.create(payload))
      dialog.value = false
    } catch (error: any) {
      if (
        error?.response?.status === 400
        && error.response?.data
        && typeof error.response.data === 'object'
      ) {
        fieldErrors.value = error.response.data as Record<string, string[]>
        store.error = ''
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
    store.fetchList({ page: 1, page_size: 1000, ordering: 'nome_completo' })
  })

  // =========================
  // Representantes (UI)
  // =========================
  const repsDialog = ref(false)
  const repsEditing = ref<Representante | null>(null)
  const repsForm = ref<Partial<Representante>>({})
  const repsFieldErrors = ref<Record<string, string[]>>({})

  function copyEnderecoClienteToRepForm () {
    if (!editing.value || !repsForm.value) return
    // copia do form atual do cliente (não do server), mantendo editável
    repsForm.value.cep = form.value.cep || ''
    repsForm.value.logradouro = form.value.logradouro || ''
    repsForm.value.numero = form.value.numero || ''
    repsForm.value.bairro = form.value.bairro || ''
    repsForm.value.cidade = form.value.cidade || ''
    repsForm.value.uf = (form.value.uf || '').toUpperCase()
  }

  function openRepCreate () {
    if (!editing.value) return
    repsEditing.value = null
    repsFieldErrors.value = {}
    repsForm.value = {
      cliente: editing.value.id,
      nome_completo: '',
      cpf: '',
      rg: '',
      orgao_expedidor: '',
      // civis
      nacionalidade: '',
      estado_civil: '',
      profissao: '',
      // endereço
      usa_endereco_do_cliente: true, // default esperto 😉
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    }
    // pré-preenche endereço se o toggle começar ligado
    if (repsForm.value.usa_endereco_do_cliente) {
      copyEnderecoClienteToRepForm()
    }
    repsDialog.value = true
  }

  function openRepEdit (r: Representante) {
    repsEditing.value = r
    repsFieldErrors.value = {}
    repsForm.value = { ...r }
    // se a flag vier ligada, reflete no formulário local
    if (repsForm.value.usa_endereco_do_cliente) {
      copyEnderecoClienteToRepForm()
    }
    repsDialog.value = true
  }

  // quando o usuário ligar/desligar o toggle na UI do representante (dialog),
  // sincronizamos os campos locais se ligar.
  watch(
    () => repsForm.value.usa_endereco_do_cliente,
    val => {
      if (val) copyEnderecoClienteToRepForm()
    },
  )

  async function saveRep () {
    repsFieldErrors.value = {}
    try {
      if (
        !repsForm.value.nome_completo
        || !String(repsForm.value.nome_completo).trim()
      ) {
        throw new Error('Informe o nome do representante.')
      }
      if (!editing.value)
        throw new Error('Salve o cliente antes de cadastrar representantes.')

      const payload = { ...repsForm.value } as any
      // sanitização básica
      if (payload.cpf) payload.cpf = onlyDigits(payload.cpf)
      if (payload.cep) payload.cep = onlyDigits(payload.cep)
      if (payload.uf) payload.uf = String(payload.uf).toUpperCase()
      // garante vínculo
      payload.cliente = editing.value.id
      // nunca enviar flags de "situação especial" para reps
      delete payload.se_idoso
      delete payload.se_incapaz
      delete payload.se_crianca_adolescente

      await (repsEditing.value
        ? store.updateRepresentante(
          repsEditing.value.id,
          payload,
          editing.value.id,
        )
        : store.createRepresentante(payload))
      repsDialog.value = false
    } catch (error: any) {
      if (
        error?.response?.status === 400
        && error.response?.data
        && typeof error.response.data === 'object'
      ) {
        repsFieldErrors.value = error.response.data as Record<string, string[]>
        return
      }
      store.repsErrorByCliente[editing.value?.id || 0]
        = error?.response?.data?.detail
          || error?.message
          || 'Erro ao salvar representante.'
    }
  }

  async function removeRep (r: Representante) {
    if (!editing.value) return
    if (!confirm(`Excluir o representante "${r.nome_completo}"?`)) return
    try {
      await store.removeRepresentante(r.id, editing.value.id)
    } catch (error: any) {
      store.repsErrorByCliente[editing.value.id]
        = error?.response?.data?.detail
          || 'Não foi possível excluir representante.'
    }
  }

  // ação opcional (server) para copiar endereço do cliente em reps JÁ salvos
  async function usarEnderecoDoCliente (r: Representante) {
    if (!editing.value) return
    try {
      await store.usarEnderecoDoClienteNoRepresentante(r.id, editing.value.id)
      // refresh leve
      await store.fetchRepresentantes(editing.value.id, { force: true })
    } catch (error: any) {
      store.repsErrorByCliente[editing.value.id]
        = error?.response?.data?.detail || 'Não foi possível copiar endereço.'
    }
  }
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
    <v-dialog v-model="dialog" max-width="980">
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

              <!-- Qualificação fica oculta por ora (mantida no back) -->
              <!--
              <v-col cols="12" md="4">
                <v-text-field v-model="form.qualificacao" label="Qualificação" />
              </v-col>
              -->

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

              <!-- Dados civis -->
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.nacionalidade"
                  label="Nacionalidade"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.estado_civil"
                  label="Estado civil"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.profissao" label="Profissão" />
              </v-col>

              <!-- Sinalizadores -->
              <v-col cols="12" md="4">
                <v-switch
                  v-model="form.se_idoso"
                  color="secondary"
                  hide-details
                  label="Idoso?"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="form.se_incapaz"
                  color="secondary"
                  hide-details
                  label="Incapaz?"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="form.se_crianca_adolescente"
                  color="secondary"
                  hide-details
                  label="Criança/Adolescente?"
                />
              </v-col>

              <!-- Endereço -->
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
              <v-col cols="12" md="4">
                <v-text-field v-model="form.numero" label="Número" />
              </v-col>
              <v-col cols="12" md="6">
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

          <!-- ===================== Representantes ===================== -->
          <v-divider class="my-4" />
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-2">Representantes</div>
            <v-btn
              v-if="editing"
              color="primary"
              prepend-icon="mdi-account-plus"
              @click="openRepCreate"
            >
              Adicionar representante
            </v-btn>
          </div>

          <v-alert v-if="!editing" class="mb-2" type="info" variant="tonal">
            Salve o cliente para habilitar o cadastro de representantes.
          </v-alert>

          <v-alert
            v-else-if="store.repsErrorByCliente[editing.id]"
            class="mb-2"
            type="error"
            variant="tonal"
          >
            {{ store.repsErrorByCliente[editing.id] }}
          </v-alert>

          <template v-if="editing">
            <v-table
              v-if="store.representantesDoCliente(editing.id).length > 0"
              density="comfortable"
            >
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Endereço</th>
                  <th>Flags</th>
                  <th class="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in store.representantesDoCliente(editing.id)"
                  :key="r.id"
                >
                  <td>{{ r.nome_completo }}</td>
                  <td>{{ r.cpf }}</td>
                  <td>
                    <v-chip
                      v-if="r.usa_endereco_do_cliente"
                      class="mr-1"
                      color="secondary"
                      size="small"
                      title="Usando endereço do cliente"
                    >
                      usa endereço do cliente
                    </v-chip>
                    <span v-else>
                      {{ [r.logradouro, r.numero].filter(Boolean).join(", ") }}
                      <template v-if="r.bairro"> — {{ r.bairro }}</template>
                      <template v-if="r.cidade || r.uf">
                        —
                        {{
                          [r.cidade, (r.uf || "").toUpperCase()]
                            .filter(Boolean)
                            .join("/")
                        }}
                      </template>
                    </span>
                  </td>
                  <td>
                    <v-chip
                      v-if="r.se_idoso"
                      class="mr-1"
                      size="x-small"
                    >idoso</v-chip>
                    <v-chip
                      v-if="r.se_incapaz"
                      class="mr-1"
                      size="x-small"
                    >incapaz</v-chip>
                    <v-chip
                      v-if="r.se_crianca_adolescente"
                      size="x-small"
                    >criança/adolescente</v-chip>
                  </td>
                  <td class="text-right">
                    <v-btn
                      icon
                      size="small"
                      :title="'Usar endereço do cliente'"
                      variant="text"
                      @click="usarEnderecoDoCliente(r)"
                    >
                      <v-icon icon="mdi-home-account" />
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      title="Editar"
                      variant="text"
                      @click="openRepEdit(r)"
                    >
                      <v-icon icon="mdi-pencil" />
                    </v-btn>
                    <v-btn
                      color="error"
                      icon
                      size="small"
                      title="Excluir"
                      variant="text"
                      @click="removeRep(r)"
                    >
                      <v-icon icon="mdi-delete" />
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <v-alert v-else type="info" variant="tonal">
              Nenhum representante cadastrado para este cliente.
            </v-alert>
          </template>
          <!-- =========================================================== -->
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="save">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Representante (criar/editar) -->
    <v-dialog v-model="repsDialog" max-width="860">
      <v-card>
        <v-card-title>{{
          repsEditing ? "Editar representante" : "Novo representante"
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveRep">
            <v-row dense>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="repsForm.nome_completo"
                  :error-messages="repsFieldErrors.nome_completo"
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
                  v-model="repsForm.cpf"
                  :error-messages="repsFieldErrors.cpf"
                  label="CPF"
                  @blur="repsForm.cpf = formatCPF(repsForm.cpf || '')"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field v-model="repsForm.rg" label="RG" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="repsForm.orgao_expedidor"
                  label="Órgão expedidor"
                />
              </v-col>

              <!-- Sinalizadores -->
              <!-- <v-col cols="12" md="4">
                <v-switch
                  v-model="repsForm.se_idoso"
                  color="secondary"
                  hide-details
                  label="Idoso?"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="repsForm.se_incapaz"
                  color="secondary"
                  hide-details
                  label="Incapaz?"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="repsForm.se_crianca_adolescente"
                  color="secondary"
                  hide-details
                  label="Criança/Adolescente?"
                />
              </v-col> -->

              <!-- Dados civis -->
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="repsForm.nacionalidade"
                  label="Nacionalidade"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="repsForm.estado_civil"
                  label="Estado civil"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="repsForm.profissao" label="Profissão" />
              </v-col>

              <!-- Endereço -->
              <v-col cols="12" md="4">
                <v-switch
                  v-model="repsForm.usa_endereco_do_cliente"
                  color="secondary"
                  hide-details
                  label="Usar o mesmo endereço do cliente"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="repsForm.cep"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="CEP"
                  @blur="repsForm.cep = formatCEP(repsForm.cep || '')"
                />
              </v-col>
              <v-col cols="12" md="5">
                <v-text-field
                  v-model="repsForm.logradouro"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="Logradouro"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="repsForm.numero"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="Número"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="repsForm.bairro"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="Bairro"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="repsForm.cidade"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="Cidade"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="repsForm.uf"
                  :disabled="repsForm.usa_endereco_do_cliente"
                  label="UF"
                  maxlength="2"
                  @blur="repsForm.uf = (repsForm.uf || '').toUpperCase()"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="repsDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveRep">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* ajustes visuais suaves para alinhar ao restante do app */
</style>
