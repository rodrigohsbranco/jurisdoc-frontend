<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useClausulasStore } from '@/stores/clausulas'
import type { ClausulaUF, ClausulaResolved } from '@/services/clausulas'
import { useSnackbar } from '@/composables/useSnackbar'
import { friendlyError } from '@/utils/errorMessages'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SidePanel from '@/components/SidePanel.vue'

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const store = useClausulasStore()
const { showSuccess } = useSnackbar()
const { smAndDown: mobile } = useDisplay()

// ── Padrão ─────────────────────────────────────────────────
const padraoTexto = ref('')
const padraoLocalError = ref('')
const padraoSaving = ref(false)

watch(() => store.padrao?.texto, val => {
  padraoTexto.value = val ?? ''
}, { immediate: true })

async function salvarPadrao () {
  padraoLocalError.value = ''
  padraoSaving.value = true
  try {
    await store.savePadrao(padraoTexto.value)
    showSuccess('Texto padrão salvo com sucesso!')
  } catch (error: any) {
    padraoLocalError.value = friendlyError(error, 'clausulas', 'update')
  } finally {
    padraoSaving.value = false
  }
}

// ── Exceções (CRUD) ────────────────────────────────────────
const sidePanelOpen = ref(false)
const editing = ref<ClausulaUF | null>(null)
const form = ref<{ uf: string; texto: string }>({ uf: '', texto: '' })
const formError = ref('')

const ufOptionsParaNovo = computed(() => {
  const usadas = new Set(store.ufsCadastradas)
  return UF_LIST.filter(uf => !usadas.has(uf))
})

const ufOptionsParaForm = computed(() =>
  editing.value ? UF_LIST : ufOptionsParaNovo.value,
)

function abrirNovo () {
  editing.value = null
  form.value = { uf: '', texto: '' }
  formError.value = ''
  sidePanelOpen.value = true
}

function abrirEdicao (item: ClausulaUF) {
  editing.value = item
  form.value = { uf: item.uf, texto: item.texto }
  formError.value = ''
  sidePanelOpen.value = true
}

async function salvarExcecao () {
  formError.value = ''
  const uf = (form.value.uf || '').trim().toUpperCase()
  const texto = form.value.texto?.trim() || ''
  if (!uf) {
    formError.value = 'Selecione uma UF.'
    return
  }
  if (!texto) {
    formError.value = 'Informe o texto da cláusula.'
    return
  }
  try {
    if (editing.value) {
      await store.updateUf(editing.value.id, { uf, texto })
      showSuccess('Variação atualizada!')
    } else {
      await store.createUf({ uf, texto })
      showSuccess('Variação criada!')
    }
    sidePanelOpen.value = false
  } catch (error: any) {
    formError.value = friendlyError(error, 'clausulas', editing.value ? 'update' : 'create')
  }
}

// ── Excluir ────────────────────────────────────────────────
const confirmVisible = ref(false)
const confirmMessage = ref('')
const confirmAction = ref<(() => void) | null>(null)

function removerExcecao (item: ClausulaUF) {
  confirmMessage.value = `Excluir a variação da UF "${item.uf}"? A UF voltará a usar o texto padrão.`
  confirmAction.value = async () => {
    try {
      await store.removeUf(item.id)
      showSuccess('Variação excluída!')
    } catch (error: any) {
      formError.value = friendlyError(error, 'clausulas', 'remove')
    }
  }
  confirmVisible.value = true
}

// ── Preview de resolução ───────────────────────────────────
const previewUf = ref('')
const previewResult = ref<ClausulaResolved | null>(null)
const previewLoading = ref(false)

async function fazerPreview () {
  const uf = (previewUf.value || '').trim().toUpperCase()
  if (!uf) return
  previewLoading.value = true
  try {
    previewResult.value = await store.resolve(uf)
  } finally {
    previewLoading.value = false
  }
}

// ── Tabela / mobile cards ──────────────────────────────────
const headers = [
  { title: 'UF', key: 'uf', width: 80 },
  { title: 'Texto', key: 'texto' },
  { title: 'Última alteração', key: 'atualizado_em', width: 220 },
  { title: '', key: 'actions', sortable: false, width: '48px' },
]

function formatDate (iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

function truncate (s: string, n = 80) {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n).trim()}…` : s
}

// Paginação local mobile (10/página) — segue padrão das outras views.
const mobilePage = ref(1)
const mobilePageSize = 10
const mobileTotalPages = computed(() => Math.max(1, Math.ceil(store.ufs.length / mobilePageSize)))
const paginatedItems = computed(() => {
  const start = (mobilePage.value - 1) * mobilePageSize
  return store.ufs.slice(start, start + mobilePageSize)
})
watch(() => store.ufs.length, () => { mobilePage.value = 1 })

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold text-primary">Cláusula de porcentagem</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Texto da cláusula injetada no contrato do kit. O sistema escolhe a variação por UF do cliente
          (ou cai no padrão) e congela snapshot no momento da geração do .docx.
        </p>
      </div>
    </div>

    <v-alert v-if="store.error" class="mb-4" closable type="error" @click:close="store.error = ''">
      {{ store.error }}
    </v-alert>

    <!-- Card: texto padrão -->
    <v-card class="mb-5">
      <v-card-text>
        <div class="d-flex align-center mb-3">
          <v-icon class="mr-2" color="primary" icon="mdi-text-box-outline" />
          <div class="text-subtitle-1 font-weight-bold">Texto padrão</div>
        </div>

        <v-alert
          v-if="!store.loading && !padraoTexto"
          class="mb-3"
          density="compact"
          type="warning"
          variant="tonal"
        >
          O texto padrão está vazio. Kits cujo cliente não tem UF com variação cadastrada gerarão
          contratos sem cláusula. Recomenda-se preencher um texto base.
        </v-alert>

        <v-alert v-if="padraoLocalError" class="mb-3" closable type="error" @click:close="padraoLocalError = ''">
          {{ padraoLocalError }}
        </v-alert>

        <v-textarea
          v-model="padraoTexto"
          auto-grow
          :disabled="store.loading"
          label="Cláusula padrão"
          rows="5"
        />

        <div class="d-flex align-center flex-wrap ga-3 mt-3">
          <div class="text-caption text-medium-emphasis">
            Última alteração: <strong>{{ formatDate(store.padrao?.atualizado_em) }}</strong>
            <span v-if="store.padrao?.atualizado_por_nome"> por {{ store.padrao.atualizado_por_nome }}</span>
          </div>
          <v-spacer />
          <v-btn
            color="primary"
            :loading="padraoSaving"
            prepend-icon="mdi-content-save-outline"
            @click="salvarPadrao"
          >
            Salvar padrão
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Card: exceções por UF -->
    <v-card class="mb-5">
      <v-card-text>
        <div class="d-flex align-center flex-wrap ga-3 mb-4">
          <v-icon color="primary" icon="mdi-map-marker-outline" />
          <div class="text-subtitle-1 font-weight-bold">Exceções por UF</div>
          <v-chip v-if="store.ufs.length" color="primary" size="small" variant="tonal">
            {{ store.ufs.length }} cadastrada{{ store.ufs.length !== 1 ? 's' : '' }}
          </v-chip>
          <v-spacer />
          <v-btn
            color="primary"
            :disabled="!ufOptionsParaNovo.length"
            prepend-icon="mdi-plus"
            @click="abrirNovo"
          >
            Nova UF
          </v-btn>
        </div>

        <!-- Mobile: cards -->
        <div v-if="mobile" class="mobile-list">
          <div v-if="store.loading" class="text-center py-8 text-medium-emphasis">
            <v-progress-circular color="primary" indeterminate size="28" />
            <div class="mt-2 text-body-2">Carregando...</div>
          </div>
          <div v-else-if="!store.ufs.length" class="text-center py-8 text-medium-emphasis">
            <v-icon class="mb-2" icon="mdi-map-marker-off-outline" size="36" />
            <div class="text-body-2">Nenhuma variação cadastrada</div>
          </div>
          <article v-for="item in paginatedItems" :key="item.id" class="mobile-card">
            <div class="mobile-card__actions">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
                </template>
                <v-list density="compact" min-width="180">
                  <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="abrirEdicao(item)" />
                  <v-divider class="my-1" />
                  <v-list-item
                    class="text-error"
                    prepend-icon="mdi-delete-outline"
                    title="Excluir"
                    @click="removerExcecao(item)"
                  />
                </v-list>
              </v-menu>
            </div>

            <div class="mobile-card__header" style="padding-right: 36px">
              <v-avatar color="primary" size="40" variant="tonal">
                <span class="font-weight-bold">{{ item.uf }}</span>
              </v-avatar>
              <div class="mobile-card__header-text">
                <div class="mobile-card__title">UF {{ item.uf }}</div>
                <div class="mobile-card__subtitle">{{ truncate(item.texto, 120) }}</div>
              </div>
            </div>

            <div class="mobile-card__divider" />

            <div class="mobile-card__grid mobile-card__grid--full">
              <div class="mobile-card__field">
                <span class="mobile-card__label">Última alteração</span>
                <span class="mobile-card__value mobile-card__value--muted">
                  {{ formatDate(item.atualizado_em) }}
                  <span v-if="item.atualizado_por_nome"> por {{ item.atualizado_por_nome }}</span>
                </span>
              </div>
            </div>
          </article>

          <div v-if="store.ufs.length > mobilePageSize" class="mobile-pagination">
            <div class="mobile-pagination__info">
              {{ (mobilePage - 1) * mobilePageSize + 1 }}–{{
                Math.min(mobilePage * mobilePageSize, store.ufs.length)
              }} de {{ store.ufs.length }}
            </div>
            <v-pagination v-model="mobilePage" density="comfortable" :length="mobileTotalPages" :total-visible="4" />
          </div>
        </div>

        <!-- Desktop: tabela -->
        <v-data-table
          v-else
          :headers="headers"
          item-key="id"
          :items="store.ufs"
          :loading="store.loading"
          loading-text="Carregando..."
        >
          <template #item.uf="{ item }">
            <v-chip color="primary" size="small" variant="tonal">{{ item.uf }}</v-chip>
          </template>

          <template #item.texto="{ item }">
            <span class="text-body-2">{{ truncate(item.texto, 140) }}</span>
          </template>

          <template #item.atualizado_em="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ formatDate(item.atualizado_em) }}</span>
            <div v-if="item.atualizado_por_nome" class="text-caption text-medium-emphasis">
              por {{ item.atualizado_por_nome }}
            </div>
          </template>

          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
              </template>
              <v-list density="compact" min-width="180">
                <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="abrirEdicao(item)" />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="removerExcecao(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-map-marker-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhuma variação cadastrada</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Card: preview de resolução -->
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-3">
          <v-icon class="mr-2" color="primary" icon="mdi-magnify" />
          <div class="text-subtitle-1 font-weight-bold">Pré-visualizar resolução</div>
        </div>
        <div class="text-caption text-medium-emphasis mb-3">
          Simula qual texto seria injetado para uma UF (sem afetar nenhum kit).
        </div>

        <div class="d-flex align-center flex-wrap ga-3">
          <v-autocomplete
            v-model="previewUf"
            :items="UF_LIST"
            label="UF"
            style="max-width: 180px"
          />
          <v-btn
            color="primary"
            :disabled="!previewUf"
            :loading="previewLoading"
            prepend-icon="mdi-eye-outline"
            @click="fazerPreview"
          >
            Resolver
          </v-btn>
        </div>

        <div v-if="previewResult" class="mt-4">
          <div class="d-flex align-center ga-2 mb-2">
            <v-chip color="primary" size="small" variant="tonal">{{ previewResult.uf || '—' }}</v-chip>
            <v-chip
              :color="previewResult.fonte === 'uf' ? 'success' : 'warning'"
              size="small"
              variant="tonal"
            >
              Fonte: {{ previewResult.fonte === 'uf' ? 'Variação UF' : 'Texto padrão' }}
            </v-chip>
          </div>
          <v-sheet class="pa-3 text-body-2" rounded color="grey-lighten-4" style="white-space: pre-wrap">
            {{ previewResult.texto || '(vazio)' }}
          </v-sheet>
        </div>
      </v-card-text>
    </v-card>

    <!-- SidePanel: criar/editar -->
    <SidePanel v-model="sidePanelOpen" :width="640">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-plus'" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">
            {{ editing ? `Editar variação ${editing.uf}` : 'Nova variação por UF' }}
          </div>
        </div>
      </template>

      <v-alert v-if="formError" class="mb-3" closable type="error" @click:close="formError = ''">
        {{ formError }}
      </v-alert>

      <v-autocomplete
        v-model="form.uf"
        :disabled="!!editing"
        :items="ufOptionsParaForm"
        label="UF"
      />
      <v-textarea
        v-model="form.texto"
        auto-grow
        class="mt-3"
        label="Texto da cláusula"
        rows="6"
      />

      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="sidePanelOpen = false">Cancelar</v-btn>
        <v-btn
          color="primary"
          :loading="store.loadingMutation"
          prepend-icon="mdi-content-save-outline"
          @click="salvarExcecao"
        >
          Salvar
        </v-btn>
      </template>
    </SidePanel>

    <ConfirmDialog
      v-model="confirmVisible"
      :message="confirmMessage"
      title="Confirmar exclusão"
      confirm-text="Excluir"
      @confirm="confirmAction?.()"
    />
  </v-container>
</template>
