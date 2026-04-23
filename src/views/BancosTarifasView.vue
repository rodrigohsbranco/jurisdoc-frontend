<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  listBancos, createBanco, updateBanco, deleteBanco,
  listTarifas, createTarifa, updateTarifa, deleteTarifa,
  type BancoKit, type TarifaKit,
} from '@/services/bancosETarifas'

const { showSuccess, showError } = useSnackbar()

const tab = ref('bancos')
const loading = ref(false)
const pageSizeOptions = [8, 10, 25, 50]

// ── Bancos ──
const bancos = ref<BancoKit[]>([])
const bancoDialog = ref(false)
const bancoEditing = ref<BancoKit | null>(null)
const bancoForm = ref({ nome: '', ativo: true, ordem: 0 })
const bancoConfirmDelete = ref(false)
const bancoToDelete = ref<BancoKit | null>(null)
const bancoPage = ref(1)
const bancoPageSize = ref(8)
const bancoBusca = ref('')

const bancosFiltrados = computed(() => {
  const q = bancoBusca.value.trim().toLowerCase()
  if (!q) return bancos.value
  return bancos.value.filter(b => b.nome.toLowerCase().includes(q))
})

const bancosTotalPages = computed(() => Math.ceil(bancosFiltrados.value.length / bancoPageSize.value))

const bancosPaginados = computed(() => {
  const start = (bancoPage.value - 1) * bancoPageSize.value
  return bancosFiltrados.value.slice(start, start + bancoPageSize.value)
})

const bancosRange = computed(() => {
  const total = bancosFiltrados.value.length
  if (!total) return '0 registros'
  const start = (bancoPage.value - 1) * bancoPageSize.value + 1
  const end = Math.min(bancoPage.value * bancoPageSize.value, total)
  return `${start}–${end} de ${total}`
})

async function fetchBancos () {
  loading.value = true
  try { bancos.value = await listBancos() }
  catch { showError('Erro ao carregar bancos') }
  finally { loading.value = false }
}

function openBancoDialog (banco?: BancoKit) {
  if (banco) {
    bancoEditing.value = banco
    bancoForm.value = { nome: banco.nome, ativo: banco.ativo, ordem: banco.ordem }
  } else {
    bancoEditing.value = null
    bancoForm.value = { nome: '', ativo: true, ordem: 0 }
  }
  bancoDialog.value = true
}

async function saveBanco () {
  if (!bancoForm.value.nome.trim()) return
  try {
    if (bancoEditing.value) {
      await updateBanco(bancoEditing.value.id, bancoForm.value)
      showSuccess('Banco atualizado!')
    } else {
      await createBanco(bancoForm.value)
      showSuccess('Banco cadastrado!')
    }
    bancoDialog.value = false
    await fetchBancos()
  } catch { showError('Erro ao salvar banco') }
}

function confirmDeleteBanco (banco: BancoKit) {
  bancoToDelete.value = banco
  bancoConfirmDelete.value = true
}

async function doDeleteBanco () {
  if (!bancoToDelete.value) return
  try {
    await deleteBanco(bancoToDelete.value.id)
    showSuccess('Banco removido!')
    bancoConfirmDelete.value = false
    await fetchBancos()
  } catch { showError('Erro ao remover banco') }
}

// ── Tarifas ──
const tarifas = ref<TarifaKit[]>([])
const tarifaDialog = ref(false)
const tarifaEditing = ref<TarifaKit | null>(null)
const tarifaForm = ref({ nome: '', ativo: true, ordem: 0 })
const tarifaConfirmDelete = ref(false)
const tarifaToDelete = ref<TarifaKit | null>(null)
const tarifaPage = ref(1)
const tarifaPageSize = ref(8)
const tarifaBusca = ref('')

const tarifasFiltradas = computed(() => {
  const q = tarifaBusca.value.trim().toLowerCase()
  if (!q) return tarifas.value
  return tarifas.value.filter(t => t.nome.toLowerCase().includes(q))
})

const tarifasTotalPages = computed(() => Math.ceil(tarifasFiltradas.value.length / tarifaPageSize.value))

const tarifasPaginadas = computed(() => {
  const start = (tarifaPage.value - 1) * tarifaPageSize.value
  return tarifasFiltradas.value.slice(start, start + tarifaPageSize.value)
})

const tarifasRange = computed(() => {
  const total = tarifasFiltradas.value.length
  if (!total) return '0 registros'
  const start = (tarifaPage.value - 1) * tarifaPageSize.value + 1
  const end = Math.min(tarifaPage.value * tarifaPageSize.value, total)
  return `${start}–${end} de ${total}`
})

async function fetchTarifas () {
  loading.value = true
  try { tarifas.value = await listTarifas() }
  catch { showError('Erro ao carregar tarifas') }
  finally { loading.value = false }
}

function openTarifaDialog (tarifa?: TarifaKit) {
  if (tarifa) {
    tarifaEditing.value = tarifa
    tarifaForm.value = { nome: tarifa.nome, ativo: tarifa.ativo, ordem: tarifa.ordem }
  } else {
    tarifaEditing.value = null
    tarifaForm.value = { nome: '', ativo: true, ordem: 0 }
  }
  tarifaDialog.value = true
}

async function saveTarifa () {
  if (!tarifaForm.value.nome.trim()) return
  try {
    if (tarifaEditing.value) {
      await updateTarifa(tarifaEditing.value.id, tarifaForm.value)
      showSuccess('Tarifa atualizada!')
    } else {
      await createTarifa(tarifaForm.value)
      showSuccess('Tarifa cadastrada!')
    }
    tarifaDialog.value = false
    await fetchTarifas()
  } catch { showError('Erro ao salvar tarifa') }
}

function confirmDeleteTarifa (tarifa: TarifaKit) {
  tarifaToDelete.value = tarifa
  tarifaConfirmDelete.value = true
}

async function doDeleteTarifa () {
  if (!tarifaToDelete.value) return
  try {
    await deleteTarifa(tarifaToDelete.value.id)
    showSuccess('Tarifa removida!')
    tarifaConfirmDelete.value = false
    await fetchTarifas()
  } catch { showError('Erro ao remover tarifa') }
}

onMounted(async () => {
  await Promise.all([fetchBancos(), fetchTarifas()])
})
</script>

<template>
  <v-container class="page pa-6" fluid>
    <div class="d-flex align-start flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Bancos e Tarifas</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">Gerenciar bancos e tarifas utilizados nas ações dos kits</p>
      </div>
    </div>

    <v-tabs v-model="tab" color="primary">
      <v-tab value="bancos" prepend-icon="mdi-bank-outline">Bancos</v-tab>
      <v-tab value="tarifas" prepend-icon="mdi-currency-usd">Tarifas</v-tab>
    </v-tabs>

    <v-window v-model="tab" class="mt-4">
      <!-- ═══ BANCOS ═══ -->
      <v-window-item value="bancos">
        <v-row class="mb-3" dense>
          <v-col cols="12" md>
            <v-text-field
              v-model="bancoBusca"
              density="compact"
              hide-details
              placeholder="Buscar banco..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              @update:model-value="bancoPage = 1"
            />
          </v-col>
          <v-col cols="auto">
            <v-btn color="primary" prepend-icon="mdi-plus" rounded="sm" @click="openBancoDialog()">
              Novo Banco
            </v-btn>
          </v-col>
        </v-row>

        <v-progress-linear v-if="loading" indeterminate class="mb-3" />

        <v-table density="comfortable" hover>
          <thead>
            <tr>
              <th>Nome</th>
              <th class="text-center" style="width: 100px">Ordem</th>
              <th class="text-center" style="width: 100px">Ativo</th>
              <th class="text-center" style="width: 120px">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="bancosPaginados.length === 0">
              <td colspan="4" class="text-center text-medium-emphasis py-6">Nenhum banco encontrado</td>
            </tr>
            <tr v-for="banco in bancosPaginados" :key="banco.id">
              <td>{{ banco.nome }}</td>
              <td class="text-center">{{ banco.ordem }}</td>
              <td class="text-center">
                <v-chip :color="banco.ativo ? 'success' : 'default'" size="small" variant="tonal">
                  {{ banco.ativo ? 'Sim' : 'Não' }}
                </v-chip>
              </td>
              <td class="text-center">
                <v-btn density="compact" icon="mdi-pencil-outline" size="small" variant="text" @click="openBancoDialog(banco)" />
                <v-btn color="error" density="compact" icon="mdi-delete-outline" size="small" variant="text" @click="confirmDeleteBanco(banco)" />
              </td>
            </tr>
          </tbody>
        </v-table>

        <div v-if="bancosFiltrados.length > 0" class="pagination-bar mt-4 d-flex align-center flex-wrap ga-3">
          <span class="text-body-2 text-medium-emphasis">{{ bancosRange }}</span>
          <v-spacer />
          <div class="d-flex align-center ga-2">
            <span class="text-body-2 text-medium-emphasis">Linhas por página:</span>
            <v-select
              :model-value="bancoPageSize"
              density="compact"
              hide-details
              :items="pageSizeOptions"
              style="max-width: 80px"
              variant="outlined"
              @update:model-value="bancoPageSize = $event; bancoPage = 1"
            />
          </div>
          <v-pagination
            v-if="bancosTotalPages > 1"
            v-model="bancoPage"
            density="comfortable"
            :length="bancosTotalPages"
            rounded="sm"
            size="small"
            :total-visible="5"
          />
        </div>
      </v-window-item>

      <!-- ═══ TARIFAS ═══ -->
      <v-window-item value="tarifas">
        <v-row class="mb-3" dense>
          <v-col cols="12" md>
            <v-text-field
              v-model="tarifaBusca"
              density="compact"
              hide-details
              placeholder="Buscar tarifa..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              @update:model-value="tarifaPage = 1"
            />
          </v-col>
          <v-col cols="auto">
            <v-btn color="primary" prepend-icon="mdi-plus" rounded="sm" @click="openTarifaDialog()">
              Nova Tarifa
            </v-btn>
          </v-col>
        </v-row>

        <v-progress-linear v-if="loading" indeterminate class="mb-3" />

        <v-table density="comfortable" hover>
          <thead>
            <tr>
              <th>Nome</th>
              <th class="text-center" style="width: 100px">Ordem</th>
              <th class="text-center" style="width: 100px">Ativo</th>
              <th class="text-center" style="width: 120px">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="tarifasPaginadas.length === 0">
              <td colspan="4" class="text-center text-medium-emphasis py-6">Nenhuma tarifa encontrada</td>
            </tr>
            <tr v-for="tarifa in tarifasPaginadas" :key="tarifa.id">
              <td>{{ tarifa.nome }}</td>
              <td class="text-center">{{ tarifa.ordem }}</td>
              <td class="text-center">
                <v-chip :color="tarifa.ativo ? 'success' : 'default'" size="small" variant="tonal">
                  {{ tarifa.ativo ? 'Sim' : 'Não' }}
                </v-chip>
              </td>
              <td class="text-center">
                <v-btn density="compact" icon="mdi-pencil-outline" size="small" variant="text" @click="openTarifaDialog(tarifa)" />
                <v-btn color="error" density="compact" icon="mdi-delete-outline" size="small" variant="text" @click="confirmDeleteTarifa(tarifa)" />
              </td>
            </tr>
          </tbody>
        </v-table>

        <div v-if="tarifasFiltradas.length > 0" class="pagination-bar mt-4 d-flex align-center flex-wrap ga-3">
          <span class="text-body-2 text-medium-emphasis">{{ tarifasRange }}</span>
          <v-spacer />
          <div class="d-flex align-center ga-2">
            <span class="text-body-2 text-medium-emphasis">Linhas por página:</span>
            <v-select
              :model-value="tarifaPageSize"
              density="compact"
              hide-details
              :items="pageSizeOptions"
              style="max-width: 80px"
              variant="outlined"
              @update:model-value="tarifaPageSize = $event; tarifaPage = 1"
            />
          </div>
          <v-pagination
            v-if="tarifasTotalPages > 1"
            v-model="tarifaPage"
            density="comfortable"
            :length="tarifasTotalPages"
            rounded="sm"
            size="small"
            :total-visible="5"
          />
        </div>
      </v-window-item>
    </v-window>

    <!-- Dialog Banco -->
    <v-dialog v-model="bancoDialog" max-width="450">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pa-5">{{ bancoEditing ? 'Editar Banco' : 'Novo Banco' }}</v-card-title>
        <v-card-text class="px-5 pb-2">
          <v-text-field v-model="bancoForm.nome" density="compact" hide-details="auto" label="Nome do banco" variant="outlined" class="mb-3" />
          <v-text-field v-model.number="bancoForm.ordem" density="compact" hide-details="auto" label="Ordem" type="number" variant="outlined" class="mb-3" />
          <v-switch v-model="bancoForm.ativo" color="primary" hide-details label="Ativo" />
        </v-card-text>
        <v-card-actions class="pa-5 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="bancoDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :disabled="!bancoForm.nome.trim()" @click="saveBanco">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Tarifa -->
    <v-dialog v-model="tarifaDialog" max-width="450">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pa-5">{{ tarifaEditing ? 'Editar Tarifa' : 'Nova Tarifa' }}</v-card-title>
        <v-card-text class="px-5 pb-2">
          <v-text-field v-model="tarifaForm.nome" density="compact" hide-details="auto" label="Nome da tarifa" variant="outlined" class="mb-3" />
          <v-text-field v-model.number="tarifaForm.ordem" density="compact" hide-details="auto" label="Ordem" type="number" variant="outlined" class="mb-3" />
          <v-switch v-model="tarifaForm.ativo" color="primary" hide-details label="Ativo" />
        </v-card-text>
        <v-card-actions class="pa-5 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="tarifaDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :disabled="!tarifaForm.nome.trim()" @click="saveTarifa">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Delete Banco -->
    <v-dialog v-model="bancoConfirmDelete" max-width="400">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pa-5">Excluir banco?</v-card-title>
        <v-card-text class="px-5">Deseja excluir o banco <strong>{{ bancoToDelete?.nome }}</strong>?</v-card-text>
        <v-card-actions class="pa-5 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="bancoConfirmDelete = false">Cancelar</v-btn>
          <v-btn color="error" @click="doDeleteBanco">Excluir</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Delete Tarifa -->
    <v-dialog v-model="tarifaConfirmDelete" max-width="400">
      <v-card rounded="lg">
        <v-card-title class="text-h6 pa-5">Excluir tarifa?</v-card-title>
        <v-card-text class="px-5">Deseja excluir a tarifa <strong>{{ tarifaToDelete?.nome }}</strong>?</v-card-text>
        <v-card-actions class="pa-5 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="tarifaConfirmDelete = false">Cancelar</v-btn>
          <v-btn color="error" @click="doDeleteTarifa">Excluir</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.page {
  max-width: 900px;
}
</style>
