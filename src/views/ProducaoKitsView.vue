<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useKitsStore } from '@/stores/kits'
import { useAuthStore } from '@/stores/auth'
import { listUsers, type User } from '@/services/users'

type StatusKit = 'rascunho' | 'em_andamento' | 'pend_assinatura' | 'assinado'
type KitItem = {
  id: number
  cliente: string
  cpf: string
  status: StatusKit
  criadoPorNome: string
}

const busca = ref('')
const kitsStore = useKitsStore()
const authStore = useAuthStore()

const usuarios = ref<User[]>([])
const filtroCriadoPor = ref<number | null>(null)

async function carregarUsuarios () {
  if (!authStore.isAdmin) return
  usuarios.value = await listUsers({})
}

watch(filtroCriadoPor, async () => {
  const params: Record<string, any> = {}
  if (filtroCriadoPor.value) params.criado_por = filtroCriadoPor.value
  await kitsStore.fetchList(params)
})

const labelsStatus: Record<StatusKit, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  pend_assinatura: 'Pend. assinatura',
  assinado: 'Assinado',
}

const filteredKits = computed(() => {
  const kits = kitsStore.items.map(k => ({
    id: k.id,
    cliente: k.cliente_nome || 'Cliente sem nome',
    cpf: k.cliente_cpf || '---',
    status: k.status === 'acoes'
      ? 'em_andamento'
      : k.status === 'finalizado'
        ? 'pend_assinatura'
        : k.status === 'assinado'
          ? 'assinado'
          : 'rascunho',
    criadoPorNome: k.criado_por_nome || '',
  })) as KitItem[]
  const q = busca.value.trim().toLowerCase()
  if (!q) return kits
  return kits.filter(kit =>
    kit.cliente.toLowerCase().includes(q) ||
    kit.cpf.toLowerCase().includes(q),
  )
})

const totalClientes = computed(() => kitsStore.stats.total)
const totalEmAndamento = computed(() => kitsStore.stats.emAndamento)
const totalPendAssinatura = computed(() => kitsStore.stats.pendentes)
const totalAssinados = computed(() => kitsStore.stats.assinados)

const statCards = computed(() => [
  {
    label: 'Total de clientes',
    value: totalClientes.value,
    icon: 'mdi-account-group-outline',
    tone: 'blue',
  },
  {
    label: 'Em andamento',
    value: totalEmAndamento.value,
    icon: 'mdi-file-document-edit-outline',
    tone: 'amber',
  },
  {
    label: 'Pend. assinatura',
    value: totalPendAssinatura.value,
    icon: 'mdi-pencil-outline',
    tone: 'amber-soft',
  },
  {
    label: 'Assinados',
    value: totalAssinados.value,
    icon: 'mdi-scale-balance',
    tone: 'green',
  },
])

function statusColor (status: StatusKit) {
  if (status === 'rascunho') return 'default'
  if (status === 'em_andamento') return 'primary'
  if (status === 'pend_assinatura') return 'warning'
  return 'success'
}

function iniciais (nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('')
}

onMounted(async () => {
  await Promise.all([
    kitsStore.fetchList(),
    carregarUsuarios(),
  ])
})
</script>

<template>
  <v-container class="kits-index pa-6" fluid>
    <div class="d-flex align-start flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Produção de Kit</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">Gestão de documentos jurídicos</p>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" rounded="sm" :to="{ name: 'producao-kits-novo' }">
        Novo Kit
      </v-btn>
    </div>

    <v-row class="mb-1" dense>
      <v-col v-for="card in statCards" :key="card.label" cols="12" md="3" sm="6">
        <v-card class="stat-card" rounded="sm" variant="outlined">
          <v-card-text class="d-flex align-center ga-3 py-4">
            <v-avatar class="stat-icon" :class="`stat-icon--${card.tone}`" rounded="sm" size="34">
              <v-icon :icon="card.icon" size="18" />
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold stat-value">{{ card.value }}</div>
              <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-2 mb-5" dense>
      <v-col :cols="authStore.isAdmin ? 8 : 12" md>
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
      <v-col v-if="authStore.isAdmin" cols="4" md="3">
        <v-select
          v-model="filtroCriadoPor"
          clearable
          density="comfortable"
          hide-details
          :items="usuarios"
          item-title="username"
          item-value="id"
          label="Feito por"
          prepend-inner-icon="mdi-account-filter-outline"
          rounded="sm"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <div v-if="kitsStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate />
    </div>

    <v-alert v-else-if="filteredKits.length === 0" class="mb-4" color="info" icon="mdi-information-outline" variant="tonal">
      Nenhum kit cadastrado. Clique em "Novo Kit" para começar.
    </v-alert>

    <v-card
      v-for="kit in filteredKits"
      :key="kit.id"
      class="kit-row mb-3"
      rounded="sm"
      :to="{ name: 'producao-kits-editar', params: { id: kit.id } }"
      variant="outlined"
    >
      <v-card-text class="d-flex align-center py-4">
        <v-avatar class="mr-3 client-avatar" size="34">{{ iniciais(kit.cliente) }}</v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">{{ kit.cliente }}</div>
          <div class="text-caption text-medium-emphasis">{{ kit.cpf }}</div>
        </div>
        <v-spacer />
        <v-chip
          v-if="authStore.isAdmin && kit.criadoPorNome"
          class="mr-2"
          color="info"
          prepend-icon="mdi-account-outline"
          size="small"
          variant="tonal"
        >
          {{ kit.criadoPorNome }}
        </v-chip>
        <v-chip class="mr-2" :color="statusColor(kit.status)" size="small" variant="tonal">
          {{ labelsStatus[kit.status] }}
        </v-chip>
        <v-icon color="medium-emphasis" icon="mdi-chevron-right" />
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.kits-index {
  max-width: 1260px;
}

.stat-card,
.kit-row {
  border-color: #e8e8ef !important;
  background: #fff;
}

.stat-icon--blue {
  background: #eef3ff;
  color: #214ea0;
}

.stat-icon--amber {
  background: #fff7e8;
  color: #bb7a00;
}

.stat-icon--amber-soft {
  background: #fff8ea;
  color: #b98707;
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
