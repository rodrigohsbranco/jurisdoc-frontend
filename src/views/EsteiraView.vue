<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useKitsStore } from '@/stores/kits'
import type { KitDetail, KitListItem } from '@/services/kits'
import { ESTEIRA_MAP, STATUS_MAP, type KitEsteiraStatus } from '@/types/kits'

const busca = ref('')
const filtroFase = ref<KitEsteiraStatus | null>(null)
const filtroTipo = ref<string | null>(null)
const itens = ref<KitListItem[]>([])
const total = ref(0)
const pagina = ref(1)
const porPagina = ref(10)
const carregando = ref(false)

// Detalhe é carregado sob demanda, ao expandir: a listagem não traz documentos,
// e buscar o detalhe de todos os kits de antemão seria N requisições à toa.
const expandidos = ref<number[]>([])
const detalhes = ref<Record<number, KitDetail>>({})
const carregandoDetalhe = ref<Record<number, boolean>>({})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const kitsStore = useKitsStore()

const faseOptions = [
  { title: 'Aguardando esteira', value: 'aguardando' },
  { title: 'Na esteira', value: 'na_esteira' },
  { title: 'Concluído', value: 'concluido' },
]

const tipoOptions = [
  { title: 'Bancário', value: 'bancario' },
  { title: 'Previdenciário', value: 'previdenciario' },
  { title: 'Marketing', value: 'marketing' },
]

const labelsTipo: Record<string, string> = {
  bancario: 'Bancário',
  previdenciario: 'Previdenciário',
  marketing: 'Marketing',
}

const labelsVia: Record<string, { label: string; icon: string }> = {
  zapsign: { label: 'Digital', icon: 'mdi-draw' },
  presencial: { label: 'Presencial', icon: 'mdi-file-sign' },
}

const totalPaginas = computed(() => Math.ceil(total.value / porPagina.value))

const rangeText = computed(() => {
  if (total.value === 0) return 'Nenhum kit'
  const inicio = (pagina.value - 1) * porPagina.value + 1
  const fim = Math.min(pagina.value * porPagina.value, total.value)
  return `${inicio}–${fim} de ${total.value}`
})

const contadores = computed(() => ({
  aguardando: itens.value.filter(k => k.status_esteira === 'aguardando').length,
  na_esteira: itens.value.filter(k => k.status_esteira === 'na_esteira').length,
  concluido: itens.value.filter(k => k.status_esteira === 'concluido').length,
}))

async function carregar () {
  carregando.value = true
  try {
    const res = await kitsStore.fetchEsteira({
      page: pagina.value,
      page_size: porPagina.value,
      status_esteira: filtroFase.value || '',
      search: busca.value.trim() || undefined,
    })
    // O filtro de tipo é local: a fila é curta por natureza (só kits assinados
    // e ainda não consumidos), não compensa mais um parâmetro no backend.
    itens.value = filtroTipo.value
      ? res.results.filter(k => k.tipo === filtroTipo.value)
      : res.results
    total.value = res.count
    expandidos.value = []
  } finally {
    carregando.value = false
  }
}

async function alternarExpansao (kit: KitListItem) {
  const aberto = expandidos.value.includes(kit.id)
  expandidos.value = aberto
    ? expandidos.value.filter(id => id !== kit.id)
    : [...expandidos.value, kit.id]

  // Busca o detalhe uma vez só por kit; reabrir usa o que já está em memória.
  if (!aberto && !detalhes.value[kit.id] && !carregandoDetalhe.value[kit.id]) {
    carregandoDetalhe.value[kit.id] = true
    try {
      const detalhe = await kitsStore.getDetail(kit.id)
      if (detalhe) detalhes.value[kit.id] = detalhe
    } finally {
      carregandoDetalhe.value[kit.id] = false
    }
  }
}

/** Peças com assinatura comprovada — o que a aplicação externa vai baixar. */
function documentosAssinados (kitId: number) {
  const detalhe = detalhes.value[kitId]
  if (!detalhe) return []
  return (detalhe.documentos || []).filter(
    d => d.zapsign_status === 'signed' || d.tipo.startsWith('assinado_'),
  )
}

function formatarData (valor: string | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "há 3 dias" — quanto tempo o kit está parado esperando ser consumido. */
function tempoDesde (valor: string | null) {
  if (!valor) return ''
  const ms = Date.now() - new Date(valor).getTime()
  const minutos = Math.floor(ms / 60000)
  if (minutos < 1) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

function nomeArquivo (caminho: string) {
  return caminho.split('/').pop() || caminho
}

function iniciais (nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('')
}

watch(busca, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagina.value = 1
    carregar()
  }, 400)
})

watch([filtroFase, filtroTipo], () => {
  pagina.value = 1
  carregar()
})

watch([pagina, porPagina], carregar)

onMounted(carregar)

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <v-container class="esteira-index pa-6" fluid>
    <div class="d-flex align-start flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Esteira</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Kits assinados, prontos para a aplicação externa consumir
        </p>
      </div>
      <v-spacer />
      <v-btn
        :loading="carregando"
        prepend-icon="mdi-refresh"
        rounded="sm"
        variant="outlined"
        @click="carregar"
      >
        Atualizar
      </v-btn>
    </div>

    <v-row class="mb-1" dense>
      <v-col cols="12" sm="4">
        <v-card class="stat-card" rounded="sm" variant="outlined">
          <v-card-text class="d-flex align-center ga-3 py-4">
            <v-avatar class="stat-icon stat-icon--amber" rounded="sm" size="34">
              <v-icon icon="mdi-clock-outline" size="18" />
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold stat-value">{{ contadores.aguardando }}</div>
              <div class="text-caption text-medium-emphasis">Aguardando esteira</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card class="stat-card" rounded="sm" variant="outlined">
          <v-card-text class="d-flex align-center ga-3 py-4">
            <v-avatar class="stat-icon stat-icon--blue" rounded="sm" size="34">
              <v-icon icon="mdi-tray-full" size="18" />
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold stat-value">{{ contadores.na_esteira }}</div>
              <div class="text-caption text-medium-emphasis">Na esteira</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card class="stat-card" rounded="sm" variant="outlined">
          <v-card-text class="d-flex align-center ga-3 py-4">
            <v-avatar class="stat-icon stat-icon--green" rounded="sm" size="34">
              <v-icon icon="mdi-check-circle-outline" size="18" />
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold stat-value">{{ contadores.concluido }}</div>
              <div class="text-caption text-medium-emphasis">Concluídos</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-2 mb-5" dense>
      <v-col cols="12" md>
        <v-text-field
          v-model="busca"
          density="comfortable"
          hide-details
          placeholder="Buscar por nome ou CPF..."
          prepend-inner-icon="mdi-magnify"
          rounded="sm"
          variant="outlined"
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-select
          v-model="filtroFase"
          clearable
          density="comfortable"
          hide-details
          :items="faseOptions"
          label="Fase"
          prepend-inner-icon="mdi-filter-outline"
          rounded="sm"
          variant="outlined"
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-select
          v-model="filtroTipo"
          clearable
          density="comfortable"
          hide-details
          :items="tipoOptions"
          label="Tipo"
          prepend-inner-icon="mdi-tag-outline"
          rounded="sm"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <div v-if="carregando" class="text-center py-8">
      <v-progress-circular indeterminate />
    </div>

    <v-alert
      v-else-if="itens.length === 0"
      class="mb-4"
      color="info"
      icon="mdi-information-outline"
      variant="tonal"
    >
      Nenhum kit na esteira. Kits entram aqui automaticamente assim que a assinatura é confirmada.
    </v-alert>

    <v-card
      v-for="kit in itens"
      :key="kit.id"
      class="kit-row mb-3"
      rounded="sm"
      variant="outlined"
    >
      <!-- Panorama: o que dá para ler sem abrir -->
      <v-card-text
        class="d-flex align-center py-4 flex-wrap ga-2 kit-header"
        @click="alternarExpansao(kit)"
      >
        <v-avatar class="mr-3 client-avatar" size="34">{{ iniciais(kit.cliente_nome || '?') }}</v-avatar>
        <div class="kit-identidade">
          <div class="text-body-1 font-weight-bold">{{ kit.cliente_nome || 'Cliente sem nome' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ kit.cliente_cpf || '---' }} · Kit #{{ kit.id }}
            <template v-if="kit.entrou_esteira_em">
              · {{ tempoDesde(kit.entrou_esteira_em) }}
            </template>
          </div>
        </div>
        <v-spacer />
        <v-chip class="mr-1" size="small" variant="tonal">
          {{ labelsTipo[kit.tipo] || kit.tipo }}
        </v-chip>
        <v-chip
          v-if="kit.via_assinatura && labelsVia[kit.via_assinatura]"
          class="mr-1"
          :prepend-icon="labelsVia[kit.via_assinatura].icon"
          size="small"
          variant="tonal"
        >
          {{ labelsVia[kit.via_assinatura].label }}
        </v-chip>
        <v-chip
          class="mr-1"
          :color="ESTEIRA_MAP[kit.status_esteira].color"
          :prepend-icon="ESTEIRA_MAP[kit.status_esteira].icon"
          size="small"
          variant="tonal"
        >
          {{ ESTEIRA_MAP[kit.status_esteira].label }}
        </v-chip>

        <v-tooltip location="top" text="Abrir o kit">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              class="ml-1"
              density="comfortable"
              icon="mdi-open-in-new"
              size="small"
              variant="text"
              :to="{ name: 'producao-kits-editar', params: { id: kit.id } }"
              @click.stop
            />
          </template>
        </v-tooltip>

        <v-icon
          class="chevron"
          :class="{ 'chevron--aberto': expandidos.includes(kit.id) }"
          color="medium-emphasis"
          icon="mdi-chevron-down"
        />
      </v-card-text>

      <!-- Detalhes -->
      <v-expand-transition>
        <div v-if="expandidos.includes(kit.id)">
          <v-divider />
          <div class="px-4 py-4">
            <v-row dense>
              <v-col cols="12" md="6">
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Assinado e disponibilizado</span>
                  <span class="detalhe-valor">{{ formatarData(kit.entrou_esteira_em) }}</span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Assumido pela aplicação externa</span>
                  <span class="detalhe-valor">
                    {{ kit.assumido_em ? formatarData(kit.assumido_em) : 'Ainda não assumido' }}
                  </span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Baixado pela aplicação externa</span>
                  <span class="detalhe-valor">
                    {{ kit.baixado_em ? formatarData(kit.baixado_em) : 'Ainda não baixado' }}
                  </span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Kit criado em</span>
                  <span class="detalhe-valor">{{ formatarData(kit.criado_em) }}</span>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Status de produção</span>
                  <span class="detalhe-valor">
                    <v-chip
                      :color="STATUS_MAP[kit.status].color"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ STATUS_MAP[kit.status].label }}
                    </v-chip>
                  </span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Ações no kit</span>
                  <span class="detalhe-valor">{{ kit.total_acoes }}</span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-rotulo">Produzido por</span>
                  <span class="detalhe-valor">
                    {{ kit.criado_por_nome || '—' }}
                    <v-chip v-if="kit.origem === 'app'" class="ml-1" size="x-small" variant="tonal">
                      App
                    </v-chip>
                  </span>
                </div>
              </v-col>
            </v-row>

            <!-- Documentos assinados -->
            <v-divider class="my-3" />
            <div v-if="carregandoDetalhe[kit.id]" class="d-flex align-center ga-2 py-2">
              <v-progress-circular indeterminate size="18" width="2" />
              <span class="text-body-2 text-medium-emphasis">Carregando documentos...</span>
            </div>
            <template v-else-if="documentosAssinados(kit.id).length">
              <div class="text-caption text-medium-emphasis mb-2">
                Documentos assinados ({{ documentosAssinados(kit.id).length }})
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="doc in documentosAssinados(kit.id)"
                  :key="doc.id"
                  :href="doc.arquivo"
                  prepend-icon="mdi-file-pdf-box"
                  size="small"
                  target="_blank"
                  variant="outlined"
                >
                  {{ nomeArquivo(doc.arquivo) }}
                </v-chip>
              </div>
            </template>
            <div v-else class="text-body-2 text-medium-emphasis">
              Nenhum documento assinado anexado.
            </div>
          </div>
        </div>
      </v-expand-transition>
    </v-card>

    <div v-if="total > 0" class="pagination-bar mt-5 d-flex align-center flex-wrap ga-3">
      <span class="text-body-2 text-medium-emphasis">{{ rangeText }}</span>
      <v-spacer />
      <div class="d-flex align-center ga-2">
        <span class="text-body-2 text-medium-emphasis">Linhas por página:</span>
        <v-select
          v-model="porPagina"
          density="compact"
          hide-details
          :items="[10, 25, 50]"
          style="max-width: 80px"
          variant="outlined"
        />
      </div>
      <v-pagination
        v-if="totalPaginas > 1"
        v-model="pagina"
        density="comfortable"
        :length="totalPaginas"
        rounded="sm"
        size="small"
        :total-visible="5"
      />
    </div>
  </v-container>
</template>

<style scoped>
.esteira-index {
  max-width: 1260px;
}

.stat-card,
.kit-row {
  border-color: #e8e8ef !important;
  background: #fff;
}

.kit-header {
  cursor: pointer;
}

.kit-header:hover {
  background: #fafbfd;
}

.kit-identidade {
  min-width: 0;
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron--aberto {
  transform: rotate(180deg);
}

.detalhe-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 6px 0;
}

.detalhe-rotulo {
  font-size: 0.8125rem;
  color: rgba(0, 0, 0, 0.6);
}

.detalhe-valor {
  font-size: 0.875rem;
  font-weight: 500;
  text-align: right;
}

.stat-icon--amber {
  background: #fff7e8;
  color: #bb7a00;
}

.stat-icon--blue {
  background: #eef3ff;
  color: #214ea0;
}

.stat-icon--green {
  background: #ecf9f0;
  color: #1b8b4b;
}

.stat-value {
  line-height: 1;
}

.client-avatar {
  background: #f1f3f9;
  color: #4a5a82;
  font-weight: 700;
}
</style>
