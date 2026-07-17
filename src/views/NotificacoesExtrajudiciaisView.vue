<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SidePanel from '@/components/SidePanel.vue'
import {
  listAllKits,
  listNotificacoes,
  getNotificacaoPdf,
  marcarNotificacaoEnviada,
  type KitListItem,
  type NotificacaoDoc,
} from '@/services/kits'
import { useSnackbar } from '@/composables/useSnackbar'
import { friendlyError } from '@/utils/errorMessages'

const { showSuccess, showError } = useSnackbar()

const loading = ref(false)
const kits = ref<KitListItem[]>([])
const acaoLoading = ref<Record<number, boolean>>({})

// Painel lateral com abas (uma notificação por ação)
const panelOpen = ref(false)
const panelKit = ref<KitListItem | null>(null)
const panelDocs = ref<NotificacaoDoc[]>([])
const panelTab = ref<number | null>(null)
const panelListLoading = ref(false)
const panelListError = ref('')

type DocState = { loading: boolean, error: string, url: string, blob: Blob | null }
const docState = ref<Record<number, DocState>>({})

const currentBlob = computed(() =>
  panelTab.value != null ? docState.value[panelTab.value]?.blob ?? null : null,
)

const headers = [
  { title: 'Cliente', key: 'cliente_nome' },
  { title: 'CPF', key: 'cliente_cpf', width: 160 },
  { title: 'Tipo', key: 'tipo', width: 150 },
  { title: 'Notificação', key: 'notificacao_enviada', sortable: false, width: 200 },
  { title: 'Ações', key: 'acoes', sortable: false, width: 160 },
]

const TIPO_LABEL: Record<string, string> = {
  bancario: 'Bancário',
  previdenciario: 'Previdenciário',
  marketing: 'Marketing',
}

async function carregar () {
  loading.value = true
  try {
    kits.value = await listAllKits({ status: 'assinado', ordering: '-atualizado_em' })
  } catch (e: any) {
    showError(friendlyError(e))
  } finally {
    loading.value = false
  }
}

/** Quando responseType='blob', o corpo de erro também vem como Blob — extrai o detail. */
async function blobErrorMessage (e: any): Promise<string> {
  const data = e?.response?.data
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text())
      if (json?.detail) return json.detail
    } catch { /* não era JSON */ }
  }
  return friendlyError(e)
}

function baixarBlob (blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function resetPanel () {
  for (const k of Object.keys(docState.value)) {
    const u = docState.value[Number(k)]?.url
    if (u) URL.revokeObjectURL(u)
  }
  docState.value = {}
  panelDocs.value = []
  panelTab.value = null
  panelListError.value = ''
}

async function loadDoc (acaoId: number) {
  const kit = panelKit.value
  if (!kit) return
  const st = docState.value[acaoId]
  if (st && (st.url || st.loading)) return
  docState.value = { ...docState.value, [acaoId]: { loading: true, error: '', url: '', blob: null } }
  try {
    const blob = await getNotificacaoPdf(kit.id, { acaoId })
    docState.value = {
      ...docState.value,
      [acaoId]: { loading: false, error: '', url: URL.createObjectURL(blob), blob },
    }
  } catch (e: any) {
    docState.value = {
      ...docState.value,
      [acaoId]: { loading: false, error: await blobErrorMessage(e), url: '', blob: null },
    }
  }
}

async function visualizar (kit: KitListItem) {
  resetPanel()
  panelKit.value = kit
  panelOpen.value = true
  panelListLoading.value = true
  try {
    const docs = await listNotificacoes(kit.id)
    if (!docs.length) {
      panelListError.value = 'Nenhuma ação deste kit tem tipo de notificação definido ainda.'
      return
    }
    panelDocs.value = docs
    panelTab.value = docs[0].acao_id
    await loadDoc(docs[0].acao_id)
  } catch (e: any) {
    panelListError.value = friendlyError(e)
  } finally {
    panelListLoading.value = false
  }
}

// Carrega o PDF da aba ao trocar (lazy)
watch(panelTab, id => {
  if (id != null) loadDoc(id)
})

function docLabel (d: NotificacaoDoc): string {
  const base = d.banco ? `${d.tipo_acao_display} — ${d.banco}` : d.tipo_acao_display
  return d.qtd_contratos > 1 ? `${base} (${d.qtd_contratos} contratos)` : base
}

function baixarDoPanel () {
  const id = panelTab.value
  const kit = panelKit.value
  if (id == null || !kit) return
  const blob = docState.value[id]?.blob
  const doc = panelDocs.value.find(d => d.acao_id === id)
  if (blob && doc) {
    baixarBlob(blob, `notificacao_${doc.tipo_acao}_${kit.cliente_nome}.pdf`)
  }
}

/** Baixa TODAS as notificações do kit combinadas num PDF (botão da linha). */
async function baixar (kit: KitListItem) {
  acaoLoading.value[kit.id] = true
  try {
    const blob = await getNotificacaoPdf(kit.id, { download: true })
    baixarBlob(blob, `notificacao_extrajudicial_${kit.cliente_nome}.pdf`)
  } catch (e: any) {
    showError(await blobErrorMessage(e))
  } finally {
    acaoLoading.value[kit.id] = false
  }
}

async function toggleEnviada (kit: KitListItem) {
  const novo = !kit.notificacao_enviada
  acaoLoading.value[kit.id] = true
  try {
    const res = await marcarNotificacaoEnviada(kit.id, novo)
    kit.notificacao_enviada = res.notificacao_enviada
    kit.notificacao_enviada_em = res.notificacao_enviada_em
    showSuccess(novo ? 'Notificação marcada como enviada ao banco.' : 'Marcação de envio removida.')
  } catch (e: any) {
    showError(friendlyError(e))
  } finally {
    acaoLoading.value[kit.id] = false
  }
}

function fmtData (iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : ''
}

watch(panelOpen, v => {
  if (!v) {
    resetPanel()
    panelKit.value = null
  }
})

onMounted(carregar)
</script>

<template>
  <v-container class="notificacoes-extrajudiciais pa-6" fluid>
    <div class="d-flex align-start flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Notificações Extrajudiciais</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Kits assinados — geração do documento e controle de envio ao banco
        </p>
      </div>
      <v-spacer />
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="carregar">
        Atualizar
      </v-btn>
    </div>

    <v-card rounded="lg" variant="outlined">
      <v-data-table
        :headers="headers"
        :items="kits"
        :loading="loading"
        :items-per-page="25"
        no-data-text="Nenhum kit assinado encontrado."
      >
        <template #item.tipo="{ item }">
          {{ TIPO_LABEL[item.tipo] || item.tipo }}
        </template>

        <template #item.notificacao_enviada="{ item }">
          <v-chip
            :color="item.notificacao_enviada ? 'success' : 'grey'"
            size="small"
            variant="tonal"
          >
            <v-icon start :icon="item.notificacao_enviada ? 'mdi-check' : 'mdi-clock-outline'" />
            {{ item.notificacao_enviada
              ? (item.notificacao_enviada_em ? `Enviada em ${fmtData(item.notificacao_enviada_em)}` : 'Enviada')
              : 'Pendente' }}
          </v-chip>
        </template>

        <template #item.acoes="{ item }">
          <div class="d-flex justify-start ga-1">
            <v-tooltip location="top" text="Visualizar documentos">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-eye-outline"
                  size="small"
                  variant="text"
                  @click="visualizar(item)"
                />
              </template>
            </v-tooltip>
            <v-tooltip location="top" text="Baixar (todas as notificações)">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-download"
                  size="small"
                  variant="text"
                  :loading="acaoLoading[item.id]"
                  @click="baixar(item)"
                />
              </template>
            </v-tooltip>
            <v-tooltip
              location="top"
              :text="item.notificacao_enviada ? 'Desmarcar envio ao banco' : 'Marcar como enviada ao banco'"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  :icon="item.notificacao_enviada ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'"
                  :color="item.notificacao_enviada ? 'success' : undefined"
                  size="small"
                  variant="text"
                  :loading="acaoLoading[item.id]"
                  @click="toggleEnviada(item)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Painel lateral: notificações do kit em abas (uma por ação) -->
    <SidePanel v-model="panelOpen" :width="860">
      <template #header>
        <div class="d-flex align-center ga-3">
          <v-icon color="primary" icon="mdi-email-alert-outline" />
          <div>
            <div class="text-subtitle-1 font-weight-bold">Notificações Extrajudiciais</div>
            <div class="text-body-2 text-medium-emphasis">{{ panelKit?.cliente_nome }}</div>
          </div>
        </div>
      </template>

      <div
        v-if="panelListLoading"
        class="d-flex flex-column align-center justify-center"
        style="height: 100%; min-height: 320px;"
      >
        <v-progress-circular color="primary" indeterminate size="40" />
        <span class="text-body-2 text-medium-emphasis mt-3">Carregando notificações...</span>
      </div>

      <div
        v-else-if="panelListError"
        class="d-flex flex-column align-center justify-center text-center"
        style="height: 100%; min-height: 320px;"
      >
        <v-icon color="warning" icon="mdi-information-outline" size="48" />
        <p class="text-body-2 text-medium-emphasis mt-3 mb-0" style="max-width: 460px;">{{ panelListError }}</p>
      </div>

      <template v-else>
        <v-tabs v-model="panelTab" density="compact" show-arrows>
          <v-tab v-for="d in panelDocs" :key="d.acao_id" :value="d.acao_id">
            {{ docLabel(d) }}
          </v-tab>
        </v-tabs>

        <v-window v-model="panelTab" class="mt-2">
          <v-window-item v-for="d in panelDocs" :key="d.acao_id" :value="d.acao_id">
            <div
              v-if="docState[d.acao_id]?.loading"
              class="d-flex flex-column align-center justify-center"
              style="min-height: 300px;"
            >
              <v-progress-circular color="primary" indeterminate size="36" />
              <span class="text-body-2 text-medium-emphasis mt-3">Gerando documento...</span>
            </div>
            <div
              v-else-if="docState[d.acao_id]?.error"
              class="d-flex flex-column align-center justify-center text-center"
              style="min-height: 300px;"
            >
              <v-icon color="error" icon="mdi-alert-circle-outline" size="44" />
              <h3 class="text-subtitle-2 font-weight-medium mt-3 mb-1">Não foi possível gerar o documento</h3>
              <p class="text-body-2 text-medium-emphasis mb-3" style="max-width: 460px;">{{ docState[d.acao_id]?.error }}</p>
              <v-btn color="primary" prepend-icon="mdi-refresh" size="small" variant="tonal" @click="loadDoc(d.acao_id)">
                Tentar novamente
              </v-btn>
            </div>
            <iframe
              v-else-if="docState[d.acao_id]?.url"
              :src="`${docState[d.acao_id]?.url}#toolbar=0&navpanes=0&view=FitH`"
              class="notif-pdf-frame"
              title="Notificação Extrajudicial"
            />
          </v-window-item>
        </v-window>
      </template>

      <template #actions>
        <v-btn variant="text" @click="panelOpen = false">Fechar</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-download"
          :disabled="!currentBlob"
          @click="baixarDoPanel"
        >
          Baixar esta
        </v-btn>
      </template>
    </SidePanel>
  </v-container>
</template>

<style scoped>
.notif-pdf-frame {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 260px);
  border: none;
  display: block;
}
</style>
