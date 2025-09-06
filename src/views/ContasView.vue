<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { type Cliente, useClientesStore } from '@/stores/clientes'
  import { type ContaBancaria, useContasStore } from '@/stores/contas'

  const route = useRoute()
  const router = useRouter()
  const contas = useContasStore()
  const clientes = useClientesStore()

  const clienteId = computed(() => Number(route.params.id))
  const cliente = ref<Cliente | null>(null)

  const loading = computed(() => contas.loading)
  const error = computed(() => contas.error)

  // === Bancos (autocomplete com fallback offline) ===
  const bankItems = ref<{ label: string }[]>([])
  const bankSearch = ref('')
  const bankLoading = ref(false)

  // lista mínima para funcionar offline
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
  const page = ref(1)
  const itemsPerPage = ref(10)
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'banco_nome', order: 'asc' },
  ])

  // diálogo criar/editar
  const dialog = ref(false)
  const editing = ref<ContaBancaria | null>(null)
  const form = ref<Partial<ContaBancaria>>({
    banco_nome: '',
    agencia: '',
    conta: '',
    digito: '',
    tipo: 'corrente',
    is_principal: false,
  })

  // helpers
  function onlyDigits (v: string) {
    return (v || '').replace(/\D/g, '')
  }

  function resetForm () {
    form.value = {
      banco_nome: '',
      agencia: '',
      conta: '',
      digito: '',
      tipo: 'corrente',
      is_principal: false,
    }
  }

  function openCreate () {
    editing.value = null
    resetForm()
    dialog.value = true
  }

  function openEdit (c: ContaBancaria) {
    editing.value = c
    form.value = { ...c }
    dialog.value = true
  }

  async function loadBankCatalog () {
    if (bankItems.value.length > 0) return
    bankLoading.value = true
    try {
      // cache local para evitar hits repetidos (e ajudar quando oscila a rede)
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
      }))
      mapped.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      bankItems.value = mapped
      localStorage.setItem('br_banks_v1', JSON.stringify(mapped))
    } catch {
      // offline / erro de rede → fallback local
      bankItems.value = FALLBACK_BANKS
    } finally {
      bankLoading.value = false
    }
  }

  async function save () {
    try {
      // extrai o nome do banco como STRING (combobox pode entregar objeto)
      const nomeBanco
        = typeof form.value.banco_nome === 'string'
          ? form.value.banco_nome.trim()
          : (form.value as any).banco_nome?.label?.trim?.() || ''

      // validações simples
      if (!nomeBanco) {
        throw new Error('Informe o nome do banco.')
      }
      if (!form.value.agencia || !String(form.value.agencia).trim()) {
        throw new Error('Informe a agência.')
      }
      if (!form.value.conta || !String(form.value.conta).trim()) {
        throw new Error('Informe a conta.')
      }

      // sanitização
      const payload: any = {
        ...form.value,
        banco_nome: nomeBanco, // <-- garante string
        cliente: clienteId.value,
        agencia: onlyDigits(String(form.value.agencia || '')),
        conta: onlyDigits(String(form.value.conta || '')),
        digito: form.value.digito ? onlyDigits(String(form.value.digito)) : '',
        tipo: form.value.tipo || 'corrente',
      }

      // eslint-disable-next-line unicorn/prefer-ternary
      if (editing.value) {
        await contas.update(editing.value.id, payload)
      } else {
        await contas.create(payload)
      // se marcou principal, o store já ajusta as demais localmente
      }

      dialog.value = false
    } catch (error_: any) {
      contas.error
        = error_?.response?.data?.detail || error_?.message || 'Erro ao salvar.'
    }
  }

  async function remove (acc: ContaBancaria) {
    if (
      !confirm(
        `Excluir a conta ${acc.banco_nome} (${acc.agencia}/${acc.conta}${
          acc.digito ? '-' + acc.digito : ''
        })?`,
      )
    )
      return
    try {
      await contas.remove(acc.id)
    } catch (error_: any) {
      contas.error
        = error_?.response?.data?.detail || 'Não foi possível excluir.'
    }
  }

  async function makePrincipal (acc: ContaBancaria) {
    try {
      await contas.setPrincipal(acc.id)
    // o store já garante que só uma fica principal localmente
    } catch (error_: any) {
      contas.error
        = error_?.response?.data?.detail
          || 'Não foi possível definir como principal.'
    }
  }

  function goBack () {
    router.push({ name: 'clientes' })
  }

  const headers = [
    { title: 'Banco', key: 'banco_nome' },
    { title: 'Agência', key: 'agencia' },
    { title: 'Conta', key: 'conta' },
    { title: 'Tipo', key: 'tipo' },
    { title: 'Principal', key: 'is_principal', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
  ]

  const contasDoCliente = computed(() => contas.byCliente(clienteId.value))

  async function load () {
    if (!Number.isFinite(clienteId.value)) {
      router.replace({ name: 'clientes' })
      return
    }
    try {
      cliente.value = await clientes.getDetail(clienteId.value)
    } catch {
      // se falhar, segue sem nome (a rota ainda funciona)
      cliente.value = {
        id: clienteId.value,
        nome_completo: 'Cliente',
        cidade: '',
        uf: '',
      } as any
    }
    await contas.fetchForCliente(clienteId.value, { page: 1, page_size: 100 })
  }

  onMounted(load)
  watch(() => route.params.id, load)
</script>

<template>
  <v-container fluid>
    <v-card class="rounded-xl mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Contas bancárias</div>
          <div class="text-body-2 text-medium-emphasis">
            Cliente:
            <strong>{{ cliente?.nome_completo || "#" + clienteId }}</strong>
            <span v-if="cliente?.cidade">
              — {{ cliente.cidade }}/{{ cliente?.uf }}</span>
          </div>
        </div>
        <v-spacer />
        <v-btn
          prepend-icon="mdi-arrow-left"
          variant="text"
          @click="goBack"
        >Voltar</v-btn>
        <v-btn
          class="ml-2"
          color="primary"
          prepend-icon="mdi-bank-plus"
          @click="openCreate"
        >
          Nova conta
        </v-btn>
      </v-card-title>
    </v-card>

    <v-card class="rounded-xl" elevation="2">
      <v-card-title class="d-flex align-center">
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Buscar"
          prepend-inner-icon="mdi-magnify"
          style="max-width: 320px"
        />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="contasDoCliente"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.agencia="{ item }">
            {{ item.agencia || "—" }}
          </template>

          <template #item.conta="{ item }">
            {{ item.conta }}<span v-if="item.digito">-{{ item.digito }}</span>
          </template>

          <template #item.tipo="{ item }">
            <v-chip size="small" variant="tonal">
              {{ item.tipo === "poupanca" ? "Poupança" : "Corrente" }}
            </v-chip>
          </template>

          <template #item.is_principal="{ item }">
            <v-chip
              v-if="item.is_principal"
              color="secondary"
              size="small"
              variant="elevated"
            >
              Principal
            </v-chip>
            <v-btn
              v-else
              color="secondary"
              size="small"
              variant="text"
              @click="makePrincipal(item)"
            >
              Definir principal
            </v-btn>
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
              Nenhuma conta cadastrada para este cliente.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialog" max-width="680">
      <v-card>
        <v-card-title>{{
          editing ? "Editar conta" : "Nova conta"
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

              <v-col cols="6" md="3">
                <v-text-field
                  v-model="form.agencia"
                  label="Agência"
                  required
                  :rules="[
                    (v) =>
                      (!!v && String(v).trim().length > 0) || 'Obrigatório',
                  ]"
                  @blur="form.agencia = onlyDigits(String(form.agencia || ''))"
                />
              </v-col>

              <v-col cols="6" md="3">
                <v-text-field
                  v-model="form.conta"
                  label="Conta"
                  required
                  :rules="[
                    (v) =>
                      (!!v && String(v).trim().length > 0) || 'Obrigatório',
                  ]"
                  @blur="form.conta = onlyDigits(String(form.conta || ''))"
                />
              </v-col>

              <v-col cols="6" md="3">
                <v-text-field
                  v-model="form.digito"
                  label="Dígito"
                  @blur="form.digito = onlyDigits(String(form.digito || ''))"
                />
              </v-col>

              <v-col cols="6" md="3">
                <v-select
                  v-model="form.tipo"
                  :items="[
                    { title: 'Corrente', value: 'corrente' },
                    { title: 'Poupança', value: 'poupanca' },
                  ]"
                  label="Tipo"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-switch
                  v-model="form.is_principal"
                  color="secondary"
                  hide-details
                  label="Definir como principal"
                />
                <div class="text-caption text-medium-emphasis mt-1">
                  Apenas uma conta principal por cliente.
                </div>
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
