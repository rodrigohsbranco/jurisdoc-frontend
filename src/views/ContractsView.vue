<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useClientesStore } from '@/stores/clientes'
  import { useContractsStore } from '@/stores/contracts'

  // Stores
  const contracts = useContractsStore()
  const clientes = useClientesStore()

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
    if (!confirm('Excluir este contrato?')) return
    try {
      await contracts.remove(item.id)
    } catch (error_: any) {
      contracts.error
        = error_?.response?.data?.detail || 'Erro ao excluir contrato.'
    }
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
    <!-- Header -->
    <v-card class="rounded-xl mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Contratos</div>
          <div class="text-body-2 text-medium-emphasis">
            Cadastro e gerenciamento de contratos dos clientes
          </div>
        </div>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-file-document-plus"
          @click="openCreate"
        >
          Novo contrato
        </v-btn>
      </v-card-title>
    </v-card>

    <!-- Lista -->
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
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="removeContract(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum contrato cadastrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog: criar/editar -->
    <v-dialog v-model="dialogUpsert" max-width="920">
      <v-card>
        <v-card-title>
          {{ editing ? "Editar contrato" : "Novo contrato" }}
        </v-card-title>

        <v-card-text>
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
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveUpsert">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped></style>
