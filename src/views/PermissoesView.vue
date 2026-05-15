<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { usePermissoesStore } from '@/stores/permissoes'
import type { Permissao } from '@/services/permissoes'
import { useSnackbar } from '@/composables/useSnackbar'
import { friendlyError } from '@/utils/errorMessages'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SidePanel from '@/components/SidePanel.vue'

const store = usePermissoesStore()
const { showSuccess } = useSnackbar()

const search = ref('')
const dialog = ref(false)
const editing = ref<Permissao | null>(null)
const localError = ref('')

const form = reactive<{
  nome: string
  descricao: string
  capacidades: Set<number>
}>({
  nome: '',
  descricao: '',
  capacidades: new Set<number>(),
})

const confirmVisible = ref(false)
const confirmMessage = ref('')
const confirmAction = ref<(() => void) | null>(null)

const headers = [
  { title: 'Nome', key: 'nome' },
  { title: 'Descrição', key: 'descricao' },
  { title: 'Capacidades', key: 'qtd_capacidades', sortable: false, width: 140 },
  { title: 'Usuários', key: 'usuarios_count', width: 110 },
  { title: '', key: 'actions', sortable: false, width: '48px' },
]

const totalCapacidadesCatalogo = computed(() => store.capacidades.length)
const selecionadasCount = computed(() => form.capacidades.size)

const filteredAgrupadas = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.agrupadas
  return store.agrupadas
    .map(cat => ({
      categoria: cat.categoria,
      recursos: cat.recursos
        .map(r => ({
          recurso: r.recurso,
          acoes: r.acoes.filter(a =>
            a.codigo.toLowerCase().includes(q)
            || a.acao.toLowerCase().includes(q)
            || r.recurso.toLowerCase().includes(q)
            || a.descricao.toLowerCase().includes(q),
          ),
        }))
        .filter(r => r.acoes.length > 0),
    }))
    .filter(cat => cat.recursos.length > 0)
})

onMounted(async () => {
  await Promise.all([store.fetchList(), store.fetchCatalog()])
})

function resetForm () {
  form.nome = ''
  form.descricao = ''
  form.capacidades = new Set<number>()
  localError.value = ''
}

function openCreate () {
  editing.value = null
  resetForm()
  dialog.value = true
}

function openEdit (p: Permissao) {
  editing.value = p
  form.nome = p.nome
  form.descricao = p.descricao || ''
  form.capacidades = new Set<number>(p.capacidades || [])
  localError.value = ''
  dialog.value = true
}

function toggleCapacidade (id: number) {
  if (form.capacidades.has(id)) form.capacidades.delete(id)
  else form.capacidades.add(id)
  // força reactividade do Set
  form.capacidades = new Set(form.capacidades)
}

function isChecked (id: number) {
  return form.capacidades.has(id)
}

function toggleRecurso (acoes: { id: number }[], desejaSelecionarTodos: boolean) {
  for (const a of acoes) {
    if (desejaSelecionarTodos) form.capacidades.add(a.id)
    else form.capacidades.delete(a.id)
  }
  form.capacidades = new Set(form.capacidades)
}

function recursoAllSelected (acoes: { id: number }[]) {
  return acoes.length > 0 && acoes.every(a => form.capacidades.has(a.id))
}

function recursoSomeSelected (acoes: { id: number }[]) {
  return acoes.some(a => form.capacidades.has(a.id)) && !recursoAllSelected(acoes)
}

function toggleCategoria (cat: { recursos: Array<{ acoes: { id: number }[] }> }, selecionarTodos: boolean) {
  for (const r of cat.recursos) {
    for (const a of r.acoes) {
      if (selecionarTodos) form.capacidades.add(a.id)
      else form.capacidades.delete(a.id)
    }
  }
  form.capacidades = new Set(form.capacidades)
}

function categoriaAllSelected (cat: { recursos: Array<{ acoes: { id: number }[] }> }) {
  return cat.recursos.every(r => recursoAllSelected(r.acoes)) && cat.recursos.length > 0
}

async function save () {
  localError.value = ''
  if (!form.nome.trim()) {
    localError.value = 'Informe um nome para a permissão.'
    return
  }
  const payload: Partial<Permissao> = {
    nome: form.nome.trim(),
    descricao: form.descricao.trim(),
    capacidades: Array.from(form.capacidades),
  }
  try {
    if (editing.value) {
      await store.update(editing.value.id, payload)
      showSuccess('Permissão atualizada com sucesso!')
    } else {
      await store.create(payload)
      showSuccess('Permissão criada com sucesso!')
    }
    dialog.value = false
    await store.fetchList()
  } catch (error: any) {
    localError.value = friendlyError(error, 'permissoes', editing.value ? 'update' : 'create')
  }
}

function remove (p: Permissao) {
  confirmMessage.value = (p.usuarios_count || 0) > 0
    ? `A permissão "${p.nome}" está atribuída a ${p.usuarios_count} usuário(s). Ao excluir, eles ficarão sem permissão atribuída. Continuar?`
    : `Excluir a permissão "${p.nome}"?`
  confirmAction.value = async () => {
    try {
      await store.remove(p.id)
      showSuccess('Permissão excluída com sucesso!')
    } catch (error: any) {
      localError.value = friendlyError(error, 'permissoes', 'remove')
    }
  }
  confirmVisible.value = true
}
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Permissões</h1>
          <v-chip v-if="store.items.length" color="primary" size="small" variant="tonal">
            {{ store.items.length }} {{ store.items.length === 1 ? 'perfil' : 'perfis' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Crie perfis nomeados e escolha o que cada um pode fazer no sistema.
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-shield-plus-outline" @click="openCreate">
        Nova permissão
      </v-btn>
    </div>

    <!-- Tabela -->
    <v-card>
      <v-card-text>
        <v-alert v-if="store.error" class="mb-4" closable type="error" @click:close="store.error = ''">
          {{ store.error }}
        </v-alert>

        <v-data-table
          :headers="headers"
          item-key="id"
          :items="store.items"
          :loading="store.loading"
          loading-text="Carregando..."
        >
          <template #item.nome="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <v-icon icon="mdi-shield-check-outline" size="18" />
              </v-avatar>
              <span class="text-body-2 font-weight-medium">{{ item.nome }}</span>
            </div>
          </template>

          <template #item.descricao="{ item }">
            <span v-if="item.descricao" class="text-body-2 text-medium-emphasis">{{ item.descricao }}</span>
            <span v-else class="text-medium-emphasis">--</span>
          </template>

          <template #item.qtd_capacidades="{ item }">
            <v-chip size="small" variant="tonal">
              {{ (item.capacidades || []).length }} / {{ totalCapacidadesCatalogo }}
            </v-chip>
          </template>

          <template #item.usuarios_count="{ item }">
            <v-chip
              :color="(item.usuarios_count || 0) > 0 ? 'secondary' : 'default'"
              size="small"
              variant="tonal"
            >
              {{ item.usuarios_count || 0 }}
            </v-chip>
          </template>

          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="openEdit(item)" />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="remove(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-shield-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhuma permissão cadastrada.</div>
              <v-btn class="mt-3" color="primary" size="small" variant="tonal" @click="openCreate">
                Criar a primeira
              </v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Form (criar/editar) -->
    <SidePanel v-model="dialog" :width="780">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-shield-plus-outline'" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">
            {{ editing ? 'Editar permissão' : 'Nova permissão' }}
          </div>
          <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.nome }}</div>
        </div>
      </template>

      <v-alert v-if="localError" class="mb-3" closable type="error" @click:close="localError = ''">
        {{ localError }}
      </v-alert>

      <v-text-field
        v-model="form.nome"
        density="comfortable"
        label="Nome do perfil"
        placeholder="Ex.: Operador, Financeiro, Estagiário"
        required
      />
      <v-textarea
        v-model="form.descricao"
        auto-grow
        class="mt-2"
        density="comfortable"
        label="Descrição (opcional)"
        rows="2"
      />

      <div class="d-flex align-center mt-5 mb-2">
        <div class="text-caption text-uppercase text-medium-emphasis" style="letter-spacing: 0.05em">
          Capacidades
        </div>
        <v-spacer />
        <v-chip size="x-small" variant="tonal">
          {{ selecionadasCount }} / {{ totalCapacidadesCatalogo }} marcadas
        </v-chip>
      </div>

      <v-text-field
        v-model="search"
        class="mb-3"
        clearable
        density="compact"
        hide-details
        placeholder="Filtrar capacidades..."
        prepend-inner-icon="mdi-magnify"
      />

      <v-progress-linear v-if="store.loadingCatalog" color="primary" indeterminate />

      <div v-else class="cap-matrix">
        <div
          v-for="cat in filteredAgrupadas"
          :key="cat.categoria"
          class="categoria-block mb-4"
        >
          <div class="d-flex align-center mb-2">
            <div class="categoria-title">{{ cat.categoria }}</div>
            <v-spacer />
            <v-btn
              size="x-small"
              :variant="categoriaAllSelected(cat) ? 'tonal' : 'text'"
              :color="categoriaAllSelected(cat) ? 'primary' : undefined"
              @click="toggleCategoria(cat, !categoriaAllSelected(cat))"
            >
              {{ categoriaAllSelected(cat) ? 'Desmarcar tudo' : 'Marcar tudo' }}
            </v-btn>
          </div>

          <div
            v-for="r in cat.recursos"
            :key="`${cat.categoria}::${r.recurso}`"
            class="recurso-row d-flex align-center flex-wrap py-2 px-3 mb-1"
          >
            <div class="recurso-name flex-shrink-0">
              <v-icon icon="mdi-checkbox-multiple-blank-outline" size="16" class="mr-1" />
              {{ r.recurso }}
            </div>
            <div class="acoes-list d-flex flex-wrap ga-1 ml-3 flex-grow-1">
              <v-chip
                v-for="a in r.acoes"
                :key="a.id"
                :color="isChecked(a.id) ? 'primary' : undefined"
                :prepend-icon="isChecked(a.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"
                size="small"
                :variant="isChecked(a.id) ? 'tonal' : 'outlined'"
                :title="a.descricao"
                @click="toggleCapacidade(a.id)"
              >
                {{ a.acao }}
              </v-chip>
            </div>
            <v-btn
              :color="recursoAllSelected(r.acoes) ? 'primary' : undefined"
              size="x-small"
              variant="text"
              :icon="recursoAllSelected(r.acoes) ? 'mdi-checkbox-multiple-marked' : 'mdi-checkbox-multiple-blank-outline'"
              :title="recursoAllSelected(r.acoes) ? 'Desmarcar todas' : 'Marcar todas'"
              @click="toggleRecurso(r.acoes, !recursoAllSelected(r.acoes))"
            />
          </div>
        </div>

        <div v-if="filteredAgrupadas.length === 0" class="pa-6 text-center text-medium-emphasis">
          Nenhuma capacidade combina com o filtro.
        </div>
      </div>

      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn
          color="primary"
          :loading="store.loadingMutation"
          variant="elevated"
          @click="save"
        >
          Salvar
        </v-btn>
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

<style scoped>
.categoria-title {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: #0F2B46;
}

.recurso-row {
  background: rgba(15, 43, 70, 0.03);
  border-radius: 8px;
  transition: background 0.15s;
}

.recurso-row:hover {
  background: rgba(15, 43, 70, 0.06);
}

.recurso-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #0F2B46;
  min-width: 180px;
}

.cap-matrix {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
