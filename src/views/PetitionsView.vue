<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { type Cliente, useClientesStore } from "@/stores/clientes";
import { type ContaBancaria, useContasStore } from "@/stores/contas";
import { type Petition, usePeticoesStore } from "@/stores/peticoes";
import { type TemplateField, useTemplatesStore } from "@/stores/templates";

const peticoes = usePeticoesStore();
const templates = useTemplatesStore();
const clientes = useClientesStore();
const contas = useContasStore();

// =========================
// Config de prefill
// =========================
const PREFILL_MASKS = true; // aplica máscara em CPF/CEP

// normaliza chave p/ comparação
const normKey = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const maskCPF = (cpf?: string | null) => {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "").slice(0, 11);
  if (!PREFILL_MASKS) return d;
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};

const maskCEP = (cep?: string | null) => {
  if (!cep) return "";
  const d = cep.replace(/\D/g, "").slice(0, 8);
  if (!PREFILL_MASKS) return d;
  return d.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
};

const composeEndereco = (c: Cliente) => {
  const partes = [
    [c.logradouro, c.numero].filter(Boolean).join(", "),
    c.bairro,
    [c.cidade, (c.uf || "")?.toUpperCase()].filter(Boolean).join("/"),
    maskCEP(c.cep),
  ].filter(Boolean);
  return partes.join(" – ");
};

// Sinônimos → chave canônica (cliente + bancário)
const SYNONYMS: Record<string, string[]> = {
  // cliente
  nome: [
    "nome",
    "nomecliente",
    "cliente",
    "nomecompleto",
    "autor",
    "requerente",
  ],
  cpf: ["cpf", "cpfrequerente", "documentocpf"],
  rg: ["rg", "identidade"],
  orgaoexpedidor: ["orgaoexpedidor", "oexpedidor", "oexp", "expedidor"],
  qualificacao: ["qualificacao", "ocupacao", "profissao"],
  idoso: ["idoso", "eidoso", "seidoso", "senior"],
  logradouro: ["logradouro", "rua", "endereco", "end", "endereco_rua"],
  numero: ["numero", "num", "n"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio"],
  cep: ["cep", "codigopostal", "codpostal"],
  uf: ["uf", "estado", "siglaestado"],
  enderecocompleto: [
    "enderecocompleto",
    "enderecoformatado",
    "enderecofull",
    "endereco_full",
    "enderecocompletoformatado",
    "endereco",
  ],
  cidadeuf: ["cidadeuf", "localidade", "cidade_uf"],
  // bancário (conta principal)
  banco: [
    "banco",
    "banco_nome",
    "nomebanco",
    "bancodesc",
    "codigo_banco",
    "codigo_bco",
    "bancoquerecebe",
    "banco_que_recebe",
    "bancodestino",
    "bancorecebedor",
    "bancobeneficiario",
  ],
  agencia: [
    "agencia",
    "ag",
    "nragencia",
    "agenciaquerecebe",
    "agencia_que_recebe",
    "agenciadestino",
  ],
  conta: [
    "conta",
    "nconta",
    "contacorrente",
    "contanumero",
    "conta_numero",
    "contaquerecebe",
    "conta_que_recebe",
    "contadestino",
  ],
  digito: ["digito", "dv", "digitoverificador"],
  tipoconta: ["tipoconta", "tipo", "contatipo", "tipo_conta"],
  contaformatada: ["contaformatada", "agenciaconta", "contacompleta"],

  // novos sinalizadores do cliente
  incapaz: ["incapaz", "interditado", "curatelado", "tutelado"],
  criancaadolescente: [
    "criancaadolescente",
    "crianca_adolescente",
    "menor",
    "crianca",
    "adolescente",
    "criancaouadolescente",
  ],

  // dados civis
  nacionalidade: ["nacionalidade"],
  estadocivil: ["estadocivil", "estado_civil"],
  profissao: ["profissao", "ocupacao"],
};

const LOOKUP = new Map<string, string>();
for (const [canon, list] of Object.entries(SYNONYMS)) {
  LOOKUP.set(canon, canon);
  for (const s of list) LOOKUP.set(s, canon);
}

function detectCanon(k: string): string {
  if (LOOKUP.has(k)) return LOOKUP.get(k)!; // já é sinônimo conhecido

  // bancário (sub-string match robusto)
  if (k.includes("banco")) return "banco";
  if (k.includes("agencia") || k === "ag") return "agencia";
  if (k.includes("conta")) return "conta";
  if (k.includes("digito") || k === "dv") return "digito";
  if ((k.includes("tipo") && k.includes("conta")) || k === "tipoconta")
    return "tipoconta";

  // cliente (alguns atalhos úteis)
  if (k.includes("enderecocompleto") || k === "endereco")
    return "enderecocompleto";
  if (k.includes("cidadeuf")) return "cidadeuf";

  // novos: criança/adolescente
  if (
    k.includes("crianca") ||
    k.includes("adolescente") ||
    k.includes("menor")
  ) {
    return "criancaadolescente";
  }

  // novos: estado civil
  if ((k.includes("estado") && k.includes("civil")) || k === "estadocivil") {
    return "estadocivil";
  }

  return k; // sem match: deixa passar
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// pega conta principal do cliente (ou 1ª)
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

// resolve valor para um field do template a partir do cliente e (opcional) conta
const valueFromSources = (
  c: Cliente | null,
  acc: ContaBancaria | null,
  rawFieldName: string
) => {
  const k = normKey(rawFieldName);
  const canon = detectCanon(k);

  // 1) campos do cliente
  if (c) {
    switch (canon) {
      case "nome": {
        return c.nome_completo || "";
      }
      case "cpf": {
        return maskCPF(c.cpf);
      }
      case "rg": {
        return c.rg || "";
      }
      case "orgaoexpedidor": {
        return c.orgao_expedidor || "";
      }
      case "qualificacao": {
        return c.qualificacao || "";
      }
      case "idoso": {
        return !!c.se_idoso;
      }
      case "logradouro": {
        return c.logradouro || "";
      }
      case "numero": {
        return c.numero || "";
      }
      case "bairro": {
        return c.bairro || "";
      }
      case "cidade": {
        return c.cidade || "";
      }
      case "cep": {
        return maskCEP(c.cep);
      }
      case "uf": {
        return (c.uf || "").toUpperCase();
      }
      case "enderecocompleto": {
        return composeEndereco(c);
      }
      case "cidadeuf": {
        return (
          [c.cidade, (c.uf || "")?.toUpperCase()].filter(Boolean).join("/") ||
          ""
        );
      }
      case "incapaz": {
        return !!c.se_incapaz;
      }
      case "criancaadolescente": {
        return !!c.se_crianca_adolescente;
      }
      case "nacionalidade": {
        return c.nacionalidade || "";
      }
      case "estadocivil": {
        return c.estado_civil || "";
      }
      case "profissao": {
        return c.profissao || "";
      }
    }
  }

  // 2) campos bancários (conta principal)
  if (acc) {
    switch (canon) {
      case "banco": {
        // Agora busca a descrição ativa (se existir) ou o nome do banco
        return (acc as any).descricao_ativa || acc.banco_nome || "";
      }
      case "agencia": {
        return acc.agencia || "";
      }
      case "conta": {
        return acc.conta || "";
      }
      case "digito": {
        return acc.digito || "";
      }
      case "tipoconta": {
        return acc.tipo || "";
      }
      case "contaformatada": {
        const ag = acc.agencia ?? "";
        const num = acc.conta ?? "";
        const dv = acc.digito ?? "";
        return [ag, num].filter(Boolean).join("/") + (dv ? `-${dv}` : "");
      }
    }
  }

  // sem match
  return undefined;
};

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

// Opções para selects
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
  { title: "Ações", key: "actions", sortable: false, align: "end" as const },
];

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

    // Tenta autopreencher se já houver cliente selecionado
    await nextTick();
    await tryPrefillFromSources();
  } catch (error_: any) {
    templates.lastError =
      error_?.response?.data?.detail ||
      error_?.message ||
      "Falha ao carregar campos do template";
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
    if (!cid) return;
    ensureClientInCache(Number(cid));

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
    const v = valueFromSources(c!, acc, f.name);
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
}

async function openCreate() {
  editing.value = null;
  form.cliente = null;
  form.template = null;
  form.context = {};
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
  dialogUpsert.value = true;
  ensureClientInCache(p.cliente);
  // também podemos pré-carregar contas para o cliente já selecionado
  if (p.cliente) contas.fetchForCliente(Number(p.cliente)).catch(() => {});
  loadFieldsForTemplate(p.template || null, true);
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
  } catch (error_: any) {
    peticoes.error =
      error_?.response?.data?.detail ||
      error_?.message ||
      "Erro ao salvar petição.";
  }
}

async function removePetition(p: Petition) {
  if (!confirm("Excluir esta petição?")) return;
  try {
    await peticoes.remove(p.id);
  } catch (error_: any) {
    peticoes.error =
      error_?.response?.data?.detail || "Não foi possível excluir.";
  }
}

// ===== render =====
const dialogRender = ref(false);
const rendering = ref(false);
const renderItem = ref<Petition | null>(null);
const renderFilename = ref("");

async function openRender(p: Petition) {
  try {
    await loadFieldsForTemplate(p.template, false);
    if (syntaxInfo.value && syntaxInfo.value.toLowerCase().includes("angle"))
      return;
    renderItem.value = p;
    renderFilename.value = `peticao_${p.id}.docx`;
    dialogRender.value = true;
  } catch (error_: any) {
    peticoes.error =
      error_?.response?.data?.detail ||
      error_?.message ||
      "Não foi possível abrir geração.";
  }
}

async function doRender() {
  if (!renderItem.value) return;
  rendering.value = true;
  try {
    const result = await peticoes.render(renderItem.value.id, {
      filename: renderFilename.value.trim() || undefined,
      strict: true,
    });
    peticoes.downloadRendered(result);
    dialogRender.value = false;
  } catch {
    // erro já populado
  } finally {
    rendering.value = false;
  }
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
    <!-- Header -->
    <v-card class="rounded mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Petições</div>
          <div class="text-body-2 text-medium-emphasis">
            Cadastro de petições e geração de documentos
          </div>
        </div>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-file-document-plus"
          @click="openCreate"
          >Nova petição</v-btn
        >
      </v-card-title>
    </v-card>

    <!-- Lista -->
    <v-card class="rounded" elevation="2">
      <v-card-title class="d-flex align-center">
        <v-responsive max-width="300px" class="mx-2">
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            variant="outlined"
            hide-details
            label="Buscar"
            prepend-inner-icon="mdi-magnify"
          />
        </v-responsive>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>
        <v-data-table
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.cliente="{ item }">
            {{ clienteNome(item.cliente, item.cliente_nome) }}
          </template>

          <template #item.template="{ item }">
            {{ templateLabel(item.template) }}
          </template>

          <template #item.created_at="{ item }">
            {{
              item.created_at && !isNaN(new Date(item.created_at).getTime())
                ? new Date(item.created_at).toLocaleString()
                : "—"
            }}
          </template>

          <template #item.updated_at="{ item }">
            {{
              item.updated_at && !isNaN(new Date(item.updated_at).getTime())
                ? new Date(item.updated_at).toLocaleString()
                : "—"
            }}
          </template>

          <template #item.actions="{ item }">
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn icon size="small" variant="text" @click="openRender(item)">
              <v-icon icon="mdi-download" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="removePetition(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhuma petição cadastrada.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog: criar/editar -->
    <v-dialog v-model="dialogUpsert" max-width="920">
      <v-card>
        <v-card-title>{{
          editing ? "Editar petição" : "Nova petição"
        }}</v-card-title>
        <v-card-text>
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
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveUpsert">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: render -->
    <v-dialog v-model="dialogRender" max-width="720">
      <v-card>
        <v-card-title>Gerar documento</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="doRender">
            <v-text-field
              v-model="renderFilename"
              class="mb-4"
              label="Nome do arquivo (.docx)"
            />

            <v-alert
              v-if="syntaxInfo && syntaxInfo.toLowerCase().includes('angle')"
              class="mb-4"
              type="warning"
              variant="tonal"
            >
              O template ainda possui <code>&lt;&lt; &gt;&gt;</code>. Atualize
              para Jinja antes de gerar.
            </v-alert>

            <div class="text-caption text-medium-emphasis">
              A geração usa o contexto salvo na petição. Para alterar, edite a
              petição.
            </div>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogRender = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="rendering" @click="doRender"
            >Gerar & baixar</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped></style>
