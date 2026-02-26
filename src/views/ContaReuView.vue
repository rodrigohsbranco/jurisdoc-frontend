<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import {
    type ContaBancariaReu,
    useContasReuStore,
  } from '@/stores/contasReu'

  const contasReu = useContasReuStore()

  const loading = computed(() => contasReu.loading)
  const error = computed(() => contasReu.error)

  // === Bancos (autocomplete com fallback offline) ===
  const bankItems = ref<{ label: string, code?: string, ispb?: string }[]>([])
  const bankSearch = ref('')
  const bankLoading = ref(false)

  const FALLBACK_BANKS = [
    'Banco do Brasil (001)',
    'Bradesco (237)',
    'Itaú Unibanco (341)',
    'Caixa Econômica Federal (104)',
    'Santander (033)',
    'Nubank (260)',
    'Inter (077)',
    'C6 Bank (336)',
    'BTG Pactual (208)',
    'Sicoob (756)',
    'Sicredi (748)',
    'Banrisul (041)',
    'BRB (070)',
    'Banco Original (212)',
    'PagBank (290)',
  ].map(label => ({ label }))

  // tabela (client-side)
  const search = ref('')
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'banco_nome', order: 'asc' },
  ])

  // diálogo criar/editar
  const dialog = ref(false)
  const editing = ref<ContaBancariaReu | null>(null)
  const form = ref<Partial<ContaBancariaReu>>({
    banco_nome: '',
    banco_codigo: '',
    cnpj: '',
    descricao: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  })
  const fieldErrors = ref<Record<string, string[]>>({})

  // CEP lookup
  const cepLoading = ref(false)
  const cepStatus = ref('')

  // helpers
  function onlyDigits (v: string) {
    return (v || '').replace(/\D/g, '')
  }

  function formatCNPJ (v: string) {
    const s = onlyDigits(v).slice(0, 14)
    if (s.length <= 2) return s
    if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`
    if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`
    if (s.length <= 12) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
  }

  function formatCEP (v: string) {
    const s = onlyDigits(v).slice(0, 8)
    if (s.length <= 5) return s
    return `${s.slice(0, 5)}-${s.slice(5)}`
  }

  // Regras de validação
  const rules = {
    cepOptional: (v: string) =>
      !v || onlyDigits(v).length === 8 || 'CEP inválido',
    ufOptional: (v: string) => !v || /^[A-Za-z]{2}$/.test(v) || 'UF inválida',
  }

  function resetForm () {
    form.value = {
      banco_nome: '',
      banco_codigo: '',
      cnpj: '',
      descricao: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    }
    fieldErrors.value = {}
    cepStatus.value = ''
  }

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
      form.value.estado = data.uf || form.value.estado || ''
      cepStatus.value = 'Endereço preenchido pelo CEP.'
    } catch {
      cepStatus.value = 'Não foi possível consultar o CEP. Preencha manualmente.'
    } finally {
      cepLoading.value = false
      form.value.cep = formatCEP(raw)
    }
  }

  function openCreate () {
    editing.value = null
    resetForm()
    dialog.value = true
  }

  function openEdit (c: ContaBancariaReu) {
    editing.value = c
    form.value = { ...c }
    fieldErrors.value = {}
    cepStatus.value = ''
    dialog.value = true
  }

  function extractCompeFromLabel (label: string): string {
    const m = /\((\d{3})\)\s*$/.exec(label)
    return m ? m[1] : ''
  }

  async function loadBankCatalog () {
    if (bankItems.value.length > 0) return
    bankLoading.value = true
    try {
      const cached = localStorage.getItem('br_banks_v1')
      if (cached) {
        bankItems.value = JSON.parse(cached)
        return
      }
      const resp = await fetch('https://brasilapi.com.br/api/banks/v1')
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      const mapped = (data as any[]).map(b => ({
        label: `${b.fullName || b.name}${b.code ? ` (${b.code})` : ''}`,
        code: b.code ? String(b.code) : undefined,
        ispb: b.ispb ? String(b.ispb) : undefined,
      }))
      mapped.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      bankItems.value = mapped
      localStorage.setItem('br_banks_v1', JSON.stringify(mapped))
    } catch {
      bankItems.value = FALLBACK_BANKS
    } finally {
      bankLoading.value = false
    }
  }


  async function save () {
    fieldErrors.value = {}
    try {
      const nomeBanco
        = typeof form.value.banco_nome === 'string'
          ? form.value.banco_nome.trim()
          : (form.value as any).banco_nome?.label?.trim?.() || ''

      if (!nomeBanco) throw new Error('Informe o nome do banco.')
      if (!form.value.cnpj || onlyDigits(form.value.cnpj).length !== 14) {
        throw new Error('Informe um CNPJ válido.')
      }

      // Extrai código do banco se disponível
      const bancoCodigo = extractCompeFromLabel(nomeBanco) || form.value.banco_codigo || ''

      const payload: any = {
        ...form.value,
        banco_nome: nomeBanco,
        banco_codigo: bancoCodigo,
        cnpj: onlyDigits(String(form.value.cnpj || '')),
        cep: form.value.cep ? onlyDigits(String(form.value.cep)) : '',
        estado: form.value.estado ? String(form.value.estado).toUpperCase() : '',
      }

      await (editing.value
        ? contasReu.update(editing.value.id, payload)
        : contasReu.create(payload))

      dialog.value = false
      await load()
    } catch (error_: any) {
      if (
        error_?.response?.status === 400 &&
        error_?.response?.data &&
        typeof error_?.response.data === 'object'
      ) {
        // Verifica se é erro de CNPJ duplicado
        const data = error_.response.data
        if (data.cnpj && Array.isArray(data.cnpj)) {
          const cnpjError = data.cnpj.find((msg: string) => 
            msg.toLowerCase().includes('unique') || 
            msg.toLowerCase().includes('já existe') ||
            msg.toLowerCase().includes('already exists')
          )
          if (cnpjError) {
            fieldErrors.value = { cnpj: ['Este CNPJ já está cadastrado.'] }
            return
          }
        }
        fieldErrors.value = data as Record<string, string[]>
        return
      }
      contasReu.error
        = error_?.response?.data?.detail || error_?.message || 'Erro ao salvar.'
    }
  }

  async function remove (acc: ContaBancariaReu) {
    if (!confirm(`Excluir o banco ${acc.banco_nome}?`)) return
    try {
      await contasReu.remove(acc.id)
      await load()
    } catch (error_: any) {
      contasReu.error
        = error_?.response?.data?.detail || 'Não foi possível excluir.'
    }
  }


  const headers = [
    { title: 'Banco', key: 'banco_nome' },
    { title: 'CNPJ', key: 'cnpj' },
    { title: 'Descrição', key: 'descricao' },
    { title: 'Cidade', key: 'cidade' },
    { title: 'Estado', key: 'estado' },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
  ]

  const contasDoReu = computed(() => contasReu.items)

  async function load () {
    await contasReu.fetchAll({})
  }

  onMounted(load)
</script>

<template>
  <v-container fluid>
    <v-card class="rounded mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Bancos Réus</div>
          <div class="text-body-2 text-medium-emphasis">
            Gerenciamento dos Bancos Réus
          </div>
        </div>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-bank-plus"
          @click="openCreate"
        >
          Novo banco do Réu
        </v-btn>
      </v-card-title>
    </v-card>

    <v-card class="rounded" elevation="2">
      <v-card-title class="d-flex align-center">
        <v-responsive max-width="300px">
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            variant="outlined"
            hide-details
            label="Buscar"
            prepend-inner-icon="mdi-magnify"
          />
        </v-responsive>
      </v-card-title>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="contasDoReu"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.cnpj="{ item }">
            {{ item.cnpj ? formatCNPJ(item.cnpj) : "—" }}
          </template>

          <template #item.descricao="{ item }">
            <span v-if="item.descricao" :title="item.descricao">
              {{ item.descricao.length > 50 ? item.descricao.substring(0, 50) + '...' : item.descricao }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <template #item.cidade="{ item }">
            {{ item.cidade || "—" }}
          </template>

          <template #item.estado="{ item }">
            {{ item.estado || "—" }}
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
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum banco cadastrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialog" max-width="840">
      <v-card>
        <v-card-title>{{
          editing ? "Editar banco" : "Novo banco"
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="save">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-combobox
                  v-model="form.banco_nome"
                  v-model:search="bankSearch"
                  clearable
                  item-title="label"
                  item-value="label"
                  :items="bankItems"
                  label="Banco"
                  :loading="bankLoading"
                  required
                  :return-object="false"
                  :error-messages="fieldErrors.banco_nome"
                  :rules="[
                    (v) =>
                      (typeof v === 'string' && v.trim().length > 0) ||
                      (v &&
                        typeof v === 'object' &&
                        v.label &&
                        String(v.label).trim().length > 0) ||
                      'Obrigatório',
                  ]"
                  @focus="loadBankCatalog"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.cnpj"
                  label="CNPJ"
                  required
                  :error-messages="fieldErrors.cnpj"
                  :rules="[
                    (v) => {
                      const digits = onlyDigits(v || '')
                      return digits.length === 14 || 'CNPJ deve ter 14 dígitos'
                    },
                  ]"
                  @blur="form.cnpj = formatCNPJ(form.cnpj || '')"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="form.descricao"
                  label="Descrição"
                  :error-messages="fieldErrors.descricao"
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
                  :error-messages="fieldErrors.cep"
                  :rules="[rules.cepOptional]"
                  @blur="
                    form.cep = formatCEP(form.cep || '');
                    lookupCEP();
                  "
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
                <v-text-field
                  v-model="form.logradouro"
                  label="Logradouro"
                  :error-messages="fieldErrors.logradouro"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.numero"
                  label="Número"
                  :error-messages="fieldErrors.numero"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.bairro"
                  label="Bairro"
                  :error-messages="fieldErrors.bairro"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.cidade"
                  label="Cidade"
                  :error-messages="fieldErrors.cidade"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.estado"
                  label="Estado (UF)"
                  maxlength="2"
                  :error-messages="fieldErrors.estado"
                  :rules="[rules.ufOptional]"
                  @blur="form.estado = (form.estado || '').toUpperCase()"
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
