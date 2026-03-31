<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { type Cliente, useClientesStore } from "@/stores/clientes";
import { type ContaBancaria, useContasStore } from "@/stores/contas";
import { type Petition, usePeticoesStore } from "@/stores/peticoes";
import { type TemplateField, useTemplatesStore } from "@/stores/templates";
import { useSnackbar } from "@/composables/useSnackbar";
import { friendlyError } from "@/utils/errorMessages";
import { normKey, isEmpty, valueFromSources, detectCanon } from "@/composables/useContratoPrefill";
import { formatCurrency, parseCurrency, applyCurrencyMask } from "@/composables/useCurrencyMask";
import { useNumeroExtenso } from "@/composables/useNumeroExtenso";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const peticoes = usePeticoesStore();
const templates = useTemplatesStore();
const clientes = useClientesStore();
const contas = useContasStore();
const { showSuccess, showError } = useSnackbar();
const { numeroParaExtenso, isExtensoField, getBaseFieldNameForExtenso } = useNumeroExtenso();

// Campos monetários conhecidos
const CURRENCY_CANONS = new Set([
  'valor_parcela', 'iof', 'valor_do_emprestimo', 'valor_liberado',
]);

function isCurrencyField(fieldName: string): boolean {
  const canon = detectCanon(fieldName);
  if (CURRENCY_CANONS.has(canon)) return true;
  const k = normKey(fieldName);
  return (k.includes('valor') && !k.includes('extenso')) || k === 'iof';
}

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

// =========================
// Helpers
// =========================
function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// pega conta principal do cliente (ou 1a)
async function getContaPrincipalForCliente(
  clienteId?: number
): Promise<ContaBancaria | null> {
  const cid = Number(clienteId);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  // tenta cache local primeiro
  const inCache =
    contas.principal(cid) || (contas.byCliente(cid) || [])[0] || null;
  if (inCache) return inCache;

  // carrega do servidor e tenta de novo
  try {
    await contas.fetchForCliente(cid);
  } catch {
    return null;
  }
  return contas.principal(cid) || (contas.byCliente(cid) || [])[0] || null;
}

// =========================
// Carregamento e lookups
// =========================
const requestedClients = new Set<number>();
function ensureClientInCache(id?: number) {
  const cid = Number(id);
  if (!Number.isFinite(cid) || cid <= 0) return;
  const found = (clientes.items as Cliente[]).some((c) => Number(c.id) === cid);
  if (!found && !requestedClients.has(cid)) {
    requestedClients.add(cid);
    clientes.getDetail(cid).catch(() => {});
  }
}

// Opcoes para selects
const clientOptions = computed(() =>
  (clientes.items as Cliente[]).map((c) => ({
    title: c.nome_completo || `#${Number(c.id)}`,
    value: Number(c.id),
  }))
);

const templateOptions = computed(() =>
  templates.items.map((t) => ({ title: t.name, value: Number(t.id) }))
);

// =========================
// Tabela
// =========================
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "created_at", order: "desc" },
]);

const headers = [
  { title: "Cliente", key: "cliente" },
  { title: "Template", key: "template" },
  { title: "Criada em", key: "created_at" },
  { title: "Atualizada em", key: "updated_at" },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

const totalPeticoes = computed(() => peticoes.items.length);

const clienteNome = (id?: number, fallback?: string | null) => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const cid = Number(id);
  if (!Number.isFinite(cid) || cid <= 0) return "—";
  const c = (clientes.items as Cliente[]).find((x) => Number(x.id) === cid);
  if (c) return c.nome_completo || `#${cid}`;
  ensureClientInCache(cid);
  return "—";
};

const templateLabel = (id?: number) => {
  const tid = Number(id);
  if (!Number.isFinite(tid) || tid <= 0) return "—";
  const t = templates.byId(tid);
  return t ? t.name : `#${tid}`;
};

// =========================
// Dialog / Form
// =========================
const dialogUpsert = ref(false);
const editing = ref<Petition | null>(null);
const form = reactive<{
  cliente: number | null;
  template: number | null;
  context: Record<string, any>;
}>({
  cliente: null,
  template: null,
  context: {},
});

const selectedBeneficio = ref<number | null>(null);

const beneficioOptions = computed(() => {
  if (!form.cliente) return [];
  const c = (clientes.items as Cliente[]).find((x) => Number(x.id) === Number(form.cliente));
  if (!c?.beneficios?.length) return [];
  return c.beneficios.map((b, i) => ({
    title: `${b.tipo || 'Benefício'} — ${b.numero}`,
    value: i,
  }));
});

const fieldsLoading = ref(false);
const fields = ref<TemplateField[]>([]);
const syntaxInfo = ref<string>("");

async function loadFieldsForTemplate(
  tid: number | string | null | undefined,
  force = false
) {
  const id = typeof tid === "string" ? Number(tid) : (tid as number);
  fields.value = [];
  syntaxInfo.value = "";

  if (!Number.isFinite(id) || id <= 0) return;

  fieldsLoading.value = true;
  try {
    const resp = await templates.fetchFields(id, { force });
    syntaxInfo.value = resp.syntax || "";

    if (resp.syntax && resp.syntax.toLowerCase().includes("angle")) {
      templates.lastError =
        "Este template ainda usa << >>. Atualize para {{ }} antes de gerar.";
      fields.value = [];
      return;
    }

    fields.value = resp.fields || [];

    // Garante chaves no context para todos os fields
    for (const f of fields.value) {
      if (!(f.name in form.context)) form.context[f.name] = "";
    }

    // Tenta autopreencher se ja houver cliente selecionado
    await nextTick();
    await tryPrefillFromSources();
  } catch (error_: any) {
    templates.lastError = friendlyError(error_, 'templates', 'fields');
  } finally {
    fieldsLoading.value = false;
  }
}

// Dispara quando template mudar
watch(
  () => form.template,
  (tid) => loadFieldsForTemplate(tid, true)
);

// Dispara quando cliente mudar (carrega cliente + contas e preenche)
watch(
  () => form.cliente,
  async (cid) => {
    if (!cid) { selectedBeneficio.value = null; return; }
    // Ao trocar cliente, reseta benefício — mas ao editar, restaura do contexto
    selectedBeneficio.value = null;
    ensureClientInCache(Number(cid));

    // Tenta restaurar benefício do contexto salvo
    const numSalvo = form.context?.numero_beneficio || form.context?.beneficio || form.context?.numerobeneficio || form.context?.numero_ben || "";
    if (numSalvo) {
      const cli = (clientes.items as Cliente[]).find((x) => Number(x.id) === Number(cid));
      if (cli?.beneficios?.length) {
        const idx = cli.beneficios.findIndex((b) => b.numero === numSalvo);
        if (idx >= 0) selectedBeneficio.value = idx;
      }
    }

    const c = (clientes.items as Cliente[]).find(
      (x) => Number(x.id) === Number(cid)
    );
    if (c) {
      if (form.context.idoso === undefined) form.context.idoso = !!c.se_idoso;
      if (form.context.incapaz === undefined)
        form.context.incapaz = !!c.se_incapaz;

      // cobre tanto camelCase quanto snake_case, caso o template use qualquer um:
      if (form.context.criancaAdolescente === undefined) {
        form.context.criancaAdolescente = !!c.se_crianca_adolescente;
      }
      if (form.context.crianca_adolescente === undefined) {
        form.context.crianca_adolescente = !!c.se_crianca_adolescente;
      }
    }

    await tryPrefillFromSources();
  }
);

// Quando benefício muda, preenche campos relacionados no contexto
watch(
  () => selectedBeneficio.value,
  (idx) => {
    if (idx === null || idx === undefined || !form.cliente) return;
    const c = (clientes.items as Cliente[]).find((x) => Number(x.id) === Number(form.cliente));
    const b = c?.beneficios?.[idx];
    if (!b) return;
    form.context["numero_beneficio"] = b.numero || "";
    form.context["tipo_beneficio"] = b.tipo || "";
    form.context["beneficio"] = b.numero || "";
  }
);

async function tryPrefillFromSources() {
  if (!form.cliente || fields.value.length === 0) return;

  // garante cliente e contas
  let c =
    (clientes.items as Cliente[]).find(
      (x) => Number(x.id) === Number(form.cliente)
    ) || null;
  if (!c) {
    try {
      c = await clientes.getDetail(Number(form.cliente));
    } catch {
      /* ignore */
    }
  }
  const acc = await getContaPrincipalForCliente(Number(form.cliente));

  // percorre os campos do template e preenche se vazio
  for (const f of fields.value) {
    const current = form.context[f.name];
    if (!isEmpty(current)) continue;
    const v = valueFromSources(c!, acc, null, null, f.name);
    if (v === undefined || v === null || v === "") continue;
    if (f.type === "bool") {
      form.context[f.name] = Boolean(v);
    } else if (f.type === "int") {
      const n = Number(v);
      if (!Number.isNaN(n)) form.context[f.name] = n;
    } else {
      form.context[f.name] = String(v);
    }
  }

  // Auto-gera extenso para campos numéricos preenchidos
  for (const [key, val] of Object.entries(form.context)) {
    if (key.endsWith("_extenso")) continue;
    const num = typeof val === "number" ? val : typeof val === "string"
      ? parseFloat(val.replace(/[^\d,.-]/g, "").replace(",", ".")) : NaN;
    if (!isNaN(num) && num !== 0) {
      const ek = `${key}_extenso`;
      if (!form.context[ek]) form.context[ek] = numeroParaExtenso(num);
    }
  }
}

// Watcher: atualiza extenso quando campos numéricos mudam
watch(
  () => form.context,
  (ctx) => {
    for (const [key, val] of Object.entries(ctx)) {
      if (key.endsWith("_extenso")) continue;
      if (!isCurrencyField(key) && !isExtensoField(key)) continue;
      const ek = `${key}_extenso`;
      const num = typeof val === "number" ? val : typeof val === "string"
        ? parseFloat(val.replace(/[^\d,.-]/g, "").replace(",", ".")) : NaN;
      if (!isNaN(num) && num !== 0) {
        const extenso = numeroParaExtenso(num);
        if (form.context[ek] !== extenso) form.context[ek] = extenso;
      } else if (ek in form.context && (val === "" || val === null || num === 0)) {
        form.context[ek] = "";
      }
    }
  },
  { deep: true },
);

async function openCreate() {
  editing.value = null;
  form.cliente = null;
  form.template = null;
  form.context = {};
  selectedBeneficio.value = null;
  fields.value = [];
  syntaxInfo.value = "";
  if ((clientes.items as Cliente[]).length === 0) {
    await clientes.fetchList({});
  }
  dialogUpsert.value = true;
}

function openEdit(p: Petition) {
  editing.value = p;
  form.cliente = Number(p.cliente) || null;
  form.template = Number(p.template) || null;
  form.context = { ...p.context };
  selectedBeneficio.value = null;
  dialogUpsert.value = true;
  ensureClientInCache(p.cliente);
  if (p.cliente) contas.fetchForCliente(Number(p.cliente)).catch(() => {});
  loadFieldsForTemplate(p.template || null, true);

  // Restaura o benefício selecionado a partir do contexto salvo
  if (form.cliente) {
    const numSalvo = p.context?.numero_beneficio || p.context?.beneficio || p.context?.numerobeneficio || p.context?.numero_ben || "";
    if (numSalvo) {
      const c = (clientes.items as Cliente[]).find((x) => Number(x.id) === Number(form.cliente));
      if (c?.beneficios?.length) {
        const idx = c.beneficios.findIndex((b) => b.numero === numSalvo);
        if (idx >= 0) selectedBeneficio.value = idx;
      }
    }
  }
}

async function saveUpsert() {
  try {
    if (!form.cliente) throw new Error("Selecione o cliente.");
    if (!form.template) throw new Error("Selecione o template.");

    const payload = {
      cliente: Number(form.cliente),
      template: Number(form.template),
      context: form.context || {},
    };

    await (editing.value
      ? peticoes.update(editing.value.id, payload)
      : peticoes.create(payload));
    dialogUpsert.value = false;
    showSuccess(editing.value ? "Petição atualizada com sucesso!" : "Petição criada com sucesso!");
  } catch (error_: any) {
    peticoes.error = friendlyError(error_, 'peticoes', editing.value ? 'update' : 'create');
  }
}

async function removePetition(p: Petition) {
  confirmMessage.value = "Excluir esta petição?";
  confirmAction.value = async () => {
    try {
      await peticoes.remove(p.id);
      showSuccess("Petição excluída com sucesso!");
    } catch (error_: any) {
      peticoes.error = friendlyError(error_, 'peticoes', 'remove');
    }
  };
  confirmVisible.value = true;
}

// ===== render (direto, sem painel) =====
const rendering = ref(false);
const renderingId = ref<number | null>(null);

async function doRender(p: Petition) {
  // verifica sintaxe do template
  try {
    const resp = await templates.fetchFields(Number(p.template), { force: false });
    if (resp.syntax && resp.syntax.toLowerCase().includes("angle")) {
      showError("O template ainda usa << >>. Atualize para {{ }} antes de gerar.");
      return;
    }
  } catch (error_: any) {
    showError(friendlyError(error_, 'templates', 'fields'));
    return;
  }

  rendering.value = true;
  renderingId.value = p.id;
  try {
    const tpl = templates.byId(Number(p.template));
    const defaultName = tpl ? tpl.name.replace(/\.docx$/i, "") : `peticao_${p.id}`;
    const result = await peticoes.render(p.id, {
      filename: `${defaultName}.docx`,
      strict: true,
    });
    peticoes.downloadRendered(result);
    showSuccess("Documento gerado com sucesso!");
  } catch (error_: any) {
    showError(friendlyError(error_, 'peticoes', 'render'));
  } finally {
    rendering.value = false;
    renderingId.value = null;
  }
}

// ===== overview (pré-visualização) =====
const dialogOverview = ref(false);
const overviewLoading = ref(false);
const overviewError = ref("");
const overviewItem = ref<Petition | null>(null);
const overviewBlob = ref<Blob | null>(null);
const docxContainer = ref<HTMLElement | null>(null);

async function openOverview(p: Petition) {
  overviewItem.value = p;
  overviewBlob.value = null;
  overviewError.value = "";
  dialogOverview.value = true;
  overviewLoading.value = true;

  try {
    if (!p.template) throw new Error("Template não encontrado.");

    // Verifica sintaxe
    const resp = await templates.fetchFields(Number(p.template), { force: false });
    if (resp.syntax?.toLowerCase().includes("angle")) {
      throw new Error("O template usa sintaxe antiga << >>. Atualize para {{ }}.");
    }

    // Renderiza
    const tpl = templates.byId(Number(p.template));
    const defaultName = tpl ? tpl.name.replace(/\.docx$/i, "") : `peticao_${p.id}`;
    const result = await peticoes.render(p.id, {
      filename: `${defaultName}.docx`,
      strict: true,
    });
    overviewBlob.value = result.blob;
  } catch (err: any) {
    overviewError.value = friendlyError(err, "peticoes", "render");
  } finally {
    overviewLoading.value = false;
  }

  // Renderiza no DOM após loading=false
  if (overviewBlob.value) {
    await nextTick();
    if (docxContainer.value) {
      try {
        const { renderAsync } = await import("docx-preview");
        docxContainer.value.innerHTML = "";
        await renderAsync(overviewBlob.value, docxContainer.value, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
        });
      } catch {
        overviewError.value = "Não foi possível renderizar a pré-visualização.";
      }
    }
  }
}

function downloadOverview() {
  if (!overviewBlob.value || !overviewItem.value) return;
  const url = URL.createObjectURL(overviewBlob.value);
  const a = document.createElement("a");
  a.href = url;
  a.download = `peticao_${overviewItem.value.id}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showSuccess("Documento baixado com sucesso!");
}

// ===== carregamento inicial =====
const loading = computed(() => peticoes.loading);
const error = computed(() => peticoes.error || templates.lastError);
const items = computed(() => peticoes.items);

async function loadAll() {
  await clientes.fetchList({});
  await Promise.all([templates.fetch({ active: true }), peticoes.fetch({})]);
}

onMounted(loadAll);
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Petições</h1>
          <v-chip v-if="totalPeticoes" color="primary" size="small" variant="tonal">
            {{ totalPeticoes }} {{ totalPeticoes === 1 ? 'petição' : 'petições' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Cadastro de petições e geração de documentos</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-file-document-plus" @click="openCreate">
        Nova petição
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
            placeholder="Buscar por cliente, template..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" closable type="error" @click:close="peticoes.error = null">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <!-- Cliente com avatar -->
          <template #item.cliente="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <v-icon icon="mdi-file-document-outline" size="18" />
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">
                  {{ clienteNome(item.cliente, item.cliente_nome) }}
                </div>
              </div>
            </div>
          </template>

          <template #item.template="{ item }">
            {{ templateLabel(item.template) }}
          </template>

          <template #item.created_at="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ formatDate(item.created_at) }}</span>
          </template>

          <template #item.updated_at="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ formatDate(item.updated_at) }}</span>
          </template>

          <!-- Acoes (menu) -->
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
                  prepend-icon="mdi-eye-outline"
                  title="Visualizar"
                  @click="openOverview(item)"
                />
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  @click="openEdit(item)"
                />
                <v-list-item
                  :disabled="rendering && renderingId === item.id"
                  prepend-icon="mdi-file-export-outline"
                  title="Gerar documento"
                  @click="doRender(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="removePetition(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-file-document-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhuma petição cadastrada</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- SidePanel: criar/editar -->
    <SidePanel v-model="dialogUpsert" :width="680">
      <template #header>
        <div class="d-flex align-center">
          <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
            <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-file-document-plus'" size="18" />
          </v-avatar>
          <div>
            <div class="text-body-1 font-weight-bold">{{ editing ? "Editar petição" : "Nova petição" }}</div>
            <div v-if="editing" class="text-caption text-medium-emphasis">
              {{ clienteNome(editing.cliente, editing.cliente_nome) }} — {{ templateLabel(editing.template) }}
            </div>
          </div>
        </div>
      </template>

      <v-form @submit.prevent="saveUpsert">
        <v-row dense>
          <v-col cols="12" md="6">
            <v-select
              v-model="form.cliente"
              clearable
              item-title="title"
              item-value="value"
              :items="clientOptions"
              label="Cliente"
              :loading="clientes.loading"
              no-data-text="Nenhum cliente encontrado"
              :return-object="false"
              :rules="[(v:any) => (!!v) || 'Obrigatório']"
              :value-comparator="(a, b) => Number(a) === Number(b)"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-select
              v-model="form.template"
              clearable
              item-title="title"
              item-value="value"
              :items="templateOptions"
              label="Template"
              :return-object="false"
              :rules="[(v:any) => (!!v) || 'Obrigatório']"
              @update:model-value="(v) => loadFieldsForTemplate(v, true)"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-select
              v-model="selectedBeneficio"
              clearable
              :disabled="!form.cliente || !beneficioOptions.length"
              item-title="title"
              item-value="value"
              :items="beneficioOptions"
              label="Benefício"
              :no-data-text="form.cliente ? 'Nenhum benefício cadastrado' : 'Selecione um cliente'"
              persistent-hint
              :hint="!form.cliente ? '' : !beneficioOptions.length ? 'Cliente sem benefícios cadastrados' : ''"
              :return-object="false"
            />
          </v-col>

          <v-col cols="12">
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="text-subtitle-2">Contexto</div>
              <v-btn
                :disabled="
                  !form.cliente || fieldsLoading || fields.length === 0
                "
                prepend-icon="mdi-content-copy"
                size="small"
                title="Preencher com dados do cliente (inclui bancários)"
                variant="tonal"
                @click="tryPrefillFromSources"
              >
                Preencher com dados do cliente
              </v-btn>
            </div>

            <v-alert
              v-if="
                syntaxInfo && syntaxInfo.toLowerCase().includes('angle')
              "
              class="mb-4"
              type="warning"
              variant="tonal"
            >
              O template selecionado ainda possui marcadores
              <code>&lt;&lt; &gt;&gt;</code>. Atualize para Jinja
              <code>{{ "{" }}{{ "}" }}</code
              >.
            </v-alert>

            <v-skeleton-loader v-if="fieldsLoading" type="article" />

            <template v-else>
              <v-row v-if="fields.length > 0" dense>
                <v-col v-for="f in fields" :key="f.name" cols="12" md="6">
                  <v-switch
                    v-if="f.type === 'bool'"
                    v-model="form.context[f.name]"
                    hide-details
                    :label="f.raw || f.name"
                  />
                  <!-- Campo monetário com máscara R$ -->
                  <v-text-field
                    v-else-if="isCurrencyField(f.name)"
                    :model-value="formatCurrency(form.context[f.name])"
                    hide-details="auto"
                    :label="f.raw || f.name"
                    prefix="R$"
                    inputmode="decimal"
                    placeholder="0,00"
                    @update:model-value="(v: string) => {
                      const masked = applyCurrencyMask(v);
                      form.context[f.name] = parseCurrency(masked);
                    }"
                  />
                  <!-- Campo extenso (readonly, gerado automaticamente) -->
                  <v-text-field
                    v-else-if="isExtensoField(f.name)"
                    v-model="form.context[f.name]"
                    hide-details="auto"
                    :label="f.raw || f.name"
                    readonly
                    variant="filled"
                  />
                  <v-text-field
                    v-else
                    v-model="form.context[f.name]"
                    hide-details="auto"
                    :label="f.raw || f.name"
                    :type="f.type === 'int' ? 'number' : 'text'"
                  />
                </v-col>
              </v-row>

              <v-alert v-else type="info" variant="tonal">
                Nenhum campo detectado no template. Você ainda pode salvar a
                petição e informar o contexto manualmente no futuro.
              </v-alert>
            </template>
          </v-col>
        </v-row>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="saveUpsert">Salvar</v-btn>
      </template>
    </SidePanel>

    <!-- ─── SidePanel: Overview ─── -->
    <SidePanel v-model="dialogOverview" :width="820">
      <template #header>
        <div class="d-flex align-center">
          <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
            <v-icon icon="mdi-file-eye-outline" size="18" />
          </v-avatar>
          <div>
            <div class="text-body-1 font-weight-bold">Visualização do documento</div>
            <div v-if="overviewItem" class="text-caption text-medium-emphasis">
              {{ clienteNome(overviewItem.cliente, overviewItem.cliente_nome) }}
              — {{ templateLabel(overviewItem.template) }}
            </div>
          </div>
        </div>
      </template>

      <div v-if="overviewLoading" class="d-flex flex-column align-center justify-center py-12">
        <v-progress-circular color="primary" indeterminate size="48" width="4" />
        <div class="text-body-2 text-medium-emphasis mt-4">Gerando pré-visualização...</div>
      </div>

      <v-alert v-else-if="overviewError" type="error" class="mb-4">
        {{ overviewError }}
      </v-alert>

      <div v-else ref="docxContainer" class="docx-container" />

      <template #actions>
        <v-btn variant="text" @click="dialogOverview = false">Fechar</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-pencil-outline"
          variant="outlined"
          @click="dialogOverview = false; overviewItem && openEdit(overviewItem)"
        >
          Editar
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!overviewBlob"
          prepend-icon="mdi-download"
          @click="downloadOverview"
        >
          Baixar .docx
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
.docx-container {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 8px;
  min-height: 400px;
}
</style>

<style>
.docx-container .docx-wrapper {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  padding: 20px;
}

.docx-container .docx-wrapper > section.docx {
  margin: 0 auto;
  padding: 40px 60px;
  box-shadow: none;
}
</style>
