<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  type Cliente,
  type Representante,
  useClientesStore,
} from "@/stores/clientes";
import { onlyDigits } from "@/utils/formatters";
import { formatCPF, formatCEP } from "@/utils/formatters";
import { useCepLookup } from "@/composables/useCepLookup";
import { useCpf, isValidCPF } from "@/composables/useCpf";
import { useSnackbar } from "@/composables/useSnackbar";
import { friendlyError, extractFieldErrors } from "@/utils/errorMessages";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const store = useClientesStore();
const router = useRouter();
const { cepLoading, cepStatus, lookupCEP: doCepLookup } = useCepLookup();
const { cpfCheckStatus, checkCPFExists, resetCpfCheck } = useCpf();
const { showSuccess, showError } = useSnackbar();

// UI state (lista)
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "nome_completo", order: "asc" },
]);
const expanded = ref<readonly any[]>([]);

// Dialog cliente
const dialog = ref(false);
const editing = ref<Cliente | null>(null);
const form = ref<Partial<Cliente>>({});
const dialogTab = ref("pessoal");

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

function goContas(c: Cliente) {
  router.push({ name: "contas", params: { id: c.id } });
}

// regras Vuetify
const rules = {
  cepOptional: (v: string) =>
    !v || onlyDigits(v).length === 8 || "CEP inválido",
  ufOptional: (v: string) => !v || /^[A-Za-z]{2}$/.test(v) || "UF inválida",
  cpfRequired: (v: string) => (v && isValidCPF(v)) || "CPF inválido",
};

const fieldErrors = ref<Record<string, string[]>>({});

// ==== CEP lookup (ViaCEP) ====
async function lookupCEP() {
  const raw = form.value.cep || "";
  const s = onlyDigits(raw);
  if (s.length !== 8) {
    form.value.cep = formatCEP(raw);
    return;
  }
  await doCepLookup(raw, (data) => {
    form.value.logradouro = data.logradouro || form.value.logradouro || "";
    form.value.bairro = data.bairro || form.value.bairro || "";
    form.value.cidade = data.cidade || form.value.cidade || "";
    form.value.uf = data.uf || form.value.uf || "";
  });
  form.value.cep = formatCEP(raw);
}

// helpers de formulário
function resetForm() {
  form.value = {
    nome_completo: "",
    cpf: "",
    rg: "",
    orgao_expedidor: "",
    se_idoso: false,
    se_incapaz: false,
    se_crianca_adolescente: false,
    nacionalidade: "",
    estado_civil: "",
    profissao: "",
    beneficios: [],
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  };
  cepStatus.value = "";
  fieldErrors.value = {};
  resetCpfCheck();
}

function openCreate() {
  editing.value = null;
  resetForm();
  dialogTab.value = "pessoal";
  dialog.value = true;
}

async function openEdit(c: Cliente) {
  editing.value = c;
  form.value = { ...c };
  cepStatus.value = "";
  fieldErrors.value = {};
  dialogTab.value = "pessoal";
  dialog.value = true;
  try {
    await store.fetchRepresentantes(c.id, { force: true });
  } catch {
    /* erro tratado via store */
  }
}

async function save() {
  fieldErrors.value = {};
  try {
    if (!form.value.nome_completo || !String(form.value.nome_completo).trim()) {
      throw new Error("Informe o nome completo.");
    }
    const payload = { ...form.value } as any;
    if (payload.cpf) payload.cpf = onlyDigits(payload.cpf);
    if (payload.cep) payload.cep = onlyDigits(payload.cep);
    if (payload.uf) payload.uf = String(payload.uf).toUpperCase();

    await (editing.value
      ? store.update(editing.value.id, payload)
      : store.create(payload));
    dialog.value = false;
    showSuccess(editing.value ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");
  } catch (error: any) {
    const fields = extractFieldErrors(error);
    if (fields) { fieldErrors.value = fields; store.error = ""; return; }
    store.error = friendlyError(error, 'clientes', editing.value ? 'update' : 'create');
  }
}

async function remove(c: Cliente) {
  confirmMessage.value = `Excluir o cliente "${c.nome_completo}"?`;
  confirmAction.value = async () => {
    try {
      await store.remove(c.id);
      showSuccess("Cliente excluído com sucesso!");
    } catch (error: any) {
      store.error = friendlyError(error, 'clientes', 'remove');
    }
  };
  confirmVisible.value = true;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function clientFlags(c: Cliente) {
  const flags: { label: string; color: string; icon: string }[] = [];
  if (c.se_idoso) flags.push({ label: "Idoso", color: "info", icon: "mdi-human-cane" });
  if (c.se_incapaz) flags.push({ label: "Incapaz", color: "warning", icon: "mdi-account-alert-outline" });
  if (c.se_crianca_adolescente) flags.push({ label: "Menor", color: "purple", icon: "mdi-account-child-outline" });
  return flags;
}

function repsCount(clienteId: number) {
  return store.representantesDoCliente(clienteId).length;
}

// headers
const headers = [
  { title: "", key: "data-table-expand", width: "40px" },
  { title: "Cliente", key: "nome_completo" },
  { title: "CPF", key: "cpf" },
  { title: "Cidade / UF", key: "cidade" },
  { title: "Status", key: "flags", sortable: false },
  { title: "Criado em", key: "criado_em", sortable: true },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

const totalClientes = computed(() => store.items.length);

onMounted(() => {
  store.fetchList({ ordering: "nome_completo" });
});

// =========================
// Representantes (UI)
// =========================
const repsDialog = ref(false);
const repsEditing = ref<Representante | null>(null);
const repsForm = ref<Partial<Representante>>({});
const repsFieldErrors = ref<Record<string, string[]>>({});

function copyEnderecoClienteToRepForm() {
  if (!editing.value || !repsForm.value) return;
  repsForm.value.cep = form.value.cep || "";
  repsForm.value.logradouro = form.value.logradouro || "";
  repsForm.value.numero = form.value.numero || "";
  repsForm.value.bairro = form.value.bairro || "";
  repsForm.value.cidade = form.value.cidade || "";
  repsForm.value.uf = (form.value.uf || "").toUpperCase();
}

function openRepCreate() {
  if (!editing.value) return;
  repsEditing.value = null;
  repsFieldErrors.value = {};
  repsForm.value = {
    cliente: editing.value.id,
    nome_completo: "",
    cpf: "",
    rg: "",
    orgao_expedidor: "",
    nacionalidade: "",
    estado_civil: "",
    profissao: "",
    usa_endereco_do_cliente: true,
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  };
  if (repsForm.value.usa_endereco_do_cliente) {
    copyEnderecoClienteToRepForm();
  }
  repsDialog.value = true;
}

function openRepEdit(r: Representante) {
  repsEditing.value = r;
  repsFieldErrors.value = {};
  repsForm.value = { ...r };
  if (repsForm.value.usa_endereco_do_cliente) {
    copyEnderecoClienteToRepForm();
  }
  repsDialog.value = true;
}

watch(
  () => repsForm.value.usa_endereco_do_cliente,
  (val) => {
    if (val) copyEnderecoClienteToRepForm();
  }
);

async function saveRep() {
  repsFieldErrors.value = {};
  try {
    if (
      !repsForm.value.nome_completo ||
      !String(repsForm.value.nome_completo).trim()
    ) {
      throw new Error("Informe o nome do representante.");
    }
    if (!editing.value)
      throw new Error("Salve o cliente antes de cadastrar representantes.");

    const payload = { ...repsForm.value } as any;
    if (payload.cpf) payload.cpf = onlyDigits(payload.cpf);
    if (payload.cep) payload.cep = onlyDigits(payload.cep);
    if (payload.uf) payload.uf = String(payload.uf).toUpperCase();
    payload.cliente = editing.value.id;
    delete payload.se_idoso;
    delete payload.se_incapaz;
    delete payload.se_crianca_adolescente;

    await (repsEditing.value
      ? store.updateRepresentante(
          repsEditing.value.id,
          payload,
          editing.value.id
        )
      : store.createRepresentante(payload));
    repsDialog.value = false;
    showSuccess(repsEditing.value ? "Representante atualizado!" : "Representante cadastrado!");
  } catch (error: any) {
    const fields = extractFieldErrors(error);
    if (fields) { repsFieldErrors.value = fields; return; }
    store.repsErrorByCliente[editing.value?.id || 0] =
      friendlyError(error, 'clientes', repsEditing.value ? 'update' : 'create');
  }
}

async function removeRep(r: Representante) {
  if (!editing.value) return;
  const clienteId = editing.value.id;
  confirmMessage.value = `Excluir o representante "${r.nome_completo}"?`;
  confirmAction.value = async () => {
    try {
      await store.removeRepresentante(r.id, clienteId);
      showSuccess("Representante excluído com sucesso!");
    } catch (error: any) {
      store.repsErrorByCliente[clienteId] = friendlyError(error, 'clientes', 'remove');
    }
  };
  confirmVisible.value = true;
}

async function usarEnderecoDoCliente(r: Representante) {
  if (!editing.value) return;
  try {
    await store.usarEnderecoDoClienteNoRepresentante(r.id, editing.value.id);
    await store.fetchRepresentantes(editing.value.id, { force: true });
    showSuccess("Endereço copiado do cliente!");
  } catch (error: any) {
    store.repsErrorByCliente[editing.value.id] = friendlyError(error, 'clientes', 'update');
  }
}

// CPF check status display
const cpfStatusIcon = computed(() => {
  const s = cpfCheckStatus.value;
  if (s === 'checking') return { icon: 'mdi-loading mdi-spin', color: 'grey' };
  if (s === 'exists') return { icon: 'mdi-alert-circle', color: 'error' };
  if (s === 'available') return { icon: 'mdi-check-circle', color: 'success' };
  return null;
});
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Clientes</h1>
          <v-chip v-if="totalClientes" color="primary" size="small" variant="tonal">
            {{ totalClientes }} {{ totalClientes === 1 ? 'cadastrado' : 'cadastrados' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Cadastro e gerenciamento de clientes</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        Novo cliente
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
            placeholder="Buscar por nome, CPF, cidade..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="store.hasError" class="mb-4" type="error">
          {{ store.error }}
        </v-alert>

        <v-data-table
          v-model:expanded="expanded"
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          item-value="id"
          :items="store.items"
          :loading="store.loading"
          loading-text="Carregando..."
          :search="search"
          show-expand
        >

          <!-- Nome com avatar -->
          <template #item.nome_completo="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <span class="text-caption font-weight-bold">{{ getInitials(item.nome_completo) }}</span>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.nome_completo }}</div>
                <div v-if="repsCount(item.id) > 0" class="text-caption text-medium-emphasis">
                  {{ repsCount(item.id) }} representante{{ repsCount(item.id) > 1 ? 's' : '' }}
                </div>
              </div>
            </div>
          </template>

          <!-- CPF formatado -->
          <template #item.cpf="{ item }">
            <span v-if="item.cpf" class="text-body-2" style="font-variant-numeric: tabular-nums">
              {{ formatCPF(item.cpf) }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <!-- Cidade / UF -->
          <template #item.cidade="{ item }">
            <span v-if="item.cidade || item.uf" class="text-body-2">
              {{ [item.cidade, item.uf?.toUpperCase()].filter(Boolean).join(' / ') }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <!-- Flags -->
          <template #item.flags="{ item }">
            <div class="d-flex ga-1 flex-wrap">
              <v-chip
                v-for="f in clientFlags(item)"
                :key="f.label"
                :color="f.color"
                :prepend-icon="f.icon"
                size="x-small"
                variant="tonal"
              >
                {{ f.label }}
              </v-chip>
            </div>
          </template>

          <!-- Data -->
          <template #item.criado_em="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ formatDate(item.criado_em) }}</span>
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
              <v-list density="compact" min-width="180">
                <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="openEdit(item)" />
                <v-list-item prepend-icon="mdi-bank-outline" title="Contas bancárias" @click="goContas(item)" />
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
                    <v-col cols="12" md="3">
                      <div class="detail-section">
                        <div class="detail-label">Dados Pessoais</div>
                        <div class="detail-row">
                          <span class="detail-key">RG:</span>
                          <span>{{ item.rg || '—' }} {{ item.orgao_expedidor ? `(${item.orgao_expedidor})` : '' }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-key">Nacionalidade:</span>
                          <span>{{ item.nacionalidade || '—' }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-key">Estado civil:</span>
                          <span>{{ item.estado_civil || '—' }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-key">Profissão:</span>
                          <span>{{ item.profissao || '—' }}</span>
                        </div>
                        <div v-if="clientFlags(item).length" class="mt-2 d-flex ga-1 flex-wrap">
                          <v-chip
                            v-for="f in clientFlags(item)"
                            :key="f.label"
                            :color="f.color"
                            :prepend-icon="f.icon"
                            size="x-small"
                            variant="tonal"
                          >
                            {{ f.label }}
                          </v-chip>
                        </div>
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="detail-section">
                        <div class="detail-label">Endereço</div>
                        <div v-if="item.logradouro || item.cidade" class="text-body-2">
                          <div>{{ [item.logradouro, item.numero].filter(Boolean).join(', ') }}</div>
                          <div v-if="item.bairro">{{ item.bairro }}</div>
                          <div>{{ [item.cidade, item.uf?.toUpperCase()].filter(Boolean).join(' / ') }}</div>
                          <div v-if="item.cep">CEP: {{ formatCEP(item.cep) }}</div>
                        </div>
                        <span v-else class="text-medium-emphasis text-body-2">Não informado</span>
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="detail-section">
                        <div class="detail-label">Benefícios</div>
                        <div v-if="item.beneficios?.length">
                          <div v-for="(b, i) in item.beneficios" :key="i" class="detail-row">
                            <span class="detail-key">{{ b.tipo || 'Benefício' }}:</span>
                            <span>{{ b.numero }}</span>
                          </div>
                        </div>
                        <span v-else class="text-medium-emphasis text-body-2">Nenhum benefício</span>
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="detail-section">
                        <div class="detail-label">Representantes</div>
                        <div v-if="repsCount(item.id) > 0">
                          <div
                            v-for="r in store.representantesDoCliente(item.id)"
                            :key="r.id"
                            class="d-flex align-center py-1"
                          >
                            <v-avatar class="mr-2" color="secondary" size="24" variant="tonal">
                              <span style="font-size: 0.6rem; font-weight: 600">{{ getInitials(r.nome_completo) }}</span>
                            </v-avatar>
                            <span class="text-body-2">{{ r.nome_completo }}</span>
                          </div>
                        </div>
                        <span v-else class="text-medium-emphasis text-body-2">Nenhum representante</span>
                      </div>
                    </v-col>
                  </v-row>
                </div>
              </td>
            </tr>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-account-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum cliente encontrado</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- ━━━ SidePanel criar/editar ━━━ -->
    <SidePanel v-model="dialog" :width="720">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-account-plus-outline'" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">{{ editing ? "Editar cliente" : "Novo cliente" }}</div>
          <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.nome_completo }}</div>
        </div>
      </template>

      <v-tabs v-model="dialogTab" color="primary">
        <v-tab value="pessoal" prepend-icon="mdi-account-outline">Dados Pessoais</v-tab>
        <v-tab value="endereco" prepend-icon="mdi-map-marker-outline">Endereço</v-tab>
        <v-tab v-if="editing" value="representantes" prepend-icon="mdi-account-group-outline">
          Representantes
          <v-badge
            v-if="editing && repsCount(editing.id) > 0"
            :content="repsCount(editing.id)"
            color="secondary"
            inline
          />
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="dialogTab">
        <!-- ── Tab: Dados Pessoais ── -->
        <v-tabs-window-item value="pessoal">
          <v-form @submit.prevent="save">
            <v-row dense>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="form.nome_completo"
                  :error-messages="fieldErrors.nome_completo"
                  label="Nome completo"
                  :rules="[
                    (v) =>
                      (!!v && String(v).trim().length > 0) ||
                      'Nome é obrigatório',
                  ]"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.cpf"
                  :append-inner-icon="cpfStatusIcon?.icon"
                  :error-messages="fieldErrors.cpf"
                  label="CPF"
                  :rules="[rules.cpfRequired]"
                  @blur="
                    form.cpf = formatCPF(form.cpf || '');
                    if (!editing) checkCPFExists(form.cpf || '');
                  "
                >
                  <template v-if="cpfStatusIcon" #append-inner>
                    <v-icon :color="cpfStatusIcon.color" :icon="cpfStatusIcon.icon" size="18" />
                  </template>
                </v-text-field>
                <div v-if="cpfCheckStatus === 'exists'" class="text-caption text-error mt-n2 mb-2">
                  CPF já cadastrado no sistema
                </div>
                <div v-else-if="cpfCheckStatus === 'available'" class="text-caption text-success mt-n2 mb-2">
                  CPF disponível
                </div>
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field v-model="form.rg" label="RG" :error-messages="fieldErrors.rg" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.orgao_expedidor"
                  label="Órgão expedidor"
                  :error-messages="fieldErrors.orgao_expedidor"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.nacionalidade"
                  label="Nacionalidade"
                  :error-messages="fieldErrors.nacionalidade"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.estado_civil"
                  label="Estado civil"
                  :error-messages="fieldErrors.estado_civil"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.profissao"
                  label="Profissão"
                  :error-messages="fieldErrors.profissao"
                />
              </v-col>

              <!-- Sinalizadores -->
              <v-col cols="12">
                <div class="text-caption text-medium-emphasis text-uppercase mb-2" style="letter-spacing: 0.05em">
                  Sinalizadores
                </div>
                <div class="d-flex ga-6 flex-wrap">
                  <v-switch
                    v-model="form.se_idoso"
                    color="secondary"
                    hide-details
                    label="Idoso"
                    density="compact"
                  />
                  <v-switch
                    v-model="form.se_incapaz"
                    color="secondary"
                    hide-details
                    label="Incapaz"
                    density="compact"
                  />
                  <v-switch
                    v-model="form.se_crianca_adolescente"
                    color="secondary"
                    hide-details
                    label="Criança / Adolescente"
                    density="compact"
                  />
                </div>
              </v-col>

              <!-- Benefícios -->
              <v-col cols="12">
                <div class="d-flex align-center mb-2 mt-2">
                  <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing: 0.05em">
                    Benefícios
                  </div>
                  <v-spacer />
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-plus"
                    size="x-small"
                    variant="tonal"
                    @click="form.beneficios = [...(form.beneficios || []), { numero: '', tipo: '' }]"
                  >
                    Adicionar
                  </v-btn>
                </div>

                <div v-if="!form.beneficios?.length" class="text-body-2 text-medium-emphasis mb-2">
                  Nenhum benefício cadastrado.
                </div>

                <v-row v-for="(b, i) in form.beneficios" :key="i" dense class="align-center mb-1">
                  <v-col cols="5">
                    <v-text-field
                      v-model="b.numero"
                      label="Nº Benefício"
                      placeholder="Ex: 1234567890"
                    />
                  </v-col>
                  <v-col cols="5">
                    <v-text-field
                      v-model="b.tipo"
                      label="Tipo"
                      placeholder="Ex: Aposentadoria"
                    />
                  </v-col>
                  <v-col cols="2" class="d-flex justify-center">
                    <v-btn
                      color="error"
                      icon
                      size="x-small"
                      variant="text"
                      @click="form.beneficios!.splice(i, 1)"
                    >
                      <v-icon icon="mdi-close" size="16" />
                    </v-btn>
                  </v-col>
                </v-row>
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
                  :rules="[rules.cepOptional]"
                  @blur="lookupCEP"
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
                <v-text-field v-model="form.logradouro" label="Logradouro" :error-messages="fieldErrors.logradouro" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.numero" label="Número" :error-messages="fieldErrors.numero" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.bairro" label="Bairro" :error-messages="fieldErrors.bairro" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.cidade" label="Cidade" :error-messages="fieldErrors.cidade" />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="form.uf"
                  label="UF"
                  maxlength="2"
                  :error-messages="fieldErrors.uf"
                  :rules="[rules.ufOptional]"
                  @blur="form.uf = (form.uf || '').toUpperCase()"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-tabs-window-item>

        <!-- ── Tab: Representantes ── -->
        <v-tabs-window-item v-if="editing" value="representantes">
          <div class="d-flex align-center mb-4">
            <div class="text-body-2 text-medium-emphasis">
              {{ repsCount(editing.id) }} representante{{ repsCount(editing.id) !== 1 ? 's' : '' }} cadastrado{{ repsCount(editing.id) !== 1 ? 's' : '' }}
            </div>
            <v-spacer />
            <v-btn
              color="primary"
              prepend-icon="mdi-account-plus-outline"
              size="small"
              @click="openRepCreate"
            >
              Adicionar
            </v-btn>
          </div>

          <v-alert
            v-if="store.repsErrorByCliente[editing.id]"
            class="mb-3"
            type="error"
            variant="tonal"
          >
            {{ store.repsErrorByCliente[editing.id] }}
          </v-alert>

          <template v-if="store.representantesDoCliente(editing.id).length > 0">
            <v-card
              v-for="r in store.representantesDoCliente(editing.id)"
              :key="r.id"
              class="mb-3"
              variant="outlined"
            >
              <v-card-text class="d-flex align-center pa-4">
                <v-avatar class="mr-3" color="secondary" size="38" variant="tonal">
                  <span class="text-caption font-weight-bold" style="color: #0F2B46">{{ getInitials(r.nome_completo) }}</span>
                </v-avatar>
                <div class="flex-grow-1" style="min-width: 0">
                  <div class="text-body-2 font-weight-medium">{{ r.nome_completo }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ r.cpf ? formatCPF(r.cpf) : 'CPF não informado' }}
                    <template v-if="r.profissao"> · {{ r.profissao }}</template>
                  </div>
                  <v-chip
                    v-if="r.usa_endereco_do_cliente"
                    class="mt-1"
                    color="secondary"
                    prepend-icon="mdi-home-account"
                    size="x-small"
                    variant="tonal"
                  >
                    usa endereço do cliente
                  </v-chip>
                </div>
                <div class="d-flex ga-1">
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    @click="usarEnderecoDoCliente(r)"
                  >
                    <v-icon icon="mdi-home-account" size="18" />
                    <v-tooltip activator="parent" location="top">Copiar endereço do cliente</v-tooltip>
                  </v-btn>
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    @click="openRepEdit(r)"
                  >
                    <v-icon icon="mdi-pencil-outline" size="18" />
                    <v-tooltip activator="parent" location="top">Editar</v-tooltip>
                  </v-btn>
                  <v-btn
                    color="error"
                    icon
                    size="small"
                    variant="text"
                    @click="removeRep(r)"
                  >
                    <v-icon icon="mdi-delete-outline" size="18" />
                    <v-tooltip activator="parent" location="top">Excluir</v-tooltip>
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </template>

          <div v-else class="pa-6 text-center">
            <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-account-group-outline" size="36" />
            <div class="text-body-2 text-medium-emphasis">Nenhum representante cadastrado</div>
            <v-btn
              class="mt-3 text-none"
              color="primary"
              prepend-icon="mdi-account-plus-outline"
              size="small"
              variant="tonal"
              @click="openRepCreate"
            >
              Adicionar representante
            </v-btn>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>

      <template #actions>
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="save">Salvar</v-btn>
      </template>
    </SidePanel>

    <!-- ━━━ SidePanel Representante (criar/editar) ━━━ -->
    <SidePanel v-model="repsDialog" :width="640">
      <template #header>
        <v-avatar class="mr-3" color="secondary" size="36" variant="tonal">
          <v-icon :icon="repsEditing ? 'mdi-pencil-outline' : 'mdi-account-plus-outline'" size="18" />
        </v-avatar>
        {{ repsEditing ? "Editar representante" : "Novo representante" }}
      </template>

      <v-form @submit.prevent="saveRep">
        <v-row dense>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="repsForm.nome_completo"
              :error-messages="repsFieldErrors.nome_completo"
              label="Nome completo"
              :rules="[
                (v) =>
                  (!!v && String(v).trim().length > 0) ||
                  'Nome é obrigatório',
              ]"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.cpf"
              :error-messages="repsFieldErrors.cpf"
              label="CPF"
              @blur="repsForm.cpf = formatCPF(repsForm.cpf || '')"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="repsForm.rg" label="RG" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.orgao_expedidor"
              label="Órgão expedidor"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.nacionalidade"
              label="Nacionalidade"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.estado_civil"
              label="Estado civil"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="repsForm.profissao" label="Profissão" />
          </v-col>

          <!-- Endereço -->
          <v-col cols="12">
            <v-divider class="mb-3" />
            <v-switch
              v-model="repsForm.usa_endereco_do_cliente"
              color="secondary"
              hide-details
              label="Usar o mesmo endereço do cliente"
              density="compact"
              class="mb-3"
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-text-field
              v-model="repsForm.cep"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="CEP"
              @blur="repsForm.cep = formatCEP(repsForm.cep || '')"
            />
          </v-col>
          <v-col cols="12" md="5">
            <v-text-field
              v-model="repsForm.logradouro"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="Logradouro"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="repsForm.numero"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="Número"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="repsForm.uf"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="UF"
              maxlength="2"
              @blur="repsForm.uf = (repsForm.uf || '').toUpperCase()"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.bairro"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="Bairro"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="repsForm.cidade"
              :disabled="repsForm.usa_endereco_do_cliente"
              label="Cidade"
            />
          </v-col>
        </v-row>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="repsDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="saveRep">Salvar</v-btn>
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
