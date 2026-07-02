<script setup lang="ts">
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useClientesStore } from '@/stores/clientes'
  import { useContractsStore } from '@/stores/contracts'
  import { useSnackbar } from '@/composables/useSnackbar'
  import { usePermissions } from '@/composables/usePermissions'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import SidePanel from '@/components/SidePanel.vue'

  // Stores
  const contracts = useContractsStore()
  const clientes = useClientesStore()
  const { showSuccess, showError } = useSnackbar()
  const { can } = usePermissions()

  // Confirm dialog
  const confirmVisible = ref(false)
  const confirmMessage = ref('')
  const confirmAction = ref<(() => void) | null>(null)

  // ======= Helpers =======
  const clienteNome = (id?: number) => {
    const c = clientes.items.find(x => x.id === Number(id))
    return c?.nome_completo || `#${id}`
  }

  const clientOptions = computed(() =>
    clientes.items.map(c => ({
      title: c.nome_completo,
      value: c.id,
    })),
  )

  // ======= Listagem =======
  const search = ref('')
  const page = ref(1)
  const itemsPerPage = ref(10)
  const sortBy = ref([{ key: 'created_at', order: 'desc' as const }])

  const headers = [
    { title: 'Cliente', key: 'cliente' },
    { title: 'Número do Contrato', key: 'numero_contrato' },
    { title: 'Banco', key: 'banco' },
    { title: 'Situação', key: 'situacao' },
    { title: 'Valor Parcela', key: 'valor_parcela' },
    { title: 'Criado em', key: 'created_at' },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
  ]

  const items = computed(() => contracts.items)
  const loading = computed(() => contracts.loading)
  const error = computed(() => contracts.error)

  // Cards mobile (< md). Busca local + paginação 10 por página.
  const { smAndDown: mobile } = useDisplay()
  const filteredItems = computed(() => {
    const q = search.value?.trim().toLowerCase()
    if (!q) return items.value
    return items.value.filter((c: any) => {
      const haystack = [
        clienteNome(c.cliente),
        c.numero_contrato,
        c.banco,
        c.situacao,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  })
  const mobilePage = ref(1)
  const mobilePageSize = 10
  const mobileTotalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / mobilePageSize)))
  const paginatedItems = computed(() => {
    const start = (mobilePage.value - 1) * mobilePageSize
    return filteredItems.value.slice(start, start + mobilePageSize)
  })
  watch([search, () => items.value.length], () => { mobilePage.value = 1 })

  const formatValorParcela = (v: any) =>
    v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  const formatCreatedAt = (d: any) =>
    d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : '—'

  // ======= Dialog / Form =======
  const dialogUpsert = ref(false)
  const editing = ref<any>(null)

  const form = reactive({
    cliente: null as number | null,
    numero_contrato: '',
    banco: '',
    situacao: '',
    origem_averbacao: '',
    data_inclusao: '',
    data_inicio_desconto: '',
    data_fim_desconto: '',
    quantidade_parcelas: null as number | null,
    valor_parcela: null as number | null,
    iof: null as number | null,
    emprestado: null as number | null,
    liberado: null as number | null,
  })

  function resetForm () {
    Object.assign(form, {
      cliente: null,
      numero_contrato: '',
      banco: '',
      situacao: '',
      origem_averbacao: '',
      data_inclusao: '',
      data_inicio_desconto: '',
      data_fim_desconto: '',
      quantidade_parcelas: null,
      valor_parcela: null,
      iof: null,
      emprestado: null,
      liberado: null,
    })
  }

  function openCreate () {
    resetForm()
    editing.value = null
    dialogUpsert.value = true
  }

  function openEdit (item: any) {
    editing.value = item
    Object.assign(form, item)
    dialogUpsert.value = true
  }

  async function saveUpsert () {
    try {
      if (!form.cliente) throw new Error('Selecione o cliente.')

      const payload = {
        ...form,
        cliente: Number(form.cliente),

        // normalizações de data
        data_inclusao: form.data_inclusao
          ? String(form.data_inclusao).split('T')[0]
          : null,
        data_inicio_desconto: form.data_inicio_desconto
          ? String(form.data_inicio_desconto).split('T')[0]
          : null,
        data_fim_desconto: form.data_fim_desconto
          ? String(form.data_fim_desconto).split('T')[0]
          : null,

        // normalizações numéricas
        quantidade_parcelas: form.quantidade_parcelas ?? 0,
        valor_parcela: form.valor_parcela ?? 0,
        iof: form.iof ?? 0,
        emprestado: form.emprestado ?? 0,
        liberado: form.liberado ?? 0,

        // campos livres
        banco: form.banco || '',
        situacao: form.situacao || '',
        origem_averbacao: form.origem_averbacao || '',
      }

      // Cria ou atualiza conforme o modo
      await (editing.value
        ? contracts.update(editing.value.id, payload)
        : contracts.create(payload))

      dialogUpsert.value = false
    } catch (error_: any) {
      contracts.error
        = error_?.response?.data?.detail
          || error_?.response?.data
          || error_?.message
          || 'Erro ao salvar contrato.'
    }
  }

  async function removeContract (item: any) {
    confirmMessage.value = 'Excluir este contrato?'
    confirmAction.value = async () => {
      try {
        await contracts.remove(item.id)
        showSuccess('Contrato excluído com sucesso!')
      } catch (error_: any) {
        contracts.error
          = error_?.response?.data?.detail || 'Erro ao excluir contrato.'
      }
    }
    confirmVisible.value = true
  }

  // ======= Carregamento inicial =======
  async function loadAll () {
    await clientes.fetchList({ page: 1, page_size: 500 })
    await contracts.fetch({ page: 1, page_size: itemsPerPage.value })
  }
  onMounted(loadAll)
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold text-primary">Contratos</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">Cadastro e gerenciamento de contratos dos clientes</p>
      </div>
      <v-btn
        v-if="can('contratos.criar')"
        color="primary"
        prepend-icon="mdi-file-document-plus"
        @click="openCreate"
      >
        Novo contrato
      </v-btn>
    </div>

    <!-- Table card -->
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-4">
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            hide-details
            label="Buscar contratos..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 320px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" type="error">
          {{ error }}
        </v-alert>

        <!-- Lista de cards em mobile -->
        <div v-if="mobile" class="mobile-list">
          <div v-if="loading" class="text-center py-8 text-medium-emphasis">
            <v-progress-circular color="primary" indeterminate size="28" />
            <div class="mt-2 text-body-2">Carregando...</div>
          </div>
          <div v-else-if="!filteredItems.length" class="text-center py-8 text-medium-emphasis">
            <v-icon class="mb-2" icon="mdi-file-document-outline" size="36" />
            <div class="text-body-2">Nenhum contrato cadastrado</div>
          </div>
          <article v-for="item in paginatedItems" :key="item.id" class="mobile-card">
            <div class="mobile-card__actions">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
                </template>
                <v-list density="compact" min-width="160">
                  <v-list-item
                    v-if="can('contratos.editar')"
                    prepend-icon="mdi-pencil-outline"
                    title="Editar"
                    @click="openEdit(item)"
                  />
                  <v-divider v-if="can('contratos.deletar')" class="my-1" />
                  <v-list-item
                    v-if="can('contratos.deletar')"
                    class="text-error"
                    prepend-icon="mdi-delete-outline"
                    title="Excluir"
                    @click="removeContract(item)"
                  />
                </v-list>
              </v-menu>
            </div>

            <div class="mobile-card__header" style="padding-right: 36px">
              <v-avatar color="primary" size="40" variant="tonal">
                <v-icon icon="mdi-file-document-outline" size="20" />
              </v-avatar>
              <div class="mobile-card__header-text">
                <div class="mobile-card__title">{{ clienteNome(item.cliente) }}</div>
                <div v-if="item.numero_contrato" class="mobile-card__subtitle">Nº {{ item.numero_contrato }}</div>
                <div v-if="item.banco" class="mobile-card__subtitle">{{ item.banco }}</div>
              </div>
            </div>

            <div class="mobile-card__divider" />

            <div class="mobile-card__grid">
              <div class="mobile-card__field">
                <span class="mobile-card__label">Valor parcela</span>
                <span class="mobile-card__value">{{ formatValorParcela(item.valor_parcela) }}</span>
              </div>
              <div class="mobile-card__field">
                <span class="mobile-card__label">Criado em</span>
                <span class="mobile-card__value mobile-card__value--muted">{{ formatCreatedAt(item.created_at) }}</span>
              </div>
            </div>

            <div v-if="item.situacao" class="mobile-card__chips">
              <v-chip size="x-small" variant="tonal">{{ item.situacao }}</v-chip>
            </div>
          </article>

          <div v-if="filteredItems.length > mobilePageSize" class="mobile-pagination">
            <div class="mobile-pagination__info">
              {{ (mobilePage - 1) * mobilePageSize + 1 }}–{{
                Math.min(mobilePage * mobilePageSize, filteredItems.length)
              }} de {{ filteredItems.length }}
            </div>
            <v-pagination v-model="mobilePage" density="comfortable" :length="mobileTotalPages" :total-visible="4" />
          </div>
        </div>

        <v-data-table
          v-else
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.cliente="{ item }">
            {{ clienteNome(item.cliente) }}
          </template>

          <template #item.valor_parcela="{ item }">
            {{
              item.valor_parcela
                ? `R$ ${Number(item.valor_parcela).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`
                : "—"
            }}
          </template>

          <template #item.created_at="{ item }">
            {{
              item.created_at && !isNaN(new Date(item.created_at).getTime())
                ? new Date(item.created_at).toLocaleString()
                : "—"
            }}
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex ga-1 justify-end">
              <v-btn v-if="can('contratos.editar')" color="primary" icon size="small" variant="text" @click="openEdit(item)">
                <v-icon icon="mdi-pencil-outline" size="18" />
                <v-tooltip activator="parent" location="top">Editar</v-tooltip>
              </v-btn>
              <v-btn v-if="can('contratos.deletar')" color="error" icon size="small" variant="text" @click="removeContract(item)">
                <v-icon icon="mdi-delete-outline" size="18" />
                <v-tooltip activator="parent" location="top">Excluir</v-tooltip>
              </v-btn>
            </div>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-file-document-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum contrato cadastrado</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- SidePanel: criar/editar -->
    <SidePanel v-model="dialogUpsert" :width="680">
      <template #header>
        <v-icon class="mr-2" :icon="editing ? 'mdi-pencil-outline' : 'mdi-file-document-plus'" color="primary" />
        {{ editing ? "Editar contrato" : "Novo contrato" }}
      </template>

      <v-form @submit.prevent="saveUpsert">
        <v-row dense>
          <v-col cols="12" md="6">
            <v-select
              v-model="form.cliente"
              clearable
              item-title="title"
              item-value="value"
              :items="clientOptions"
              label="Cliente"
              :rules="[(v:any) => !!v || 'Obrigatório']"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.numero_contrato"
              label="Número do contrato"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="form.banco" label="Banco" />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="form.situacao" label="Situação" />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model="form.origem_averbacao"
              label="Origem de averbação"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model="form.data_inclusao"
              label="Data de inclusão"
              type="date"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model="form.data_inicio_desconto"
              label="Data início desconto"
              type="date"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model="form.data_fim_desconto"
              label="Data fim desconto"
              type="date"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="form.quantidade_parcelas"
              label="Quantidade de parcelas"
              type="number"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="form.valor_parcela"
              label="Valor da parcela"
              prefix="R$"
              step="0.01"
              type="number"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="form.iof"
              label="IOF"
              step="0.01"
              type="number"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="form.emprestado"
              label="Valor emprestado"
              prefix="R$"
              step="0.01"
              type="number"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="form.liberado"
              label="Valor liberado"
              prefix="R$"
              step="0.01"
              type="number"
            />
          </v-col>
        </v-row>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="saveUpsert">Salvar</v-btn>
      </template>
    </SidePanel>

    <ConfirmDialog
      v-model="confirmVisible"
      title="Confirmar exclusão"
      :message="confirmMessage"
      confirm-text="Excluir"
      @confirm="confirmAction?.()"
    />
  </v-container>
</template>

<style scoped></style>
