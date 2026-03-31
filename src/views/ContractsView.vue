<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useClientesStore } from '@/stores/clientes'
  import { useContractsStore } from '@/stores/contracts'
  import { useSnackbar } from '@/composables/useSnackbar'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import SidePanel from '@/components/SidePanel.vue'

  // Stores
  const contracts = useContractsStore()
  const clientes = useClientesStore()
  const { showSuccess, showError } = useSnackbar()

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
      <v-btn color="primary" prepend-icon="mdi-file-document-plus" @click="openCreate">
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

        <v-data-table
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
              <v-btn color="primary" icon size="small" variant="text" @click="openEdit(item)">
                <v-icon icon="mdi-pencil-outline" size="18" />
                <v-tooltip activator="parent" location="top">Editar</v-tooltip>
              </v-btn>
              <v-btn color="error" icon size="small" variant="text" @click="removeContract(item)">
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
