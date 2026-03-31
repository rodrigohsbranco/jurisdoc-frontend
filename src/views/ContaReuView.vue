<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import {
    type ContaBancariaReu,
    useContasReuStore,
  } from '@/stores/contasReu'
  import { onlyDigits, formatCNPJ, formatCEP } from '@/utils/formatters'
  import { useBankCatalog } from '@/composables/useBankCatalog'
  import { useCepLookup } from '@/composables/useCepLookup'
  import { useSnackbar } from '@/composables/useSnackbar'
  import { friendlyError, extractFieldErrors } from '@/utils/errorMessages'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import SidePanel from '@/components/SidePanel.vue'

  const contasReu = useContasReuStore()
  const { bankItems, bankLoading, loadBankCatalog, extractCompeFromLabel } = useBankCatalog()
  const { cepLoading, cepStatus, lookupCEP: doCepLookup } = useCepLookup()
  const { showSuccess } = useSnackbar()

  const loading = computed(() => contasReu.loading)
  const error = computed(() => contasReu.error)

  // Confirm dialog
  const confirmVisible = ref(false)
  const confirmMessage = ref('')
  const confirmAction = ref<(() => void) | null>(null)

  // tabela
  const search = ref('')
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'banco_nome', order: 'asc' },
  ])
  const expanded = ref<readonly any[]>([])

  // diálogo criar/editar
  const dialog = ref(false)
  const editing = ref<ContaBancariaReu | null>(null)
  const dialogTab = ref('dados')
  const form = ref<Partial<ContaBancariaReu>>({
    banco_nome: '',
    banco_codigo: '',
    cnpj: '',
    descricao: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  })
  const fieldErrors = ref<Record<string, string[]>>({})
  const bankSearch = ref('')

  // Regras de validação
  const rules = {
    cepOptional: (v: string) =>
      !v || onlyDigits(v).length === 8 || 'CEP inválido',
    ufOptional: (v: string) => !v || /^[A-Za-z]{2}$/.test(v) || 'UF inválida',
  }

  function resetForm () {
    form.value = {
      banco_nome: '',
      banco_codigo: '',
      cnpj: '',
      descricao: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    }
    fieldErrors.value = {}
    cepStatus.value = ''
  }

  async function lookupCEP () {
    const raw = form.value.cep || ''
    const s = onlyDigits(raw)
    if (s.length !== 8) {
      form.value.cep = formatCEP(raw)
      return
    }
    await doCepLookup(raw, (data) => {
      form.value.logradouro = data.logradouro || form.value.logradouro || ''
      form.value.bairro = data.bairro || form.value.bairro || ''
      form.value.cidade = data.cidade || form.value.cidade || ''
      form.value.estado = data.uf || form.value.estado || ''
    })
    form.value.cep = formatCEP(raw)
  }

  function openCreate () {
    editing.value = null
    resetForm()
    dialogTab.value = 'dados'
    dialog.value = true
  }

  function openEdit (c: ContaBancariaReu) {
    editing.value = c
    form.value = { ...c }
    fieldErrors.value = {}
    cepStatus.value = ''
    dialogTab.value = 'dados'
    dialog.value = true
  }

  async function save () {
    fieldErrors.value = {}
    try {
      const nomeBanco
        = typeof form.value.banco_nome === 'string'
          ? form.value.banco_nome.trim()
          : (form.value as any).banco_nome?.label?.trim?.() || ''

      if (!nomeBanco) throw new Error('Informe o nome do banco.')
      if (!form.value.cnpj || onlyDigits(form.value.cnpj).length !== 14) {
        throw new Error('Informe um CNPJ válido.')
      }

      const bancoCodigo = extractCompeFromLabel(nomeBanco) || form.value.banco_codigo || ''

      const payload: any = {
        ...form.value,
        banco_nome: nomeBanco,
        banco_codigo: bancoCodigo,
        cnpj: onlyDigits(String(form.value.cnpj || '')),
        cep: form.value.cep ? onlyDigits(String(form.value.cep)) : '',
        estado: form.value.estado ? String(form.value.estado).toUpperCase() : '',
      }

      await (editing.value
        ? contasReu.update(editing.value.id, payload)
        : contasReu.create(payload))

      dialog.value = false
      showSuccess(editing.value ? 'Banco atualizado com sucesso!' : 'Banco cadastrado com sucesso!')
      await load()
    } catch (error_: any) {
      const fields = extractFieldErrors(error_)
      if (fields) {
        // Special handling for CNPJ unique constraint
        if (fields.cnpj && Array.isArray(fields.cnpj)) {
          const cnpjError = fields.cnpj.find((msg: string) =>
            msg.toLowerCase().includes('unique') ||
            msg.toLowerCase().includes('já existe') ||
            msg.toLowerCase().includes('already exists')
          )
          if (cnpjError) {
            fieldErrors.value = { cnpj: ['Este CNPJ já está cadastrado.'] }
            return
          }
        }
        fieldErrors.value = fields
        return
      }
      contasReu.error = friendlyError(error_, 'contas', editing.value ? 'update' : 'create')
    }
  }

  async function remove (acc: ContaBancariaReu) {
    confirmMessage.value = `Excluir o banco "${acc.banco_nome}"?`
    confirmAction.value = async () => {
      try {
        await contasReu.remove(acc.id)
        await load()
        showSuccess('Banco excluído com sucesso!')
      } catch (error_: any) {
        contasReu.error = friendlyError(error_, 'contas', 'remove')
      }
    }
    confirmVisible.value = true
  }

  function getBankInitials (name: string) {
    if (!name) return '?'
    // Extract short code if format is "001 - Banco do Brasil"
    const codeMatch = name.match(/^(\d{3})\s*[-–]/)
    if (codeMatch) return codeMatch[1]
    // Otherwise first 2 letters
    return name.slice(0, 2).toUpperCase()
  }

  function formatEndereco (item: ContaBancariaReu) {
    const parts = [item.logradouro, item.numero].filter(Boolean).join(', ')
    const loc = [item.cidade, item.estado?.toUpperCase()].filter(Boolean).join(' / ')
    if (parts && loc) return `${parts} — ${loc}`
    return parts || loc || ''
  }

  const headers = [
    { title: '', key: 'data-table-expand', width: '40px' },
    { title: 'Banco', key: 'banco_nome' },
    { title: 'CNPJ', key: 'cnpj' },
    { title: 'Cidade / UF', key: 'cidade' },
    { title: '', key: 'actions', sortable: false, width: '48px' },
  ]

  const contasDoReu = computed(() => contasReu.items)
  const totalBancos = computed(() => contasReu.items.length)

  async function load () {
    await contasReu.fetchAll({})
  }

  onMounted(load)
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Bancos Réus</h1>
          <v-chip v-if="totalBancos" color="primary" size="small" variant="tonal">
            {{ totalBancos }} {{ totalBancos === 1 ? 'cadastrado' : 'cadastrados' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Gerenciamento dos bancos réus</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-bank-plus" @click="openCreate">
        Novo banco réu
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
            placeholder="Buscar por nome, CNPJ, cidade..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" type="error">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:expanded="expanded"
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          item-value="id"
          :items="contasDoReu"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
          show-expand
        >
          <!-- Banco com avatar -->
          <template #item.banco_nome="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <span class="font-weight-bold" style="font-size: 0.6rem">{{ getBankInitials(item.banco_nome) }}</span>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.banco_nome }}</div>
                <div v-if="item.banco_codigo" class="text-caption text-medium-emphasis">
                  Código: {{ item.banco_codigo }}
                </div>
              </div>
            </div>
          </template>

          <!-- CNPJ formatado -->
          <template #item.cnpj="{ item }">
            <span v-if="item.cnpj" class="text-body-2" style="font-variant-numeric: tabular-nums">
              {{ formatCNPJ(item.cnpj) }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <!-- Cidade / UF -->
          <template #item.cidade="{ item }">
            <span v-if="item.cidade || item.estado" class="text-body-2">
              {{ [item.cidade, item.estado?.toUpperCase()].filter(Boolean).join(' / ') }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <!-- Ações (menu) -->
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
              <v-list density="compact" min-width="160">
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

          <!-- Expanded row -->
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length">
                <div class="expanded-detail pa-4">
                  <v-row dense>
                    <v-col cols="12" md="4">
                      <div class="detail-section">
                        <div class="detail-label">Descrição</div>
                        <div class="text-body-2">{{ item.descricao || 'Não informada' }}</div>
                      </div>
                    </v-col>
                    <v-col cols="12" md="4">
                      <div class="detail-section">
                        <div class="detail-label">Endereço</div>
                        <div v-if="formatEndereco(item)" class="text-body-2">
                          <div>{{ [item.logradouro, item.numero].filter(Boolean).join(', ') }}</div>
                          <div v-if="item.bairro">{{ item.bairro }}</div>
                          <div>{{ [item.cidade, item.estado?.toUpperCase()].filter(Boolean).join(' / ') }}</div>
                          <div v-if="item.cep">CEP: {{ formatCEP(item.cep) }}</div>
                        </div>
                        <span v-else class="text-medium-emphasis text-body-2">Não informado</span>
                      </div>
                    </v-col>
                    <v-col cols="12" md="4">
                      <div class="detail-section">
                        <div class="detail-label">Identificação</div>
                        <div class="detail-row">
                          <span class="detail-key">CNPJ:</span>
                          <span>{{ item.cnpj ? formatCNPJ(item.cnpj) : '—' }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-key">Código:</span>
                          <span>{{ item.banco_codigo || '—' }}</span>
                        </div>
                      </div>
                    </v-col>
                  </v-row>
                </div>
              </td>
            </tr>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-bank-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum banco cadastrado</div>
              <v-btn
                class="mt-3 text-none"
                color="primary"
                prepend-icon="mdi-bank-plus"
                size="small"
                variant="tonal"
                @click="openCreate"
              >
                Cadastrar banco réu
              </v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- ━━━ Dialog criar/editar ━━━ -->
    <SidePanel v-model="dialog" :width="640">
      <template #header>
        <div class="d-flex align-center">
          <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
            <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-bank-plus'" size="18" />
          </v-avatar>
          <div>
            <div class="text-body-1 font-weight-bold">{{ editing ? "Editar banco" : "Novo banco réu" }}</div>
            <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.banco_nome }}</div>
          </div>
        </div>
      </template>

      <v-tabs v-model="dialogTab" color="primary">
        <v-tab value="dados" prepend-icon="mdi-bank-outline">Dados do Banco</v-tab>
        <v-tab value="endereco" prepend-icon="mdi-map-marker-outline">Endereço</v-tab>
      </v-tabs>

      <v-tabs-window v-model="dialogTab">
        <!-- ── Tab: Dados do Banco ── -->
        <v-tabs-window-item value="dados">
          <v-form @submit.prevent="save">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-combobox
                  v-model="form.banco_nome"
                  v-model:search="bankSearch"
                  clearable
                  item-title="label"
                  item-value="label"
                  :items="bankItems"
                  label="Banco"
                  :loading="bankLoading"
                  required
                  :return-object="false"
                  :error-messages="fieldErrors.banco_nome"
                  :rules="[
                    (v) =>
                      (typeof v === 'string' && v.trim().length > 0) ||
                      (v &&
                        typeof v === 'object' &&
                        v.label &&
                        String(v.label).trim().length > 0) ||
                      'Obrigatório',
                  ]"
                  @focus="loadBankCatalog"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.cnpj"
                  label="CNPJ"
                  required
                  :error-messages="fieldErrors.cnpj"
                  :rules="[
                    (v) => {
                      const digits = onlyDigits(v || '')
                      return digits.length === 14 || 'CNPJ deve ter 14 dígitos'
                    },
                  ]"
                  @blur="form.cnpj = formatCNPJ(form.cnpj || '')"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="form.descricao"
                  auto-grow
                  label="Descrição"
                  rows="3"
                  :error-messages="fieldErrors.descricao"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-tabs-window-item>

        <!-- ── Tab: Endereço ── -->
        <v-tabs-window-item value="endereco">
          <v-form @submit.prevent="save">
            <v-row dense>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.cep"
                  append-inner-icon="mdi-magnify"
                  label="CEP"
                  :loading="cepLoading"
                  prepend-inner-icon="mdi-map-search"
                  :error-messages="fieldErrors.cep"
                  :rules="[rules.cepOptional]"
                  @blur="
                    form.cep = formatCEP(form.cep || '');
                    lookupCEP();
                  "
                  @click:append-inner="lookupCEP"
                />
                <div
                  v-if="cepStatus"
                  class="text-caption text-medium-emphasis mt-n2 mb-2"
                >
                  {{ cepStatus }}
                </div>
              </v-col>
              <v-col cols="12" md="5">
                <v-text-field
                  v-model="form.logradouro"
                  label="Logradouro"
                  :error-messages="fieldErrors.logradouro"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.numero"
                  label="Número"
                  :error-messages="fieldErrors.numero"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.bairro"
                  label="Bairro"
                  :error-messages="fieldErrors.bairro"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.cidade"
                  label="Cidade"
                  :error-messages="fieldErrors.cidade"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="form.estado"
                  label="UF"
                  maxlength="2"
                  :error-messages="fieldErrors.estado"
                  :rules="[rules.ufOptional]"
                  @blur="form.estado = (form.estado || '').toUpperCase()"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-tabs-window-item>
      </v-tabs-window>

      <template #actions>
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="save">Salvar</v-btn>
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
.expanded-detail {
  background: rgba(15, 43, 70, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.detail-section {
  margin-bottom: 4px;
}

.detail-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #CDA660;
  margin-bottom: 8px;
}

.detail-row {
  font-size: 0.8125rem;
  line-height: 1.6;
}

.detail-key {
  color: rgba(0, 0, 0, 0.5);
  margin-right: 4px;
}
</style>
