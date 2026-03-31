<script setup lang="ts">
import { computed, ref } from 'vue'

type StatusKit = 'em_andamento' | 'pend_assinatura' | 'assinado'
type KitItem = {
  id: number
  cliente: string
  cpf: string
  status: StatusKit
}

const busca = ref('')
const kits = ref<KitItem[]>([
  { id: 1, cliente: 'Gabriel Willian Dacaz', cpf: '110.646.299-89', status: 'em_andamento' },
])

const labelsStatus: Record<StatusKit, string> = {
  em_andamento: 'Em andamento',
  pend_assinatura: 'Pend. assinatura',
  assinado: 'Assinado',
}

const filteredKits = computed(() => {
  const q = busca.value.trim().toLowerCase()
  if (!q) return kits.value
  return kits.value.filter(kit =>
    kit.cliente.toLowerCase().includes(q) ||
    kit.cpf.toLowerCase().includes(q),
  )
})

const totalClientes = computed(() => kits.value.length)
const totalEmAndamento = computed(() => kits.value.filter(k => k.status === 'em_andamento').length)
const totalPendAssinatura = computed(() => kits.value.filter(k => k.status === 'pend_assinatura').length)
const totalAssinados = computed(() => kits.value.filter(k => k.status === 'assinado').length)

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
</script>

<template>
  <v-container class="kits-index pa-6" fluid>
    <div class="d-flex align-start flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Produção de Kit</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">Gestão de documentos jurídicos</p>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" rounded="lg" :to="{ name: 'producao-kits-novo' }">
        Novo Kit
      </v-btn>
    </div>

    <v-row class="mb-1" dense>
      <v-col v-for="card in statCards" :key="card.label" cols="12" md="3" sm="6">
        <v-card class="stat-card" rounded="lg" variant="outlined">
          <v-card-text class="d-flex align-center ga-3 py-4">
            <v-avatar class="stat-icon" :class="`stat-icon--${card.tone}`" rounded="lg" size="34">
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

    <v-text-field
      v-model="busca"
      class="mt-2 mb-5"
      density="comfortable"
      hide-details
      placeholder="Buscar por nome ou CPF..."
      prepend-inner-icon="mdi-magnify"
      rounded="lg"
      variant="outlined"
    />

    <v-card
      v-for="kit in filteredKits"
      :key="kit.id"
      class="kit-row mb-3"
      rounded="lg"
      variant="outlined"
    >
      <v-card-text class="d-flex align-center py-4">
        <v-avatar class="mr-3 client-avatar" size="34">{{ iniciais(kit.cliente) }}</v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">{{ kit.cliente }}</div>
          <div class="text-caption text-medium-emphasis">{{ kit.cpf }}</div>
        </div>
        <v-spacer />
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
