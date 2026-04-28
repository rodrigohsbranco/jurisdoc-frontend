<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAdvogadosStore, type Advogado, type OabUf } from '@/stores/advogados'
import { useSnackbar } from '@/composables/useSnackbar'
import { friendlyError, extractFieldErrors } from '@/utils/errorMessages'
import SidePanel from '@/components/SidePanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = useAdvogadosStore()
const { showSuccess, showError } = useSnackbar()

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// Busca e ordenação
const search = ref('')
const sortBy = ref<{ key: string; order?: 'asc' | 'desc' }[]>([
  { key: 'nome_completo', order: 'asc' },
])

// Dialog
const dialog = ref(false)
const editing = ref<Advogado | null>(null)
const form = ref<Partial<Advogado>>({})
const oabs = ref<OabUf[]>([])
const fieldErrors = ref<Record<string, string[]>>({})

// Confirm
const confirmVisible = ref(false)
const confirmMessage = ref('')
const confirmAction = ref<(() => void) | null>(null)

const totalAdvogados = computed(() => store.items.length)

const headers = [
  { title: 'Advogado', key: 'nome_completo' },
  { title: 'Tipo', key: 'is_socio', sortable: true },
  { title: 'UFs', key: 'total_ufs', sortable: true },
  { title: 'Status', key: 'ativo', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '48px' },
]

function getInitials (nome: string) {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function openCreate () {
  editing.value = null
  form.value = {
    nome_completo: '',
    nacionalidade: 'brasileiro',
    estado_civil: '',
    genero: 'masculino',
    is_socio: false,
    escritorio_nome: '',
    escritorio_cnpj: '',
    escritorio_endereco: '',
    ativo: true,
  }
  oabs.value = []
  fieldErrors.value = {}
  dialog.value = true
}

async function openEdit (adv: Advogado) {
  editing.value = adv
  const detail = await store.getDetail(adv.id)
  if (!detail) return
  form.value = { ...detail }
  oabs.value = detail.oabs ? detail.oabs.map(o => ({ ...o })) : []
  fieldErrors.value = {}
  dialog.value = true
}

function addOab () {
  oabs.value.push({
    uf: '',
    numero_oab: '',
    unidade_apoio_nome: '',
    unidade_apoio_endereco: '',
  })
}

function removeOab (index: number) {
  oabs.value.splice(index, 1)
}

async function save () {
  fieldErrors.value = {}
  try {
    if (!form.value.nome_completo?.trim()) {
      throw new Error('Informe o nome completo.')
    }

    const payload = { ...form.value } as any
    delete payload.oabs
    delete payload.criado_em
    delete payload.atualizado_em
    delete payload.total_ufs

    let advId: number
    if (editing.value) {
      const updated = await store.update(editing.value.id, payload)
      advId = updated.id
    } else {
      const created = await store.create(payload)
      advId = created.id
    }

    // Salvar OABs
    const detail = await store.getDetail(advId)
    const existingOabs = detail?.oabs || []

    // Remove OABs que foram removidas
    for (const existing of existingOabs) {
      const stillExists = oabs.value.find(o => o.id === existing.id)
      if (!stillExists && existing.id) {
        await store.removeOab(advId, existing.id)
      }
    }

    // Cria/atualiza OABs
    for (const oab of oabs.value) {
      if (!oab.uf || !oab.numero_oab) continue
      if (oab.id) {
        await store.updateOab(advId, oab.id, oab)
      } else {
        await store.addOab(advId, oab)
      }
    }

    await store.fetchList()
    dialog.value = false
    showSuccess(editing.value ? 'Advogado atualizado!' : 'Advogado cadastrado!')
  } catch (e: any) {
    const fields = extractFieldErrors(e)
    if (fields) {
      fieldErrors.value = fields
      return
    }
    showError(friendlyError(e))
  }
}

function confirmRemove (adv: Advogado) {
  confirmMessage.value = `Deseja excluir o advogado "${adv.nome_completo}"?`
  confirmAction.value = async () => {
    try {
      await store.remove(adv.id)
      showSuccess('Advogado excluído.')
    } catch (e: any) {
      showError(friendlyError(e))
    }
  }
  confirmVisible.value = true
}

onMounted(() => {
  store.fetchList()
})
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Advogados</h1>
          <v-chip v-if="totalAdvogados" color="primary" size="small" variant="tonal">
            {{ totalAdvogados }} {{ totalAdvogados === 1 ? 'advogado' : 'advogados' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Cadastro de advogados e OABs por região</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        Novo advogado
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
            placeholder="Buscar por nome..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-data-table
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="store.items"
          :loading="store.loading"
          loading-text="Carregando..."
          :search="search"
        >
          <!-- Advogado com avatar -->
          <template #item.nome_completo="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <span class="text-caption font-weight-bold">{{ getInitials(item.nome_completo) }}</span>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.nome_completo }}</div>
                <div v-if="item.escritorio_nome" class="text-caption text-medium-emphasis">
                  {{ item.escritorio_nome }}
                </div>
              </div>
            </div>
          </template>

          <!-- Tipo -->
          <template #item.is_socio="{ item }">
            <v-chip
              :color="item.is_socio ? 'secondary' : 'default'"
              :prepend-icon="item.is_socio ? 'mdi-shield-crown-outline' : 'mdi-account-tie-outline'"
              size="small"
              variant="tonal"
            >
              {{ item.is_socio ? 'Sócio' : 'Advogado' }}
            </v-chip>
          </template>

          <!-- UFs -->
          <template #item.total_ufs="{ item }">
            <span class="text-body-2">{{ item.total_ufs || 0 }} UF{{ (item.total_ufs || 0) !== 1 ? 's' : '' }}</span>
          </template>

          <!-- Status -->
          <template #item.ativo="{ item }">
            <v-chip
              :color="item.ativo ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ item.ativo ? 'Ativo' : 'Inativo' }}
            </v-chip>
          </template>

          <!-- Ações -->
          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-dots-vertical"
                  size="small"
                  variant="text"
                />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  @click="openEdit(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="confirmRemove(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-account-tie-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum advogado encontrado</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- SidePanel criar/editar -->
    <SidePanel v-model="dialog" :width="680">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-account-tie'" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">{{ editing ? 'Editar advogado' : 'Novo advogado' }}</div>
          <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.nome_completo }}</div>
        </div>
      </template>

      <v-form @submit.prevent="save">
        <!-- Dados do advogado -->
        <div class="text-caption text-medium-emphasis text-uppercase mb-2" style="letter-spacing: 0.05em">
          Dados do advogado
        </div>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="form.nome_completo" :error-messages="fieldErrors.nome_completo" label="Nome completo *" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.nacionalidade" label="Nacionalidade" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.estado_civil" label="Estado civil" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="form.genero" :items="[{ title: 'Masculino', value: 'masculino' }, { title: 'Feminino', value: 'feminino' }]" label="Gênero" />
          </v-col>
          <v-col cols="12" md="4">
            <v-switch v-model="form.is_socio" color="primary" density="compact" hide-details label="Sócio do escritório" />
          </v-col>
          <v-col cols="12" md="4">
            <v-switch v-model="form.ativo" color="success" density="compact" hide-details label="Ativo" />
          </v-col>
        </v-row>

        <!-- Escritório individual (não-sócios) -->
        <template v-if="!form.is_socio">
          <v-row class="mt-2" dense>
            <v-col cols="12" md="8">
              <v-text-field v-model="form.escritorio_nome" label="Nome do escritório individual" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.escritorio_cnpj" label="CNPJ" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.escritorio_endereco" label="Endereço do escritório (CNPJ)" placeholder="Endereço completo" />
            </v-col>
          </v-row>
        </template>

        <!-- OABs por UF -->
        <div class="d-flex align-center mt-6 mb-2">
          <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing: 0.05em">
            OABs por UF
          </div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" size="x-small" variant="tonal" @click="addOab">
            Adicionar
          </v-btn>
        </div>

        <div v-if="oabs.length === 0" class="text-body-2 text-medium-emphasis mb-3">
          Nenhuma OAB cadastrada.
        </div>

        <v-card v-for="(oab, i) in oabs" :key="i" class="mb-3 pa-3" rounded="sm" variant="tonal">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-bold">OAB {{ i + 1 }}</span>
            <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeOab(i)" />
          </div>
          <v-row dense>
            <v-col cols="4">
              <v-select v-model="oab.uf" :items="UF_LIST" label="UF *" />
            </v-col>
            <v-col cols="8">
              <v-text-field v-model="oab.numero_oab" label="Número OAB *" placeholder="Ex: OAB/SC nº 36672" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="oab.unidade_apoio_nome" label="Unidade de apoio" placeholder="Ex: Salvador" />
            </v-col>
            <v-col cols="8">
              <v-text-field v-model="oab.unidade_apoio_endereco" label="Endereço da unidade" placeholder="Endereço completo" />
            </v-col>
          </v-row>
        </v-card>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" prepend-icon="mdi-check" @click="save">Salvar</v-btn>
      </template>
    </SidePanel>

    <ConfirmDialog
      v-model="confirmVisible"
      :message="confirmMessage"
      confirm-text="Excluir"
      title="Confirmar exclusão"
      @confirm="confirmAction?.()"
    />
  </v-container>
</template>
