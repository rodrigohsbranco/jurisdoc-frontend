<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useClientesStore, type Cliente } from "@/stores/clientes";
import { useTemplatesStore, type TemplateField } from "@/stores/templates";
import { useContratosStore, type Contrato, type ContratoItem } from "@/stores/contratos";
import { useContasStore, type ContaBancaria } from "@/stores/contas";
import { useContasReuStore, type ContaBancariaReu } from "@/stores/contasReu";
import { useNumeroExtenso } from "@/composables/useNumeroExtenso";
import {
  normKey,
  isEmpty,
  detectCanon,
  isContratoField,
  valueFromSources,
  formatBancosEContratos,
  formatBancosReus,
} from "@/composables/useContratoPrefill";
import { formatCurrency, parseCurrency, applyCurrencyMask } from "@/composables/useCurrencyMask";
import api from "@/services/api";
import { friendlyError } from "@/utils/errorMessages";
import { useSnackbar } from "@/composables/useSnackbar";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const { numeroParaExtenso, isExtensoField, getBaseFieldNameForExtenso } = useNumeroExtenso();
const { showSuccess, showError, showInfo, showWarning } = useSnackbar();

const clientesStore = useClientesStore();
const templatesStore = useTemplatesStore();
const contratosStore = useContratosStore();
const contasStore = useContasStore();
const contasReuStore = useContasReuStore();

// ── UI state ──────────────────────────────────────────────
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "cliente", order: "asc" },
]);

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

function showSnackbar(msg: string, color: "success" | "error" | "info" | "warning" = "success") {
  if (color === "success") showSuccess(msg);
  else if (color === "error") showError(msg);
  else if (color === "info") showInfo(msg);
  else showWarning(msg);
}

// ── Helpers de exibicao ───────────────────────────────────
const clienteNome = (id?: number, fallback?: string | null) => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const cid = Number(id);
  if (!Number.isFinite(cid) || cid <= 0) return "\u2014";
  const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === cid);
  return c ? c.nome_completo || `#${cid}` : fallback || "\u2014";
};

const templateLabel = (id?: number, fallback?: string | null) => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const tid = Number(id);
  if (!Number.isFinite(tid) || tid <= 0) return "\u2014";
  const t = templatesStore.byId(tid);
  return t ? t.name : `#${tid}`;
};

const formatContratos = (contratos?: ContratoItem[]) => {
  if (!contratos?.length) return "\u2014";
  return `${contratos.length} contrato${contratos.length > 1 ? "s" : ""}`;
};

// ── Filtros & KPIs ────────────────────────────────────────
type QueueFilter = "todos" | "pendentes" | "ativos" | "inativos" | "sem-imagem";
const queueFilter = ref<QueueFilter>("todos");

const queueFilterOptions: Array<{ label: string; value: QueueFilter }> = [
  { label: "Todos", value: "todos" },
  { label: "Pendentes", value: "pendentes" },
  { label: "Ativos", value: "ativos" },
  { label: "Inativos", value: "inativos" },
  { label: "Sem imagem", value: "sem-imagem" },
];

function firstContrato(item: Contrato): ContratoItem | undefined {
  return item.contratos?.length ? item.contratos[0] : undefined;
}

function contratoSituacao(item: Contrato): string {
  return String(firstContrato(item)?.situacao || "").trim().toLowerCase();
}

function isContratoPendente(item: Contrato): boolean {
  const c = firstContrato(item);
  if (!c) return true;
  if (!c.numero_do_contrato?.trim()) return true;
  if (!c.banco_do_contrato?.trim()) return true;
  return contratoSituacao(item) === "pendente";
}

function statusLabel(item: Contrato): string {
  if (isContratoPendente(item)) return "Pendente";
  const s = contratoSituacao(item);
  if (s === "ativo") return "Ativo";
  if (s === "inativo") return "Inativo";
  if (s === "cancelado") return "Cancelado";
  return "Em an\u00e1lise";
}

function statusColor(item: Contrato): "warning" | "success" | "error" | undefined {
  const l = statusLabel(item);
  if (l === "Pendente") return "warning";
  if (l === "Ativo") return "success";
  if (l === "Inativo" || l === "Cancelado") return "error";
  return undefined;
}

function hasImagemContrato(item: Contrato): boolean {
  return Boolean(item.imagem_do_contrato?.trim());
}

const allItems = computed(() => contratosStore.items);
const loading = computed(() => contratosStore.loading);
const error = computed(() => contratosStore.error);

const kpis = computed(() => {
  const list = allItems.value;
  return {
    total: list.length,
    pendentes: list.filter(isContratoPendente).length,
    ativos: list.filter((i) => contratoSituacao(i) === "ativo").length,
    semImagem: list.filter((i) => !hasImagemContrato(i)).length,
  };
});

const items = computed(() => {
  const q = search.value.trim().toLowerCase();
  return allItems.value.filter((item) => {
    if (queueFilter.value === "pendentes" && !isContratoPendente(item)) return false;
    if (queueFilter.value === "ativos" && contratoSituacao(item) !== "ativo") return false;
    if (queueFilter.value === "inativos" && contratoSituacao(item) !== "inativo") return false;
    if (queueFilter.value === "sem-imagem" && hasImagemContrato(item)) return false;
    if (!q) return true;
    const c = firstContrato(item);
    return [
      clienteNome(item.cliente, item.cliente_nome),
      templateLabel(item.template, item.template_nome),
      c?.numero_do_contrato || "",
      c?.banco_do_contrato || "",
      statusLabel(item),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
});

// ── Table headers ─────────────────────────────────────────
const headers = [
  { title: "Nome", key: "cliente" },
  { title: "Template", key: "template" },
  { title: "Status", key: "status" },
  { title: "Contrato", key: "contratos" },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

// ── Select options ────────────────────────────────────────
const situacaoItems = [
  { title: "Ativo", value: "ativo" },
  { title: "Inativo", value: "inativo" },
  { title: "Pendente", value: "pendente" },
  { title: "Cancelado", value: "cancelado" },
];

const origemAverbacaoItems = [
  { title: "Averba\u00e7\u00e3o por Refinanciamento", value: "refinanciamento" },
  { title: "Averba\u00e7\u00e3o nova", value: "nova" },
];

const clienteOptions = computed(() =>
  clientesStore.items.map((c: Cliente) => ({ title: c.nome_completo, value: c.id })),
);

const templateOptions = computed(() =>
  templatesStore.items.map((t) => ({ title: t.name, value: t.id })),
);

const bancosReuOptions = ref<Array<{ title: string; value: string }>>([]);
const loadingBancosReu = ref(false);

async function loadBancosReuOptions() {
  if (bancosReuOptions.value.length > 0) return;
  loadingBancosReu.value = true;
  try {
    await contasReuStore.fetchAll();
    bancosReuOptions.value = (contasReuStore.items || []).map((b) => ({
      title: b.banco_nome || "",
      value: b.banco_nome || "",
    }));
  } catch {
    bancosReuOptions.value = [];
  } finally {
    loadingBancosReu.value = false;
  }
}

// ── Imagem existente (edit) ───────────────────────────────
const imagemExistenteUrl = ref<string | null>(null);
const imagemExistenteUrlCompleta = computed(() => {
  if (!imagemExistenteUrl.value) return null;
  if (imagemExistenteUrl.value.startsWith("http")) return imagemExistenteUrl.value;
  const baseURL = api.defaults.baseURL || "http://192.168.0.250:8000";
  const path = imagemExistenteUrl.value.startsWith("/")
    ? imagemExistenteUrl.value
    : `/${imagemExistenteUrl.value}`;
  return `${baseURL}${path}`;
});

// ── Create / Edit form ────────────────────────────────────
const dialog = ref(false);
const editing = ref<Contrato | null>(null);
const selectedBeneficio = ref<number | null>(null);
const form = ref<{
  cliente?: number;
  template?: number;
  contratos: ContratoItem[];
  imagem_do_contrato: File | null;
}>({ contratos: [], imagem_do_contrato: null });

const beneficioOptions = computed(() => {
  if (!form.value.cliente) return [];
  const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === Number(form.value.cliente));
  if (!c?.beneficios?.length) return [];
  return c.beneficios.map((b, i) => ({
    title: `${b.tipo || 'Benefício'} — ${b.numero}`,
    value: i,
  }));
});

async function openCreate() {
  editing.value = null;
  imagemExistenteUrl.value = null;
  selectedBeneficio.value = null;
  currencyDisplay.value.clear();
  form.value = { cliente: undefined, template: undefined, contratos: [{}], imagem_do_contrato: null };
  await loadBancosReuOptions();
  dialog.value = true;
}

async function openEdit(item: Contrato) {
  editing.value = item;
  imagemExistenteUrl.value = item.imagem_do_contrato || null;
  selectedBeneficio.value = null;
  currencyDisplay.value.clear();
  form.value = {
    cliente: item.cliente,
    template: item.template,
    contratos: item.contratos?.length ? [...item.contratos] : [{}],
    imagem_do_contrato: null,
  };
  // Restaura benefício do verifica_documento
  if (item.cliente && item.verifica_documento) {
    const numSalvo = item.verifica_documento.numero_beneficio || item.verifica_documento.beneficio || "";
    if (numSalvo) {
      const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === Number(item.cliente));
      if (c?.beneficios?.length) {
        const idx = c.beneficios.findIndex((b) => b.numero === numSalvo);
        if (idx >= 0) selectedBeneficio.value = idx;
      }
    }
  }
  await loadBancosReuOptions();
  dialog.value = true;
}

// Quando benefício muda, salva no verifica_documento do contrato sendo editado
watch(
  () => selectedBeneficio.value,
  (idx) => {
    if (idx === null || idx === undefined || !form.value.cliente) return;
    const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === Number(form.value.cliente));
    const b = c?.beneficios?.[idx];
    if (!b) return;
    // Guarda no editing.verifica_documento para que o verificação pegue depois
    if (editing.value) {
      if (!editing.value.verifica_documento) editing.value.verifica_documento = {};
      editing.value.verifica_documento.numero_beneficio = b.numero || "";
      editing.value.verifica_documento.tipo_beneficio = b.tipo || "";
      editing.value.verifica_documento.beneficio = b.numero || "";
    }
  }
);

// Quando cliente muda no form, reseta ou restaura benefício
watch(
  () => form.value.cliente,
  (cid) => {
    if (!cid) { selectedBeneficio.value = null; return; }
    selectedBeneficio.value = null;
    // Tenta restaurar do verifica_documento
    if (editing.value?.verifica_documento) {
      const numSalvo = editing.value.verifica_documento.numero_beneficio || editing.value.verifica_documento.beneficio || "";
      if (numSalvo) {
        const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === Number(cid));
        if (c?.beneficios?.length) {
          const idx = c.beneficios.findIndex((b) => b.numero === numSalvo);
          if (idx >= 0) selectedBeneficio.value = idx;
        }
      }
    }
  }
);

function addContrato() {
  form.value.contratos.push({});
}
function removeContrato(index: number) {
  if (form.value.contratos.length > 1) form.value.contratos.splice(index, 1);
}

// ── Máscara monetária para campos do contrato ─────────────
const CURRENCY_FIELDS = ['valor_parcela', 'iof', 'valor_do_emprestimo', 'valor_liberado'] as const;

// Display cache: armazena o texto formatado para cada campo/contrato
const currencyDisplay = ref<Map<string, string>>(new Map());

function getCurrencyKey(contrato: ContratoItem, field: string): string {
  // Usa o índice no array como parte da chave
  const idx = form.value.contratos.indexOf(contrato);
  return `${idx}_${field}`;
}

function getCurrencyDisplay(contrato: ContratoItem, field: typeof CURRENCY_FIELDS[number]): string {
  const key = getCurrencyKey(contrato, field);
  if (currencyDisplay.value.has(key)) return currencyDisplay.value.get(key)!;
  // Valor inicial do modelo
  return formatCurrency(contrato[field]);
}

function setCurrencyValue(contrato: ContratoItem, field: typeof CURRENCY_FIELDS[number], raw: string) {
  const key = getCurrencyKey(contrato, field);
  const masked = applyCurrencyMask(raw);
  currencyDisplay.value.set(key, masked);
  (contrato as any)[field] = parseCurrency(masked);
}

// ── Máscara mês/ano (MM/AAAA ↔ YYYY-MM) ─────────────────
type MonthField = 'data_inicio_desconto' | 'data_fim_desconto';

function getMonthDisplay(contrato: ContratoItem, field: MonthField): string {
  const val = contrato[field];
  if (!val) return '';
  // YYYY-MM → MM/AAAA
  const m = String(val).match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  // Já está em MM/AAAA
  if (/^\d{2}\/\d{4}$/.test(String(val))) return String(val);
  return String(val);
}

function setMonthValue(contrato: ContratoItem, field: MonthField, raw: string) {
  // Só aceita dígitos
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  // Formata como MM/AAAA enquanto digita
  let display = digits;
  if (digits.length > 2) {
    display = digits.slice(0, 2) + '/' + digits.slice(2);
  }
  // Quando completo (6 dígitos), converte para YYYY-MM no modelo
  if (digits.length === 6) {
    const mm = digits.slice(0, 2);
    const aaaa = digits.slice(2);
    const month = parseInt(mm, 10);
    if (month >= 1 && month <= 12) {
      (contrato as any)[field] = `${aaaa}-${mm}`;
    } else {
      (contrato as any)[field] = display;
    }
  } else {
    (contrato as any)[field] = display;
  }
  // Guarda display formatado
  const key = getCurrencyKey(contrato, field);
  currencyDisplay.value.set(key, display);
}

function getMonthDisplayCached(contrato: ContratoItem, field: MonthField): string {
  const key = getCurrencyKey(contrato, field);
  if (currencyDisplay.value.has(key)) return currencyDisplay.value.get(key)!;
  return getMonthDisplay(contrato, field);
}

async function save() {
  try {
    if (!form.value.cliente) { showSnackbar("Selecione o cliente.", "error"); return; }
    if (!form.value.template) { showSnackbar("Selecione o template.", "error"); return; }
    if (!form.value.contratos?.length) { showSnackbar("Adicione pelo menos um contrato.", "error"); return; }

    if (form.value.imagem_do_contrato) {
      const fd = new FormData();
      fd.append("cliente", String(form.value.cliente));
      fd.append("template", String(form.value.template));
      fd.append("contratos", JSON.stringify(form.value.contratos));
      fd.append("imagem_do_contrato", form.value.imagem_do_contrato);
      await (editing.value
        ? contratosStore.updateWithFile(editing.value.id, fd)
        : contratosStore.createWithFile(fd));
    } else {
      const payload: any = {
        cliente: Number(form.value.cliente),
        template: Number(form.value.template),
        contratos: form.value.contratos,
      };
      if (editing.value && !imagemExistenteUrl.value) payload.imagem_do_contrato = null;
      await (editing.value
        ? contratosStore.update(editing.value.id, payload)
        : contratosStore.create(payload));
    }
    showSnackbar(editing.value ? "Contrato atualizado com sucesso!" : "Contrato criado com sucesso!");
    dialog.value = false;
  } catch (e: any) {
    showSnackbar(friendlyError(e, 'contratos', editing.value ? 'update' : 'create'), "error");
  }
}

async function remove(item: Contrato) {
  confirmMessage.value = `Excluir o contrato #${item.id}?`;
  confirmAction.value = async () => {
    try {
      await contratosStore.remove(item.id);
      showSnackbar("Contrato exclu\u00eddo com sucesso!");
    } catch (error_: any) {
      showSnackbar(friendlyError(error_, 'contratos', 'remove'), "error");
    }
  };
  confirmVisible.value = true;
}

// ── Data-source helpers ───────────────────────────────────
async function getContaPrincipal(clienteId?: number): Promise<ContaBancaria | null> {
  const cid = Number(clienteId);
  if (!Number.isFinite(cid) || cid <= 0) return null;
  const cached = contasStore.principal(cid) || (contasStore.byCliente(cid) || [])[0];
  if (cached) return cached;
  try { await contasStore.fetchForCliente(cid); } catch { return null; }
  return contasStore.principal(cid) || (contasStore.byCliente(cid) || [])[0] || null;
}

async function getBancoReu(): Promise<ContaBancariaReu | null> {
  if (contasReuStore.items.length) return contasReuStore.items[0];
  try { await contasReuStore.fetchAll(); } catch { return null; }
  return contasReuStore.items[0] || null;
}

async function ensureCliente(clienteId: number): Promise<Cliente | null> {
  let c = (clientesStore.items as Cliente[]).find((x) => x.id === clienteId) || null;
  if (!c) { try { c = await clientesStore.getDetail(clienteId); } catch { /* noop */ } }
  return c;
}

function extractPathOnly(urlOrPath: string | null | undefined): string {
  if (!urlOrPath) return "";
  try { return new URL(String(urlOrPath)).pathname || ""; } catch { return String(urlOrPath).replace(/^https?:\/\/[^/]+/i, ""); }
}

// ── Verificacao helpers ───────────────────────────────────
function isImageField(field: TemplateField): boolean {
  const k = normKey(field.name);
  const rawK = normKey(field.raw || "");
  if (k.includes("imagemdocontrato") || rawK.includes("imagemdocontrato")) return false;
  return k.includes("imagem") || rawK.includes("imagem");
}

function isContratoFieldLocal(field: TemplateField): boolean {
  return isContratoField(field.name, field.raw);
}

/** Assign a resolved value to verificacaoData respecting field type. */
function assignTyped(data: Record<string, any>, key: string, value: unknown, field: TemplateField) {
  if (value === undefined || value === null || value === "") return;
  if (field.type === "bool") { data[key] = Boolean(value); return; }
  if (field.type === "int") {
    const n = Number(value);
    if (!Number.isNaN(n)) { data[key] = n; return; }
  }
  data[key] = String(value);
}

// ── Verificacao state ─────────────────────────────────────
const dialogVerificacao = ref(false);
const verificacaoLoading = ref(false);
const verificacaoItem = ref<Contrato | null>(null);
const verificacaoFields = ref<TemplateField[]>([]);
const verificacaoData = ref<Record<string, any>>({});
const verificacaoImages = ref<Record<string, File | null>>({});
const rendering = ref(false);
const renderFilename = ref("");

// ── Overview (preview do documento renderizado) ──────────
const dialogOverview = ref(false);
const overviewLoading = ref(false);
const overviewError = ref("");
const overviewItem = ref<Contrato | null>(null);
const overviewBlob = ref<Blob | null>(null);
const docxContainer = ref<HTMLElement | null>(null);

async function openOverview(item: Contrato) {
  overviewItem.value = item;
  overviewBlob.value = null;
  overviewError.value = "";
  dialogOverview.value = true;
  overviewLoading.value = true;

  try {
    if (!item.template) throw new Error("Template não encontrado.");

    // Salva verificação primeiro (garante dados atualizados)
    // Monta o contexto igual ao generateAndDownload
    const cliente = await ensureCliente(item.cliente);
    const conta = cliente ? await getContaPrincipal(cliente.id) : null;
    const bancoReu = await getBancoReu();

    const rawNameMap = new Map<string, string>();
    let templateFields: TemplateField[] = [];
    try {
      const resp = await templatesStore.fetchFields(item.template, { force: false });
      templateFields = resp.fields || [];
      for (const f of templateFields) { if (f.raw && f.name) rawNameMap.set(f.name, f.raw); }
    } catch { /* noop */ }

    // Contexto base do verifica_documento
    const context: Record<string, any> = {};
    if (item.verifica_documento && typeof item.verifica_documento === "object") {
      for (const [k, v] of Object.entries(item.verifica_documento)) {
        if (v != null) context[k] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
      }
    }

    // Preenche campos vazios das fontes
    const primeiro = item.contratos?.length ? item.contratos[0] : null;
    for (const field of templateFields) {
      const cur = context[field.name] || (rawNameMap.get(field.name) ? context[rawNameMap.get(field.name)!] : undefined);
      if (cur !== undefined && cur !== null && !(typeof cur === "string" && !cur.trim())) continue;
      const v = valueFromSources(cliente, conta, bancoReu, primeiro, field.name);
      if (v != null && v !== "") {
        context[field.name] = typeof v === "boolean" || typeof v === "number" ? v : String(v);
        const raw = rawNameMap.get(field.name);
        if (raw && raw !== field.name) context[raw] = context[field.name];
      }
    }

    // Contratos array
    if (item.contratos?.length) {
      context["contratos"] = item.contratos.map((c) => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(c)) {
          if (v != null) { let ck = k === "banco_contrato" ? "banco_do_contrato" : k; clean[ck] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v); }
        }
        return clean;
      });
      if (!context["bancos_e_contratos"]) {
        const bec = formatBancosEContratos(item.contratos);
        if (bec) context["bancos_e_contratos"] = bec;
      }
      if (!context["bancos_reus"]) {
        if (contasReuStore.items.length === 0) await contasReuStore.fetchAll();
        const br = formatBancosReus(item.contratos, contasReuStore.items);
        if (br) context["bancos_reus"] = br;
      }
    }

    // Cliente extras
    if (cliente) {
      const nome = cliente.nome_completo || "";
      context["nome_completo"] = nome; context["NOME_COMPLETO"] = nome;
      context["nome"] = nome; context["NOME"] = nome;
      context["idoso"] = Boolean(cliente.se_idoso);
      context["incapaz"] = Boolean(cliente.se_incapaz);
      context["criancaadolescente"] = Boolean(cliente.se_crianca_adolescente);
      context["se_idoso"] = Boolean(cliente.se_idoso);
      context["se_incapaz"] = Boolean(cliente.se_incapaz);
      context["se_crianca_adolescente"] = Boolean(cliente.se_crianca_adolescente);
    }

    // Extenso
    for (const [k, v] of Object.entries(context)) {
      if (k.endsWith("_extenso")) continue;
      const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) : NaN;
      if (!isNaN(num) && num !== 0) { const ek = `${k}_extenso`; if (!context[ek]) context[ek] = numeroParaExtenso(num); }
    }

    // Limpa contexto
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(context)) {
      if (v == null) continue;
      if (Array.isArray(v)) { if (v.length) clean[k] = v; continue; }
      if (typeof v === "object" && v.constructor === Object) { clean[k] = v; continue; }
      clean[k] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
    }

    // Renderiza o documento
    const result = await templatesStore.render(item.template, {
      context: clean,
      filename: `preview_${item.id}`,
    });
    overviewBlob.value = result.blob;
  } catch (err: any) {
    overviewError.value = friendlyError(err, "contratos", "render");
  } finally {
    overviewLoading.value = false;
  }

  // Renderiza após loading=false para que o container exista no DOM
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
  a.download = `contrato_${overviewItem.value.id}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showSnackbar("Documento baixado com sucesso!");
}

async function openVerificacao(item: Contrato) {
  verificacaoItem.value = item;
  verificacaoFields.value = [];
  verificacaoData.value = {};
  verificacaoImages.value = {};
  dialogVerificacao.value = true;

  if (!item.template) { contratosStore.error = "Template n\u00e3o encontrado."; return; }

  verificacaoLoading.value = true;
  try {
    const resp = await templatesStore.fetchFields(item.template, { force: true });
    verificacaoFields.value = resp.fields || [];

    const cliente = await ensureCliente(item.cliente);
    const conta = await getContaPrincipal(item.cliente);
    const bancoReu = await getBancoReu();
    const primeiro = item.contratos?.length ? item.contratos[0] : null;
    const multiContratos = (item.contratos?.length || 0) > 1;

    const data: Record<string, any> = {};
    const images: Record<string, File | null> = {};

    // STEP 1: init + prefill from sources
    for (const field of verificacaoFields.value) {
      const isImg = isImageField(field);
      const isCtr = isContratoFieldLocal(field);

      if (isCtr && multiContratos) {
        for (let i = 0; i < item.contratos!.length; i++) {
          const fk = `${field.name}_contrato_${i}`;
          if (isImg) { images[fk] = null; continue; }
          data[fk] = field.type === "bool" ? false : "";
          const v = valueFromSources(cliente, conta, bancoReu, item.contratos![i], field.name);
          assignTyped(data, fk, v, field);
        }
        continue;
      }

      if (isImg) { images[field.name] = null; continue; }
      data[field.name] = field.type === "bool" ? false : "";

      // Extenso detection
      if (isExtensoField(field.name)) {
        const baseName = getBaseFieldNameForExtenso(field.name);
        const baseVal = valueFromSources(cliente, conta, bancoReu, primeiro, baseName);
        if (baseVal != null) {
          const num = typeof baseVal === "string"
            ? parseFloat(baseVal.replace(/[^\d,.-]/g, "").replace(",", "."))
            : Number(baseVal);
          if (!isNaN(num)) { data[field.name] = numeroParaExtenso(num); continue; }
        }
      }

      const v = valueFromSources(cliente, conta, bancoReu, primeiro, field.name);
      assignTyped(data, field.name, v, field);
    }

    // STEP 2: auto-generate extenso for ALL numeric fields
    for (const [key, val] of Object.entries(data)) {
      if (val === "" || val === null || val === undefined) continue;
      const num = typeof val === "number" ? val : typeof val === "string" ? parseFloat(val.replace(/[^\d,.-]/g, "").replace(",", ".")) : NaN;
      if (isNaN(num) || num === 0) continue;
      // Generate extenso variant if not already present
      const extensoKey = `${key}_extenso`;
      if (!(extensoKey in data)) {
        data[extensoKey] = numeroParaExtenso(num);
      }
    }

    // STEP 3: bancos_e_contratos & bancos_reus from composable
    if (item.contratos?.length) {
      const bec = formatBancosEContratos(item.contratos);
      if (bec) data["bancos_e_contratos"] = bec;

      if (contasReuStore.items.length === 0) await contasReuStore.fetchAll();
      const br = formatBancosReus(item.contratos, contasReuStore.items);
      if (br) data["bancos_reus"] = br;
    }

    // STEP 4: overlay verifica_documento (user-edited values take priority)
    if (item.verifica_documento && typeof item.verifica_documento === "object") {
      for (const [key, value] of Object.entries(item.verifica_documento)) {
        if (isEmpty(value)) continue;
        if (key.includes("_contrato_")) { data[key] = value; continue; }
        const field = verificacaoFields.value.find((f) => f.name === key);
        if (field) { assignTyped(data, key, value, field); } else { data[key] = value; }
      }
    }

    verificacaoData.value = data;
    verificacaoImages.value = images;
    await nextTick();
  } catch (err: any) {
    contratosStore.error = friendlyError(err, 'templates', 'fields');
  } finally {
    verificacaoLoading.value = false;
  }
}

async function resetVerificacao() {
  if (!verificacaoItem.value) return;
  if (!confirm("Deseja resetar o documento? Todos os campos ser\u00e3o limpos e recarregados das fontes originais.")) return;
  // Re-open without verifica_documento overlay
  const item = { ...verificacaoItem.value, verifica_documento: null } as Contrato;
  await openVerificacao(item);
  showSnackbar("Documento resetado. Campos recarregados das fontes originais.");
}

// Watcher for extenso auto-generation (template fields + dynamic numeric fields)
watch(
  () => verificacaoData.value,
  (newData) => {
    // 1) Template extenso fields
    if (verificacaoFields.value?.length) {
      for (const field of verificacaoFields.value) {
        if (!isExtensoField(field.name)) continue;
        const baseName = getBaseFieldNameForExtenso(field.name);
        const baseVal = newData[baseName];
        if (baseVal == null) continue;
        const num = typeof baseVal === "string"
          ? parseFloat(baseVal.toString().replace(/[^\d,.-]/g, "").replace(",", "."))
          : Number(baseVal);
        if (!isNaN(num) && num !== 0) {
          verificacaoData.value[field.name] = numeroParaExtenso(num);
        } else if (num === 0 || baseVal === "" || baseVal === null) {
          verificacaoData.value[field.name] = "";
        }
      }
    }

    // 2) Auto-generate *_extenso for any numeric field that changed
    for (const [key, val] of Object.entries(newData)) {
      if (key.endsWith("_extenso")) continue; // skip extenso fields themselves
      const extensoKey = `${key}_extenso`;
      const num = typeof val === "number" ? val : typeof val === "string"
        ? parseFloat(val.replace(/[^\d,.-]/g, "").replace(",", "."))
        : NaN;
      if (!isNaN(num) && num !== 0) {
        const extensoVal = numeroParaExtenso(num);
        if (verificacaoData.value[extensoKey] !== extensoVal) {
          verificacaoData.value[extensoKey] = extensoVal;
        }
      } else if (extensoKey in verificacaoData.value && (val === "" || val === null || val === undefined || num === 0)) {
        verificacaoData.value[extensoKey] = "";
      }
    }
  },
  { deep: true },
);

function countEmptyFields(): number {
  let count = 0;
  for (const field of verificacaoFields.value) {
    if (isImageField(field)) {
      if (!verificacaoImages.value[field.name]) count++;
    } else {
      const v = verificacaoData.value[field.name];
      if (v === undefined || v === null || v === false || (typeof v === "string" && !v.trim()) || (typeof v === "number" && isNaN(v))) count++;
    }
  }
  return count;
}

// ── Save verificacao ──────────────────────────────────────
async function salvarDadosVerificacao(): Promise<void> {
  if (!verificacaoItem.value) throw new Error("Item de verifica\u00e7\u00e3o n\u00e3o encontrado");

  const dados: Record<string, any> = {};
  for (const [key, value] of Object.entries(verificacaoData.value)) {
    if (value === undefined || value === null) continue;
    dados[key] = value;
  }

  const primeiro = verificacaoItem.value.contratos?.length ? verificacaoItem.value.contratos[0] : {};
  const completos = { ...primeiro, ...dados };

  await contratosStore.update(verificacaoItem.value.id, { verifica_documento: completos });
  verificacaoItem.value.verifica_documento = completos;
}

async function saveVerificacao() {
  try {
    await salvarDadosVerificacao();
    showSnackbar("Dados salvos com sucesso!");
    dialogVerificacao.value = false;
  } catch (error_: any) {
    showSnackbar(friendlyError(error_, 'contratos', 'update'), "error");
  }
}

// ── Generate & Download ───────────────────────────────────
async function generateAndDownload() {
  if (!verificacaoItem.value?.template) { contratosStore.error = "Template n\u00e3o encontrado."; return; }

  rendering.value = true;
  try {
    await salvarDadosVerificacao();

    const cliente = await ensureCliente(verificacaoItem.value.cliente);
    const conta = cliente ? await getContaPrincipal(cliente.id) : null;
    const bancoReu = await getBancoReu();
    const multiContratos = (verificacaoItem.value.contratos?.length || 0) > 1;

    // Build raw name map
    const rawNameMap = new Map<string, string>();
    for (const f of verificacaoFields.value) { if (f.raw && f.name) rawNameMap.set(f.name, f.raw); }

    // Start from verifica_documento
    const context: Record<string, any> = {};
    if (verificacaoItem.value.verifica_documento && typeof verificacaoItem.value.verifica_documento === "object") {
      for (const [k, v] of Object.entries(verificacaoItem.value.verifica_documento)) {
        if (v != null) context[k] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
      }
    }

    // Fill empty fields from sources
    for (const field of verificacaoFields.value) {
      if (isContratoFieldLocal(field) && multiContratos) continue;
      if (field.name.toLowerCase().includes("bancos_e_contratos")) continue;

      const rawName = rawNameMap.get(field.name);
      const cur = context[field.name] || (rawName ? context[rawName] : undefined);
      if (cur !== undefined && cur !== null && !(typeof cur === "string" && !cur.trim())) continue;

      const primeiro = verificacaoItem.value.contratos?.length ? verificacaoItem.value.contratos[0] : null;
      const v = valueFromSources(cliente, conta, bancoReu, primeiro, field.name);
      if (v != null && v !== "") {
        assignTyped(context, field.name, v, field);
        if (rawName && rawName !== field.name) assignTyped(context, rawName, v, field);
      }
    }

    // Merge verificacaoData (non-indexed)
    for (const [key, value] of Object.entries(verificacaoData.value)) {
      if (key.includes("_contrato_") && isContratoField(key)) continue;
      if (key.toLowerCase().includes("bancos_e_contratos")) continue;
      if (value == null) continue;
      context[key] = typeof value === "boolean" || typeof value === "number" || typeof value === "string" ? value : String(value);
      const raw = rawNameMap.get(key);
      if (raw && raw !== key) context[raw] = context[key];
    }

    // Build contratos array
    if (verificacaoItem.value.contratos?.length) {
      const contratosArray: Record<string, any>[] = [];
      const contratosByIndex = new Map<number, Record<string, any>>();

      // Group indexed fields
      for (const [key, value] of Object.entries(verificacaoData.value)) {
        if (!key.includes("_contrato_")) continue;
        const parts = key.split("_contrato_");
        if (parts.length !== 2) continue;
        const idx = parseInt(parts[1]);
        if (isNaN(idx)) continue;
        if (!contratosByIndex.has(idx)) contratosByIndex.set(idx, {});
        let fn = parts[0].replace(/^item_/, "");
        if (fn === "banco_contrato") fn = "banco_do_contrato";
        contratosByIndex.get(idx)![fn] = value;
      }

      const len = Math.max(contratosByIndex.size, verificacaoItem.value.contratos.length);
      for (let i = 0; i < len; i++) {
        const orig = verificacaoItem.value.contratos[i] || {};
        const indexed = contratosByIndex.get(i) || {};
        const clean: Record<string, any> = {};

        // Original fields
        for (const [k, v] of Object.entries(orig)) {
          if (v == null) continue;
          let ck = k.replace(/^item_/, "");
          if (ck === "banco_contrato") ck = "banco_do_contrato";
          clean[ck] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
        }

        // Indexed overrides
        for (const [k, v] of Object.entries(indexed)) {
          if (v == null) continue;
          clean[k] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
        }

        // Fill empty contract fields from sources
        for (const field of verificacaoFields.value) {
          if (!isContratoFieldLocal(field)) continue;
          let fn = field.name.replace(/^item_/, "");
          if (fn === "banco_contrato") fn = "banco_do_contrato";
          const cur = clean[fn];
          if (cur !== undefined && cur !== null && !(typeof cur === "string" && !cur.trim())) continue;
          const v = valueFromSources(cliente, conta, bancoReu, orig as ContratoItem, field.name);
          if (v != null && v !== "") assignTyped(clean, fn, v, field);
        }

        contratosArray.push(clean);
      }

      if (contratosArray.length) context["contratos"] = contratosArray;

      // bancos_e_contratos
      if (!context["bancos_e_contratos"]) {
        const bec = formatBancosEContratos(contratosArray.map((c) => ({
          banco_do_contrato: c.banco_do_contrato || "",
          numero_do_contrato: c.numero_do_contrato || "",
        }) as ContratoItem));
        if (bec) context["bancos_e_contratos"] = bec;
      }

      // bancos_reus
      if (!context["bancos_reus"]) {
        if (contasReuStore.items.length === 0) await contasReuStore.fetchAll();
        const br = formatBancosReus(
          verificacaoItem.value.contratos,
          contasReuStore.items,
        );
        if (br) context["bancos_reus"] = br;
      }
    }

    // Client boolean / name fields
    if (cliente) {
      const nome = cliente.nome_completo || "";
      context["nome_completo"] = nome;
      context["NOME_COMPLETO"] = nome;
      context["nome"] = nome;
      context["NOME"] = nome;
      context["idoso"] = Boolean(cliente.se_idoso);
      context["incapaz"] = Boolean(cliente.se_incapaz);
      context["criancaadolescente"] = Boolean(cliente.se_crianca_adolescente);
      context["se_idoso"] = Boolean(cliente.se_idoso);
      context["se_incapaz"] = Boolean(cliente.se_incapaz);
      context["se_crianca_adolescente"] = Boolean(cliente.se_crianca_adolescente);
    }

    // Auto-generate *_extenso for any numeric value in context
    for (const [k, v] of Object.entries(context)) {
      if (k.endsWith("_extenso")) continue;
      const num = typeof v === "number" ? v : typeof v === "string"
        ? parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) : NaN;
      if (!isNaN(num) && num !== 0) {
        const ek = `${k}_extenso`;
        if (!context[ek]) context[ek] = numeroParaExtenso(num);
      }
    }

    // Clean context (remove nulls, keep primitives + arrays)
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(context)) {
      if (v == null) continue;
      if (Array.isArray(v)) { if (v.length) clean[k] = v; continue; }
      if (typeof v === "object" && v.constructor === Object) { clean[k] = v; continue; }
      clean[k] = typeof v === "boolean" || typeof v === "number" || typeof v === "string" ? v : String(v);
    }

    const filename = renderFilename.value.trim() || `contrato_${verificacaoItem.value.id}.docx`;
    const result = await templatesStore.render(verificacaoItem.value.template, { context: clean, filename });
    templatesStore.downloadRendered(result);
    showSnackbar("Documento gerado e baixado com sucesso!");
  } catch (err: any) {
    const msg = friendlyError(err, 'contratos', 'render');
    showSnackbar(msg, "error");
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        contratosStore.error = json.detail || text;
      } catch {
        contratosStore.error = friendlyError(err, 'contratos', 'render');
      }
    } else {
      contratosStore.error = friendlyError(err, 'contratos', 'render');
    }
  } finally {
    rendering.value = false;
  }
}

// ── Mount ─────────────────────────────────────────────────
onMounted(async () => {
  if (!clientesStore.items.length) await clientesStore.fetchList({});
  if (!templatesStore.items.length) templatesStore.items = await templatesStore.fetchAll();
  if (!contratosStore.items.length) await contratosStore.fetchList({});
});
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Contratos</h1>
          <v-chip v-if="kpis.total" color="primary" size="small" variant="tonal">
            {{ kpis.total }} {{ kpis.total === 1 ? 'contrato' : 'contratos' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Opera&ccedil;&atilde;o di&aacute;ria com foco em pend&ecirc;ncias, revis&atilde;o e assinatura
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-file-document-plus" @click="openCreate">
        Novo contrato
      </v-btn>
    </div>

    <!-- KPIs -->
    <v-row class="mb-4" dense>
      <v-col cols="12" md="3" sm="6">
        <v-card class="rounded" elevation="1" variant="tonal">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Total de contratos</div>
            <div class="text-h5 font-weight-bold">{{ kpis.total }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card class="rounded" elevation="1" variant="tonal" color="warning">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Pendentes</div>
            <div class="text-h5 font-weight-bold">{{ kpis.pendentes }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card class="rounded" elevation="1" variant="tonal" color="success">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Ativos</div>
            <div class="text-h5 font-weight-bold">{{ kpis.ativos }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card class="rounded" elevation="1" variant="tonal" color="error">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Sem imagem</div>
            <div class="text-h5 font-weight-bold">{{ kpis.semImagem }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Table card -->
    <v-card>
      <v-card-text class="pb-0">
        <div class="d-flex align-center flex-wrap ga-3 mb-4">
          <v-chip-group
            v-model="queueFilter"
            color="primary"
            mandatory
            variant="outlined"
          >
            <v-chip
              v-for="f in queueFilterOptions"
              :key="f.value"
              :color="queueFilter === f.value ? 'primary' : undefined"
              :value="f.value"
              :variant="queueFilter === f.value ? 'flat' : 'outlined'"
            >
              {{ f.label }}
            </v-chip>
          </v-chip-group>
          <v-spacer />
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            hide-details
            placeholder="Buscar por cliente, template, banco ou n&ordm; contrato"
            prepend-inner-icon="mdi-magnify"
            style="max-width: 380px"
          />
        </div>
      </v-card-text>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
        >
          <!-- Nome com avatar -->
          <template #item.cliente="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <v-icon icon="mdi-file-sign" size="18" />
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">
                  {{ clienteNome(item.cliente, item.cliente_nome) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatContratos(item.contratos) }}
                </div>
              </div>
            </div>
          </template>

          <template #item.template="{ item }">
            {{ templateLabel(item.template, item.template_nome) }}
          </template>

          <template #item.status="{ item }">
            <v-chip :color="statusColor(item)" size="small" variant="tonal">
              {{ statusLabel(item) }}
            </v-chip>
          </template>

          <template #item.contratos="{ item }">
            <span v-if="firstContrato(item)?.numero_do_contrato" class="text-body-2">
              {{ firstContrato(item)!.numero_do_contrato }}
            </span>
            <span v-else class="text-medium-emphasis">&mdash;</span>
          </template>

          <!-- Actions menu (3-dots) -->
          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item
                  prepend-icon="mdi-eye-outline"
                  title="Visualizar"
                  @click="openOverview(item)"
                />
                <v-list-item
                  prepend-icon="mdi-file-check-outline"
                  title="Verificar documento"
                  @click="openVerificacao(item)"
                />
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  @click="openEdit(item)"
                />
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
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              <div class="mb-2">Nenhum contrato para o filtro atual.</div>
              <v-btn color="primary" prepend-icon="mdi-file-document-plus" variant="tonal" @click="openCreate">
                Criar novo contrato
              </v-btn>
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- ─── SidePanel: Create / Edit ─── -->
    <SidePanel v-model="dialog" :width="700">
      <template #header>
        {{ editing ? 'Editar contrato' : 'Novo contrato' }}
      </template>

      <v-form @submit.prevent="save">
        <v-row>
          <v-col cols="12" md="6">
            <v-select v-model="form.cliente" :items="clienteOptions" label="Cliente *" required />
          </v-col>
          <v-col cols="12" md="6">
            <v-select v-model="form.template" :items="templateOptions" label="Template *" required />
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
              :return-object="false"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-file-input
              v-model="form.imagem_do_contrato"
              :label="imagemExistenteUrl && !form.imagem_do_contrato ? 'Trocar imagem' : 'Imagem do contrato'"
              accept="image/*"
              prepend-inner-icon="mdi-image"
              clearable
              show-size
              class="-mb-4"
            />
            <div
              v-if="imagemExistenteUrl && !form.imagem_do_contrato && imagemExistenteUrlCompleta"
              class="mt-0 d-flex align-center"
            >
              <a
                :href="imagemExistenteUrlCompleta || '#'"
                target="_blank"
                rel="noopener noreferrer"
                class="text-decoration-none text-truncate"
                style="font-size: 0.875rem; flex: 1; min-width: 0"
              >
                <v-icon icon="mdi-link" size="small" class="mr-1" />
                {{ imagemExistenteUrl }}
              </a>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                class="ml-2 flex-shrink-0"
                @click="imagemExistenteUrl = null; form.imagem_do_contrato = null"
              />
            </div>
          </v-col>
        </v-row>

        <!-- Contratos list -->
        <div v-for="(contrato, index) in form.contratos" :key="index" class="mb-6">
          <v-divider v-if="index > 0" class="mb-4" />
          <div class="d-flex align-center mb-4">
            <h3 class="text-h6">Contrato {{ index + 1 }}</h3>
            <v-spacer />
            <v-btn
              v-if="form.contratos.length > 1"
              color="error"
              icon
              size="small"
              variant="text"
              @click="removeContrato(index)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </div>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field v-model="contrato.numero_do_contrato" label="N&uacute;mero do contrato" />
            </v-col>
            <v-col cols="12" md="4">
              <v-autocomplete
                v-model="contrato.banco_do_contrato"
                :items="bancosReuOptions"
                label="Banco"
                :loading="loadingBancosReu"
                clearable
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                hint="Digite para buscar o banco"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select v-model="contrato.situacao" :items="situacaoItems" label="Situa&ccedil;&atilde;o" />
            </v-col>
            <v-col cols="12" md="4">
              <v-select v-model="contrato.origem_averbacao" :items="origemAverbacaoItems" label="Origem da averba&ccedil;&atilde;o" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="contrato.data_inclusao" label="Data de inclus&atilde;o" type="date" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getMonthDisplayCached(contrato, 'data_inicio_desconto')"
                label="Data início desconto"
                placeholder="MM/AAAA"
                inputmode="numeric"
                maxlength="7"
                @update:model-value="setMonthValue(contrato, 'data_inicio_desconto', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getMonthDisplayCached(contrato, 'data_fim_desconto')"
                label="Data fim desconto"
                placeholder="MM/AAAA"
                inputmode="numeric"
                maxlength="7"
                @update:model-value="setMonthValue(contrato, 'data_fim_desconto', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model.number="contrato.quantidade_parcelas" label="Quantidade de parcelas" type="number" min="0" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getCurrencyDisplay(contrato, 'valor_parcela')"
                label="Valor da parcela"
                prefix="R$"
                inputmode="decimal"
                placeholder="0,00"
                @update:model-value="setCurrencyValue(contrato, 'valor_parcela', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getCurrencyDisplay(contrato, 'iof')"
                label="IOF"
                prefix="R$"
                inputmode="decimal"
                placeholder="0,00"
                @update:model-value="setCurrencyValue(contrato, 'iof', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getCurrencyDisplay(contrato, 'valor_do_emprestimo')"
                label="Valor do empréstimo"
                prefix="R$"
                inputmode="decimal"
                placeholder="0,00"
                @update:model-value="setCurrencyValue(contrato, 'valor_do_emprestimo', $event)"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                :model-value="getCurrencyDisplay(contrato, 'valor_liberado')"
                label="Valor liberado"
                prefix="R$"
                inputmode="decimal"
                placeholder="0,00"
                @update:model-value="setCurrencyValue(contrato, 'valor_liberado', $event)"
              />
            </v-col>
          </v-row>
        </div>

        <v-btn color="primary" variant="outlined" prepend-icon="mdi-plus" class="mb-4" @click="addContrato">
          Adicionar Contrato
        </v-btn>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" @click="save">Salvar</v-btn>
      </template>
    </SidePanel>

    <!-- ─── SidePanel: Verificacao ─── -->
    <SidePanel v-model="dialogVerificacao" :width="700">
      <template #header>
        <div class="d-flex align-center" style="width: 100%">
          <div>
            <div class="text-subtitle-1">Verifica&ccedil;&atilde;o do Documento</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ verificacaoItem ? `Cliente: ${clienteNome(verificacaoItem.cliente, verificacaoItem.cliente_nome)}` : '' }}
            </div>
          </div>
          <v-spacer />
          <v-chip
            v-if="!verificacaoLoading && verificacaoFields.length > 0"
            :color="countEmptyFields() > 0 ? 'warning' : 'success'"
            size="small"
            variant="tonal"
          >
            {{ countEmptyFields() > 0 ? `${countEmptyFields()} campo(s) vazio(s)` : 'Todos os campos preenchidos' }}
          </v-chip>
        </div>
      </template>

      <v-skeleton-loader v-if="verificacaoLoading" type="table" />
      <div v-else>
        <v-alert v-if="verificacaoFields.length === 0" type="info" variant="tonal" class="mb-4">
          Nenhum campo detectado no template.
        </v-alert>
        <v-form v-else>
          <!-- Normal fields (non-contract or single contract) -->
          <v-row dense>
            <v-col
              v-for="field in verificacaoFields.filter(f =>
                !(isContratoFieldLocal(f) && verificacaoItem && verificacaoItem.contratos && verificacaoItem.contratos.length > 1)
              )"
              :key="field.name"
              cols="12"
              :md="isImageField(field) ? 12 : 6"
            >
              <v-switch
                v-if="field.type === 'bool'"
                v-model="verificacaoData[field.name]"
                :label="field.raw || field.name"
                hide-details
              />
              <v-file-input
                v-else-if="isImageField(field)"
                :label="field.raw || field.name"
                accept="image/*"
                prepend-inner-icon="mdi-image"
                :model-value="verificacaoImages[field.name] ? [verificacaoImages[field.name]!] : []"
                @update:model-value="(files: File | File[]) => {
                  verificacaoImages[field.name] = Array.isArray(files) ? (files[0] || null) : (files || null);
                }"
                hide-details="auto"
              />
              <v-text-field
                v-else
                v-model="verificacaoData[field.name]"
                :label="field.raw || field.name"
                :type="field.type === 'int' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                hide-details="auto"
              />
            </v-col>
          </v-row>

          <!-- Multi-contract indexed fields -->
          <template v-if="verificacaoItem && verificacaoItem.contratos && verificacaoItem.contratos.length > 1">
            <template v-for="(_, cIdx) in verificacaoItem.contratos" :key="`cs-${cIdx}`">
              <v-divider v-if="cIdx > 0" class="my-4" />
              <div class="text-subtitle-2 pa-2 font-weight-medium mb-2">Contrato {{ cIdx + 1 }}</div>
              <v-row dense>
                <v-col
                  v-for="field in verificacaoFields.filter(f => isContratoFieldLocal(f))"
                  :key="`${field.name}-${cIdx}`"
                  cols="12"
                  :md="isImageField(field) ? 12 : 6"
                >
                  <v-switch
                    v-if="field.type === 'bool'"
                    v-model="verificacaoData[`${field.name}_contrato_${cIdx}`]"
                    :label="field.raw || field.name"
                    hide-details
                  />
                  <v-file-input
                    v-else-if="isImageField(field)"
                    :label="field.raw || field.name"
                    accept="image/*"
                    prepend-inner-icon="mdi-image"
                    :model-value="verificacaoImages[`${field.name}_contrato_${cIdx}`] ? [verificacaoImages[`${field.name}_contrato_${cIdx}`]!] : []"
                    @update:model-value="(files: File | File[]) => {
                      const k = `${field.name}_contrato_${cIdx}`;
                      verificacaoImages[k] = Array.isArray(files) ? (files[0] || null) : (files || null);
                    }"
                    hide-details="auto"
                  />
                  <v-text-field
                    v-else
                    v-model="verificacaoData[`${field.name}_contrato_${cIdx}`]"
                    :label="field.raw || field.name"
                    :type="field.type === 'int' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                    hide-details="auto"
                  />
                </v-col>
              </v-row>
            </template>
          </template>
        </v-form>
      </div>

      <template #actions>
        <v-btn
          color="warning"
          variant="outlined"
          prepend-icon="mdi-refresh"
          :loading="verificacaoLoading"
          @click="resetVerificacao"
        >
          Resetar Documento
        </v-btn>
        <v-btn variant="text" @click="dialogVerificacao = false">Cancelar</v-btn>
        <v-btn color="primary" variant="outlined" @click="saveVerificacao">Salvar</v-btn>
        <v-btn color="primary" :loading="rendering" @click="generateAndDownload">Gerar e Baixar</v-btn>
      </template>
    </SidePanel>

    <!-- ─── SidePanel: Overview (documento renderizado) ─── -->
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
              — {{ templateLabel(overviewItem.template, overviewItem.template_nome) }}
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
          prepend-icon="mdi-file-check-outline"
          variant="outlined"
          @click="dialogOverview = false; overviewItem && openVerificacao(overviewItem)"
        >
          Editar campos
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
/* docx-preview renderiza com classes próprias */
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
