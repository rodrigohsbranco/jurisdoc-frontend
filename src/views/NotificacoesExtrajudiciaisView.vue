<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import SidePanel from '@/components/SidePanel.vue'
import {
  listAllKits,
  getNotificacaoPdf,
  marcarNotificacaoEnviada,
  type KitListItem,
} from '@/services/kits'
import { useSnackbar } from '@/composables/useSnackbar'
import { friendlyError } from '@/utils/errorMessages'

const { showSuccess, showError } = useSnackbar()

const loading = ref(false)
const kits = ref<KitListItem[]>([])
const acaoLoading = ref<Record<number, boolean>>({})

// Painel lateral de visualização do PDF
const panelOpen = ref(false)
const panelKit = ref<KitListItem | null>(null)
const panelLoading = ref(false)
const panelPdfUrl = ref('')
const panelBlob = ref<Blob | null>(null)
const panelError = ref('')

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

function nomeArquivo (kit: KitListItem): string {
  return `notificacao_extrajudicial_${kit.cliente_nome}.pdf`
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

function revokePanelUrl () {
  if (panelPdfUrl.value) {
    URL.revokeObjectURL(panelPdfUrl.value)
    panelPdfUrl.value = ''
  }
}

async function visualizar (kit: KitListItem) {
  revokePanelUrl()
  panelKit.value = kit
  panelBlob.value = null
  panelError.value = ''
  panelOpen.value = true
  panelLoading.value = true
  try {
    const blob = await getNotificacaoPdf(kit.id, false)
    panelBlob.value = blob
    panelPdfUrl.value = URL.createObjectURL(blob)
  } catch (e: any) {
    // Mantém o drawer aberto e mostra o erro dentro dele.
    panelError.value = await blobErrorMessage(e)
  } finally {
    panelLoading.value = false
  }
}

function baixarDoPanel () {
  if (panelBlob.value && panelKit.value) {
    baixarBlob(panelBlob.value, nomeArquivo(panelKit.value))
  }
}

async function baixar (kit: KitListItem) {
  acaoLoading.value[kit.id] = true
  try {
    const blob = await getNotificacaoPdf(kit.id, true)
    baixarBlob(blob, nomeArquivo(kit))
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

// Libera o blob URL ao fechar o painel
watch(panelOpen, v => {
  if (!v) {
    revokePanelUrl()
    panelBlob.value = null
    panelKit.value = null
    panelError.value = ''
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
            <v-tooltip location="top" text="Visualizar documento">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-eye-outline"
                  size="small"
                  variant="text"
                  :loading="acaoLoading[item.id]"
                  @click="visualizar(item)"
                />
              </template>
            </v-tooltip>
            <v-tooltip location="top" text="Baixar documento">
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

    <!-- Painel lateral: visualização do PDF da notificação -->
    <SidePanel v-model="panelOpen" :width="820">
      <template #header>
        <div class="d-flex align-center ga-3">
          <v-icon color="primary" icon="mdi-email-alert-outline" />
          <div>
            <div class="text-subtitle-1 font-weight-bold">Notificação Extrajudicial</div>
            <div class="text-body-2 text-medium-emphasis">{{ panelKit?.cliente_nome }}</div>
          </div>
        </div>
      </template>

      <div
        v-if="panelLoading"
        class="d-flex flex-column align-center justify-center"
        style="height: 100%; min-height: 320px;"
      >
        <v-progress-circular color="primary" indeterminate size="40" />
        <span class="text-body-2 text-medium-emphasis mt-3">Gerando documento...</span>
      </div>
      <div
        v-else-if="panelError"
        class="d-flex flex-column align-center justify-center text-center"
        style="height: 100%; min-height: 320px;"
      >
        <v-icon color="error" icon="mdi-alert-circle-outline" size="48" />
        <h3 class="text-subtitle-1 font-weight-medium mt-3 mb-1">Não foi possível gerar o documento</h3>
        <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 460px;">{{ panelError }}</p>
        <v-btn
          v-if="panelKit"
          color="primary"
          prepend-icon="mdi-refresh"
          variant="tonal"
          @click="visualizar(panelKit)"
        >
          Tentar novamente
        </v-btn>
      </div>
      <iframe
        v-else-if="panelPdfUrl"
        :src="`${panelPdfUrl}#toolbar=0&navpanes=0&view=FitH`"
        class="notif-pdf-frame"
        title="Notificação Extrajudicial"
      />

      <template #actions>
        <v-btn variant="text" @click="panelOpen = false">Fechar</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-download"
          :disabled="!panelBlob"
          @click="baixarDoPanel"
        >
          Baixar
        </v-btn>
      </template>
    </SidePanel>
  </v-container>
</template>

<style scoped>
.notif-pdf-frame {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 210px);
  border: none;
  display: block;
}
</style>
