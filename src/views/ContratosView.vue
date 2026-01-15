<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useClientesStore, type Cliente } from "@/stores/clientes";
import { useTemplatesStore, type TemplateField } from "@/stores/templates";
import { useContratosStore, type Contrato, type ContratoItem } from "@/stores/contratos";
import { useContasStore, type ContaBancaria } from "@/stores/contas";
import { useContasReuStore, type ContaBancariaReu } from "@/stores/contasReu";
import { useNumeroExtenso } from "@/composables/useNumeroExtenso";
import api from "@/services/api";

const { numeroParaExtenso, isExtensoField, getBaseFieldNameForExtenso } = useNumeroExtenso();

const clientesStore = useClientesStore();
const templatesStore = useTemplatesStore();
const contratosStore = useContratosStore();
const contasStore = useContasStore();
const contasReuStore = useContasReuStore();

// UI state
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "cliente", order: "asc" },
]);

// Snackbar para feedback
const snackbar = ref(false);
const snackbarMessage = ref("");
const snackbarColor = ref<"success" | "error" | "info" | "warning">("success");

function showSnackbar(message: string, color: "success" | "error" | "info" | "warning" = "success") {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// URL completa da imagem existente
const imagemExistenteUrlCompleta = computed(() => {
  if (!imagemExistenteUrl.value) return null;
  // Se já for uma URL completa, retorna como está
  if (imagemExistenteUrl.value.startsWith("http://") || imagemExistenteUrl.value.startsWith("https://")) {
    return imagemExistenteUrl.value;
  }
  // Caso contrário, constrói a URL completa usando o baseURL da API
  const baseURL = api.defaults.baseURL || "http://192.168.0.250:8000";
  // Remove barra inicial se houver e adiciona a barra corretamente
  const path = imagemExistenteUrl.value.startsWith("/") 
    ? imagemExistenteUrl.value 
    : `/${imagemExistenteUrl.value}`;
  return `${baseURL}${path}`;
});

// Estado da lista (usa o store)
const items = computed(() => contratosStore.items);
const loading = computed(() => contratosStore.loading);
const error = computed(() => contratosStore.error);

// Headers da tabela
const headers = [
  { title: "Cliente", key: "cliente" },
  { title: "Template", key: "template" },
  { title: "Contrato", key: "contratos" },
  { title: "Ações", key: "actions", sortable: false, align: "end" as const },
];

// Funções helper para exibição
const clienteNome = (id?: number, fallback?: string | null) => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const cid = Number(id);
  if (!Number.isFinite(cid) || cid <= 0) return "—";
  const c = (clientesStore.items as Cliente[]).find((x) => Number(x.id) === cid);
  if (c) return c.nome_completo || `#${cid}`;
  return fallback || "—";
};

const templateLabel = (id?: number, fallback?: string | null) => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const tid = Number(id);
  if (!Number.isFinite(tid) || tid <= 0) return "—";
  const t = templatesStore.byId(tid);
  return t ? t.name : `#${tid}`;
};

const formatContratos = (contratos?: ContratoItem[]) => {
  if (!contratos || !Array.isArray(contratos) || contratos.length === 0) {
    return "—";
  }
  return `${contratos.length} contrato${contratos.length > 1 ? "s" : ""}`;
};

// Opções para selects
const situacaoItems = [
  { title: "Ativo", value: "ativo" },
  { title: "Inativo", value: "inativo" },
  { title: "Pendente", value: "pendente" },
  { title: "Cancelado", value: "cancelado" },
];

const origemAverbacaoItems = [
  { title: "Averbação por Refinanciamento", value: "refinanciamento" },
  { title: "Averbação nova", value: "nova" },
];

// Lista de clientes para o select
const clienteOptions = computed(() => {
  return clientesStore.items.map((c: Cliente) => ({
    title: c.nome_completo,
    value: c.id,
  }));
});

// Lista de templates para o select
const templateOptions = computed(() => {
  return templatesStore.items.map((t) => ({
    title: t.name,
    value: t.id,
  }));
});

// Dialog criar/editar
const dialog = ref(false);
const editing = ref<Contrato | null>(null);
const imagemExistenteUrl = ref<string | null>(null); // URL da imagem existente quando editando
const form = ref<{
  cliente?: number;
  template?: number;
  contratos: ContratoItem[];
  imagem_do_contrato: File | null;
}>({
  contratos: [],
  imagem_do_contrato: null,
});

// Bancos réus para o select de banco_do_contrato
const bancosReuOptions = ref<Array<{ title: string; value: string }>>([]);
const loadingBancosReu = ref(false);

async function loadBancosReuForCliente(clienteId?: number) {
  // Agora os bancos não estão mais atrelados a clientes, carregamos todos
  // Se já tiver carregado, não precisa carregar novamente
  if (bancosReuOptions.value.length > 0) {
    return;
  }
  
  loadingBancosReu.value = true;
  try {
    await contasReuStore.fetchAll();
    const bancos = contasReuStore.items || [];
    bancosReuOptions.value = bancos.map((banco) => ({
      title: banco.banco_nome || "",
      value: banco.banco_nome || "",
    }));
  } catch (error) {
    console.error("Erro ao carregar bancos réus:", error);
    bancosReuOptions.value = [];
  } finally {
    loadingBancosReu.value = false;
  }
}

async function openCreate() {
  editing.value = null;
  imagemExistenteUrl.value = null;
  form.value = {
    cliente: undefined,
    template: undefined,
    contratos: [{}], // Inicia com um contrato vazio
    imagem_do_contrato: null,
  };
  // Carrega todos os bancos do réu ao abrir o dialog
  await loadBancosReuForCliente();
  dialog.value = true;
}

function addContrato() {
  form.value.contratos.push({});
}

function removeContrato(index: number) {
  if (form.value.contratos.length > 1) {
    form.value.contratos.splice(index, 1);
  }
}

async function openEdit(item: Contrato) {
  editing.value = item;
  // Carrega a URL da imagem existente se houver
  imagemExistenteUrl.value = item.imagem_do_contrato || null;
  form.value = {
    cliente: item.cliente,
    template: item.template,
    contratos: item.contratos && item.contratos.length > 0 
      ? [...item.contratos] 
      : [{}],
    imagem_do_contrato: null, // Nova imagem será carregada se o usuário selecionar
  };
  // Carrega todos os bancos réus ao abrir o dialog
  await loadBancosReuForCliente();
  dialog.value = true;
}

async function save() {
  try {
    if (!form.value.cliente) {
      contratosStore.error = "Selecione o cliente.";
      showSnackbar("Selecione o cliente.", "error");
      return;
    }
    if (!form.value.template) {
      contratosStore.error = "Selecione o template.";
      showSnackbar("Selecione o template.", "error");
      return;
    }
    if (!form.value.contratos || form.value.contratos.length === 0) {
      contratosStore.error = "Adicione pelo menos um contrato.";
      showSnackbar("Adicione pelo menos um contrato.", "error");
      return;
    }

    // Prepara FormData para enviar imagem se houver nova imagem
    if (form.value.imagem_do_contrato) {
      const formData = new FormData();
      formData.append("cliente", String(form.value.cliente));
      formData.append("template", String(form.value.template));
      formData.append("contratos", JSON.stringify(form.value.contratos));
      formData.append("imagem_do_contrato", form.value.imagem_do_contrato);
      
      await (editing.value
        ? contratosStore.updateWithFile(editing.value.id, formData)
        : contratosStore.createWithFile(formData));
    } else {
      const payload: any = {
        cliente: Number(form.value.cliente),
        template: Number(form.value.template),
        contratos: form.value.contratos,
      };
      
      // Se estiver editando e não houver nova imagem
      if (editing.value) {
        // Se a imagem existente foi removida explicitamente (imagemExistenteUrl foi limpo)
        // e não há nova imagem, envia null para remover
        if (!imagemExistenteUrl.value && !form.value.imagem_do_contrato) {
          payload.imagem_do_contrato = null;
        }
        // Caso contrário, não envia o campo imagem_do_contrato
        // O backend manterá a imagem existente
      }

      await (editing.value
        ? contratosStore.update(editing.value.id, payload)
        : contratosStore.create(payload));
    }
    
    showSnackbar(
      editing.value ? "Contrato atualizado com sucesso!" : "Contrato criado com sucesso!",
      "success"
    );
    dialog.value = false;
  } catch (error_) {
    // Erro já está no store
    console.error(error_);
    const errorMessage = contratosStore.error || "Erro ao salvar o contrato. Tente novamente.";
    showSnackbar(errorMessage, "error");
  }
}

async function remove(item: Contrato) {
  if (!confirm(`Excluir o contrato #${item.id}?`)) return;
  try {
    await contratosStore.remove(item.id);
    showSnackbar("Contrato excluído com sucesso!", "success");
  } catch (error_) {
    // Erro já está no store
    console.error(error_);
    const errorMessage = contratosStore.error || "Erro ao excluir o contrato. Tente novamente.";
    showSnackbar(errorMessage, "error");
  }
}

// =========================
// Modal de Verificação - Helpers
// =========================
const normKey = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");


// Sinônimos → chave canônica
const SYNONYMS: Record<string, string[]> = {
  // cliente
  nome: ["nome", "nomecompleto", "nome_completo", "cliente", "cliente_nome"],
  cpf: ["cpf"],
  rg: ["rg"],
  orgaoexpedidor: ["orgaoexpedidor", "orgao_expedidor", "orgao"],
  logradouro: ["logradouro", "endereco", "rua"],
  numero: ["numero", "num"],
  bairro: ["bairro"],
  cidade: ["cidade"],
  cep: ["cep"],
  uf: ["uf", "estado"],
  profissao: ["profissao", "ocupacao"],
  nacionalidade: ["nacionalidade"],
  estadocivil: ["estadocivil", "estado_civil"],
  qualificacao: ["qualificacao"],
  idoso: ["idoso", "se_idoso"],
  incapaz: ["incapaz", "se_incapaz", "interditado", "curatelado"],
  criancaadolescente: ["criancaadolescente", "crianca_adolescente", "menor", "crianca", "adolescente"],
  
  // conta bancária
  banco: ["banco", "bancocliente", "banco_cliente"],
  agencia: ["agencia", "ag", "nragencia"],
  conta: ["conta", "nconta", "contacorrente", "contanumero"],
  digito: ["digito", "dv", "digitoverificador"],
  tipoconta: ["tipoconta", "tipo", "contatipo", "tipo_conta"],
  contaformatada: ["contaformatada", "agenciaconta", "contacompleta"],
  
  // banco do réu
  banco_reu: ["banco_reu", "bancoreu", "banco_devedor", "bancodevedor"],
  cnpj_banco: ["cnpj_banco", "cnpjbanco", "cnpj_banco_reu"],
  logradouro_banco: ["logradouro_banco", "logradourobanco", "endereco_banco"],
  cidade_banco: ["cidade_banco", "cidadebanco"],
  estado_banco: ["estado_banco", "estadobanco", "uf_banco"],
  cep_banco: ["cep_banco", "cepbanco"],
  
  // contrato
  numero_contrato: ["numero_contrato", "numerocontrato", "numero_do_contrato", "numerodocontrato"],
  banco_contrato: ["banco_contrato", "bancocontrato", "banco_do_contrato", "bancodocontrato"],
  situacao: ["situacao", "situacao_contrato"],
  origem_averbacao: ["origem_averbacao", "origemaverbacao", "origem"],
  data_inclusao: ["data_inclusao", "datainclusao"],
  data_inicio_desconto: ["data_inicio_desconto", "datainiciodesconto", "inicio_desconto"],
  data_fim_desconto: ["data_fim_desconto", "datafimdesconto", "fim_desconto"],
  quantidade_parcelas: ["quantidade_parcelas", "quantidadeparcelas", "parcelas"],
  valor_parcela: ["valor_parcela", "valorparcela"],
  iof: ["iof"],
  valor_do_emprestimo: ["valor_do_emprestimo", "valordoemprestimo", "valor_emprestimo", "valoremprestado", "valor_emprestado_contrato", "valoremprestadocontrato"],
  valor_liberado: ["valor_liberado", "valorliberado"],
};

const LOOKUP = new Map<string, string>();
for (const [canon, list] of Object.entries(SYNONYMS)) {
  LOOKUP.set(canon, canon);
  for (const s of list) LOOKUP.set(s, canon);
}

function detectCanon(k: string): string {
  if (LOOKUP.has(k)) return LOOKUP.get(k)!;
  
  // Campos item.* (campos de contrato no Jinja)
  // Remove o prefixo "item" e mapeia para o campo canônico
  if (k.startsWith("item")) {
    // Remove prefixo "item" (pode ser "item.", "item_", ou apenas "item")
    const withoutItem = k.replace(/^item[._]?/, "");
    // Mapeia campos item.* para canônicos
    if (withoutItem === "banco_do_contrato" || withoutItem === "bancodocontrato") return "banco_contrato";
    if (withoutItem === "data_inicio_desconto" || withoutItem === "datainiciodesconto") return "data_inicio_desconto";
    if (withoutItem === "numero_do_contrato" || withoutItem === "numerodocontrato") return "numero_contrato";
    if (withoutItem === "quantidade_parcelas" || withoutItem === "quantidadeparcelas") return "quantidade_parcelas";
    if (withoutItem === "valor_do_emprestimo" || withoutItem === "valordoemprestimo" || withoutItem === "valoremprestimo") return "valor_do_emprestimo";
    if (withoutItem === "valor_parcela" || withoutItem === "valorparcela") return "valor_parcela";
    // Se não mapeou, tenta detectar pelo nome sem o prefixo item
    k = withoutItem;
  }
  
  // Bancário
  if (k.includes("banco") && k.includes("reu")) return "banco_reu";
  if (k.includes("banco") && (k.includes("contrato") || k.includes("do_contrato"))) return "banco_contrato";
  if (k.includes("imagem") && k.includes("contrato")) return "imagem_do_contrato";
  if (k.includes("banco")) return "banco";
  if (k.includes("agencia") || k === "ag") return "agencia";
  if (k.includes("conta") && !k.includes("reu")) return "conta";
  if (k.includes("digito") || k === "dv") return "digito";
  if (k.includes("tipo") && k.includes("conta")) return "tipoconta";
  
  // Cliente
  if (k.includes("nome") && !k.includes("banco")) return "nome";
  if (k.includes("qualificacao")) return "qualificacao";
  if (k.includes("enderecocompleto") || (k.includes("endereco") && !k.includes("banco"))) return "logradouro";
  if (k.includes("cidade") && !k.includes("banco")) return "cidade";
  if (k.includes("cidade") && k.includes("uf")) return "cidadeuf";
  
  // Contrato
  if (k.includes("numero") && k.includes("contrato")) return "numero_contrato";
  if (k.includes("situacao")) return "situacao";
  if (k.includes("origem") && k.includes("averbacao")) return "origem_averbacao";
  if (k.includes("data") && k.includes("inclusao")) return "data_inclusao";
  if (k.includes("data") && k.includes("inicio") && k.includes("desconto")) return "data_inicio_desconto";
  if (k.includes("data") && k.includes("fim") && k.includes("desconto")) return "data_fim_desconto";
  if (k.includes("quantidade") && k.includes("parcela")) return "quantidade_parcelas";
  if (k.includes("valor") && k.includes("parcela")) return "valor_parcela";
  if (k.includes("valor") && k.includes("emprestado")) return "valor_do_emprestimo";
  if (k.includes("valor") && k.includes("liberado")) return "valor_liberado";
  
  return k;
}

function extractPathOnly(urlOrPath: string | null | undefined): string {
  if (!urlOrPath) return "";
  const value = String(urlOrPath);
  try {
    // Tenta usar URL para remover protocolo + host
    const u = new URL(value);
    return u.pathname || "";
  } catch {
    // Se não for uma URL completa, remove apenas padrão http(s)://host
    return value.replace(/^https?:\/\/[^/]+/i, "");
  }
}

// Pega conta principal do cliente
async function getContaPrincipalForCliente(
  clienteId?: number
): Promise<ContaBancaria | null> {
  const cid = Number(clienteId);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  // Tenta cache local primeiro
  const inCache =
    contasStore.principal(cid) || (contasStore.byCliente(cid) || [])[0] || null;
  if (inCache) return inCache;

  // Carrega do servidor e tenta de novo
  try {
    await contasStore.fetchForCliente(cid);
  } catch {
    return null;
  }
  return contasStore.principal(cid) || (contasStore.byCliente(cid) || [])[0] || null;
}

// Pega banco do réu (primeiro banco do cliente como réu)
async function getBancoReuForCliente(
  clienteId?: number
): Promise<ContaBancariaReu | null> {
  // Agora os bancos não estão mais atrelados a clientes, retorna o primeiro disponível
  // ou carrega todos e retorna o primeiro
  if (contasReuStore.items.length > 0) {
    return contasReuStore.items[0] || null;
  }

  // Carrega do servidor e tenta de novo
  try {
    await contasReuStore.fetchAll();
  } catch {
    return null;
  }
  return contasReuStore.items[0] || null;
}

// Resolve valor para um field do template a partir das fontes
const valueFromSources = (
  c: Cliente | null,
  acc: ContaBancaria | null,
  bancoReu: ContaBancariaReu | null,
  contrato: ContratoItem | null,
  contratoRoot: Contrato | null,
  rawFieldName: string
) => {
  const k = normKey(rawFieldName);
  const canon = detectCanon(k);

  // 1) Campos do cliente
  if (c) {
    switch (canon) {
      case "nome":
        return c.nome_completo || "";
      case "cpf":
        return c.cpf || "";
      case "rg":
        return c.rg || "";
      case "orgaoexpedidor":
        return c.orgao_expedidor || "";
      case "logradouro":
        return c.logradouro || "";
      case "numero":
        return c.numero || "";
      case "bairro":
        return c.bairro || "";
      case "cidade":
        return c.cidade || "";
      case "cep":
        return c.cep || "";
      case "uf":
        return (c.uf || "").toUpperCase();
      case "profissao":
        return c.profissao || "";
      case "nacionalidade":
        return c.nacionalidade || "";
      case "estadocivil":
        return c.estado_civil || "";
      case "qualificacao": {
        // Qualificação = "nacionalidade, estado civil"
        const parts: string[] = [];
        if (c.nacionalidade) parts.push(c.nacionalidade?.toLowerCase());
        if (c.estado_civil) parts.push(c.estado_civil?.toLowerCase());
        return parts.join(", ");
      }
      case "idoso":
        return !!c.se_idoso;
      case "incapaz":
        return !!c.se_incapaz;
      case "criancaadolescente":
        return !!c.se_crianca_adolescente;
    }
  }

  // 2) Campos bancários (conta principal)
  if (acc) {
    switch (canon) {
      case "banco":
        return (acc as any).descricao_ativa || acc.banco_nome || "";
      case "agencia":
        return acc.agencia || "";
      case "conta":
        return acc.conta || "";
      case "digito":
        return acc.digito || "";
      case "tipoconta":
        return acc.tipo || "";
      case "contaformatada": {
        const ag = acc.agencia ?? "";
        const num = acc.conta ?? "";
        const dv = acc.digito ?? "";
        return [ag, num].filter(Boolean).join("/") + (dv ? `-${dv}` : "");
      }
    }
  }

  // 3) Campos do banco do réu
  if (bancoReu) {
    switch (canon) {
      case "banco_reu":
        return bancoReu.banco_nome || "";
      case "cnpj_banco":
        return bancoReu.cnpj || "";
      case "logradouro_banco":
        return bancoReu.logradouro || "";
      case "cidade_banco":
        return bancoReu.cidade || "";
      case "estado_banco":
        return bancoReu.estado || "";
      case "cep_banco":
        return bancoReu.cep || "";
    }
  }

  // 4) Campos do contrato
  if (contrato) {
    switch (canon) {
      case "numero_contrato":
        return contrato.numero_do_contrato || "";
      case "banco_contrato":
        // banco_do_contrato vem apenas do contrato original, não do banco do réu
        // O banco do réu é apenas para popular o select, não para preencher automaticamente
        return contrato?.banco_do_contrato || "";
      case "situacao":
        return contrato.situacao || "";
      case "origem_averbacao":
        return contrato.origem_averbacao || "";
      case "data_inclusao":
        return contrato.data_inclusao || "";
      case "data_inicio_desconto":
        return contrato.data_inicio_desconto || "";
      case "data_fim_desconto":
        return contrato.data_fim_desconto || "";
      case "quantidade_parcelas":
        return contrato.quantidade_parcelas?.toString() || "";
      case "valor_parcela":
        return contrato.valor_parcela?.toString() || "";
      case "iof":
        return contrato.iof?.toString() || "";
      case "valor_do_emprestimo":
        // Retorna o valor do empréstimo do contrato
        if (contrato.valor_do_emprestimo !== undefined && contrato.valor_do_emprestimo !== null) {
          return contrato.valor_do_emprestimo.toString();
        }
        return "";
      case "valor_liberado":
        return contrato.valor_liberado?.toString() || "";
    }
  }

  // 5) Campos do contrato raiz (registro de contrato)
  if (contratoRoot) {
    switch (canon) {
      case "imagem_do_contrato":
        // No modal de verificação, exibimos apenas o path, sem a URL/base
        return extractPathOnly(contratoRoot.imagem_do_contrato);
    }
  }

  // Sem match
  return undefined;
};

// =========================
// Modal de Verificação
// =========================
const dialogVerificacao = ref(false);
const verificacaoLoading = ref(false);
const verificacaoItem = ref<Contrato | null>(null);
const verificacaoFields = ref<TemplateField[]>([]);
const verificacaoData = ref<Record<string, any>>({});
const verificacaoImages = ref<Record<string, File | null>>({});
const rendering = ref(false);
const renderFilename = ref("");

async function openVerificacao(item: Contrato) {
  verificacaoItem.value = item;
  verificacaoFields.value = [];
  verificacaoData.value = {};
  verificacaoImages.value = {};
  dialogVerificacao.value = true;

  if (!item.template) {
    contratosStore.error = "Template não encontrado.";
    return;
  }

  verificacaoLoading.value = true;
  try {
    // Carrega os campos do template
    const fieldsResp = await templatesStore.fetchFields(item.template, { force: true });
    verificacaoFields.value = fieldsResp.fields || [];

    // Garante que o cliente está no cache
    let cliente =
      (clientesStore.items as Cliente[]).find((c) => c.id === item.cliente) || null;
    if (!cliente) {
      try {
        cliente = await clientesStore.getDetail(item.cliente);
      } catch (err) {
        console.warn("Erro ao carregar cliente:", err);
      }
    }

    // Carrega conta principal do cliente
    const conta = await getContaPrincipalForCliente(item.cliente);

    // Carrega banco do réu
    const bancoReu = await getBancoReuForCliente(item.cliente);

    // Pega o primeiro contrato
    const primeiroContrato =
      item.contratos && item.contratos.length > 0 ? item.contratos[0] : null;

    // Inicializa todos os campos do template primeiro (garante que todos existam)
    const initialData: Record<string, any> = {};
    const initialImages: Record<string, File | null> = {};
    for (const field of verificacaoFields.value) {
      // Verifica se é um campo de imagem
      const k = normKey(field.name);
      const rawK = normKey(field.raw || "");
      // imagem_do_contrato deve vir como path (texto), não como upload de arquivo
      const isImageFieldCheck =
        (k.includes("imagem") || rawK.includes("imagem")) &&
        !k.includes("imagemdocontrato") &&
        !rawK.includes("imagemdocontrato");
      
      // Se é campo de contrato e há múltiplos contratos, inicializa para cada contrato
      if (isContratoField(field) && item.contratos && item.contratos.length > 1) {
        for (let i = 0; i < item.contratos.length; i++) {
          const fieldKey = `${field.name}_contrato_${i}`;
          if (isImageFieldCheck) {
            initialImages[fieldKey] = null;
          } else {
            // Inicializa com valor padrão baseado no tipo
            if (field.type === "bool") {
              initialData[fieldKey] = false;
            } else if (field.type === "int") {
              initialData[fieldKey] = "";
            } else {
              initialData[fieldKey] = "";
            }
          }
        }
      } else {
        // Campo normal: inicializa uma vez
        if (isImageFieldCheck) {
          initialImages[field.name] = null;
        } else {
          // Inicializa com valor padrão baseado no tipo
          if (field.type === "bool") {
            initialData[field.name] = false;
          } else if (field.type === "int") {
            initialData[field.name] = "";
          } else {
            initialData[field.name] = "";
          }
        }
      }
    }
    verificacaoData.value = initialData;
    verificacaoImages.value = initialImages;

    // PASSO 1: Preenche primeiro com os dados das fontes (cliente, contas, contratos, etc.)
    // Estes serão usados como fallback quando verifica_documento não tiver dados ou estiver vazio
    for (const field of verificacaoFields.value) {
      // Se é campo de contrato e há múltiplos contratos, preenche para cada contrato
      if (isContratoField(field) && item.contratos && item.contratos.length > 1) {
        for (let i = 0; i < item.contratos.length; i++) {
          const contrato = item.contratos[i];
          const fieldKey = `${field.name}_contrato_${i}`;
          
          // Para campos item.*, usa o nome original do campo para buscar
          // O valueFromSources vai normalizar e detectar o canon corretamente
          const v = valueFromSources(
            cliente,
            conta,
            bancoReu,
            contrato,
            item,
            field.name
          );
          
          // Se encontrou um valor, preenche
          if (v !== undefined && v !== null && v !== "") {
            if (field.type === "bool") {
              verificacaoData.value[fieldKey] = Boolean(v);
            } else if (field.type === "int") {
              const n = Number(v);
              if (!Number.isNaN(n)) {
                verificacaoData.value[fieldKey] = n;
              } else if (String(v).trim() !== "") {
                verificacaoData.value[fieldKey] = String(v);
              }
            } else {
              verificacaoData.value[fieldKey] = String(v);
            }
          }
        }
        continue;
      }
      
      // Verifica se é um campo "extenso" que precisa ser gerado a partir de um valor numérico
      if (isExtensoField(field.name)) {
        const baseFieldName = getBaseFieldNameForExtenso(field.name);
        // Tenta encontrar o valor numérico correspondente
        let valorNumerico: number | null = null;
        
        // Primeiro tenta buscar diretamente pelo nome base
        const baseValue = valueFromSources(
          cliente,
          conta,
          bancoReu,
          primeiroContrato,
          item,
          baseFieldName
        );
        
        if (baseValue !== undefined && baseValue !== null) {
          const num = typeof baseValue === "string" 
            ? parseFloat(baseValue.replace(/[^\d,.-]/g, "").replace(",", "."))
            : Number(baseValue);
          if (!isNaN(num)) {
            valorNumerico = num;
          }
        }
        
        // Se não encontrou, tenta buscar em verificacaoData (caso já tenha sido preenchido)
        if (valorNumerico === null && verificacaoData.value[baseFieldName] !== undefined) {
          const num = Number(verificacaoData.value[baseFieldName]);
          if (!isNaN(num)) {
            valorNumerico = num;
          }
        }
        
        // Se encontrou um valor numérico, converte para extenso
        if (valorNumerico !== null) {
          verificacaoData.value[field.name] = numeroParaExtenso(valorNumerico);
          continue;
        }
      }
      
      // Para campos normais, busca das fontes
      const v = valueFromSources(
        cliente,
        conta,
        bancoReu,
        primeiroContrato,
        item,
        field.name
      );
      
      // Se encontrou um valor, preenche
      if (v !== undefined && v !== null && v !== "") {
        if (field.type === "bool") {
          verificacaoData.value[field.name] = Boolean(v);
        } else if (field.type === "int") {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            verificacaoData.value[field.name] = n;
          } else if (String(v).trim() !== "") {
            verificacaoData.value[field.name] = String(v);
          }
        } else {
          verificacaoData.value[field.name] = String(v);
        }
      }
    }

    // PASSO 2: Sobrescreve com dados de verifica_documento quando existirem e não estiverem vazios
    // Prioriza verifica_documento sobre os dados das fontes
    if (item.verifica_documento && typeof item.verifica_documento === "object") {
      for (const [key, value] of Object.entries(item.verifica_documento)) {
        if (isEmpty(value)) continue;
        
        // Verifica se é um campo indexado de contrato (ex: numero_contrato_contrato_0)
        if (key.includes("_contrato_")) {
          // Preenche diretamente o campo indexado
          verificacaoData.value[key] = value;
          continue;
        }
        
        // Verifica se o campo existe no template
        const fieldExists = verificacaoFields.value.some(f => f.name === key);
        if (fieldExists) {
          // Preenche com os dados salvos, respeitando o tipo do campo
          const field = verificacaoFields.value.find(f => f.name === key);
          if (field) {
            if (field.type === "bool") {
              verificacaoData.value[key] = Boolean(value);
            } else if (field.type === "int") {
              const n = Number(value);
              if (!Number.isNaN(n)) {
                verificacaoData.value[key] = n;
              } else {
                verificacaoData.value[key] = String(value);
              }
            } else {
              verificacaoData.value[key] = String(value);
            }
          } else {
            // Se não encontrou o campo no template, ainda assim preenche (pode ser campo customizado)
            verificacaoData.value[key] = value;
          }
        } else {
          // Se não encontrou o campo no template, ainda assim preenche (pode ser campo customizado)
          verificacaoData.value[key] = value;
        }
      }
    }

    // PASSO 3: Gera o campo bancos_e_contratos com base nos contratos
    // Este campo é gerado dinamicamente e não vem do template diretamente
    if (item.contratos && item.contratos.length > 0) {
      const bancosMap = new Map<string, string[]>(); // banco -> array de números de contrato
      
      for (const contrato of item.contratos) {
        // Pega o banco e número do contrato
        const banco = (contrato as any).banco_do_contrato || (contrato as any).banco_contrato || "";
        const numeroContrato = contrato.numero_do_contrato || (contrato as any).numero_contrato || "";
        
        // Só adiciona se ambos existirem e não estiverem vazios
        if (banco && banco.trim() !== "" && numeroContrato && String(numeroContrato).trim() !== "") {
          if (!bancosMap.has(banco)) {
            bancosMap.set(banco, []);
          }
          bancosMap.get(banco)!.push(String(numeroContrato));
        }
      }
      
      // Formata a string conforme os exemplos
      if (bancosMap.size > 0) {
        const partes: string[] = [];
        for (const [banco, numeros] of bancosMap.entries()) {
          if (numeros.length === 0) continue;
          
          let numerosFormatados = "";
          if (numeros.length === 1) {
            numerosFormatados = numeros[0];
          } else if (numeros.length === 2) {
            numerosFormatados = `${numeros[0]} e ${numeros[1]}`;
          } else {
            const todosMenosUltimo = numeros.slice(0, -1).join(", ");
            const ultimo = numeros[numeros.length - 1];
            numerosFormatados = `${todosMenosUltimo} e ${ultimo}`;
          }
          
          const textoContrato = numeros.length > 1 ? "CONTRATOS" : "CONTRATO";
          partes.push(`Banco ${banco}, ${textoContrato} Nº ${numerosFormatados}`);
        }
        
        if (partes.length > 0) {
          const bancosEContratosFormatado = partes.join(", ") + ":";
          verificacaoData.value["bancos_e_contratos"] = bancosEContratosFormatado;
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:820',message:'bancos_e_contratos gerado no openVerificacao',data:{bancosEContratosFormatado,partes,bancosMapSize:bancosMap.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
        }
      } else {
        // Se não há bancos válidos, deixa vazio ou remove o campo
        if (verificacaoData.value["bancos_e_contratos"]) {
          delete verificacaoData.value["bancos_e_contratos"];
        }
      }
    } else {
      // Se não há contratos, remove o campo se existir
      if (verificacaoData.value["bancos_e_contratos"]) {
        delete verificacaoData.value["bancos_e_contratos"];
      }
    }
    
    // Se verifica_documento tem bancos_e_contratos, sobrescreve o valor gerado
    if (item.verifica_documento && typeof item.verifica_documento === "object" && item.verifica_documento["bancos_e_contratos"]) {
      const valorSalvo = item.verifica_documento["bancos_e_contratos"];
      if (!isEmpty(valorSalvo)) {
        verificacaoData.value["bancos_e_contratos"] = String(valorSalvo);
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:850',message:'bancos_e_contratos sobrescrito por verifica_documento',data:{valorSalvo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }
    }

    // Gera o campo bancos_reus
    if (item.contratos && item.contratos.length > 0) {
      const bancosUnicos = new Set<string>();
      for (const contrato of item.contratos) {
        const banco = (contrato as any).banco_do_contrato || (contrato as any).banco_contrato || "";
        if (banco && banco.trim() !== "") {
          bancosUnicos.add(banco.trim());
        }
      }

      // Sempre formata o banco completo (mesmo com 1 contrato ou mesmo banco)
      if (bancosUnicos.size > 0) {
        const partesBanco: string[] = [];
        
        // Garante que os bancos do réu estão carregados
        if (contasReuStore.items.length === 0) {
          await contasReuStore.fetchAll();
        }
        
        for (const nomeBanco of Array.from(bancosUnicos)) {
          // Busca o banco do réu pelo nome
          const bancoReu = contasReuStore.items.find(
            b => b.banco_nome && b.banco_nome.trim().toLowerCase() === nomeBanco.trim().toLowerCase()
          );
          
          if (bancoReu) {
            // Formata: **Nome do banco**, descrição, CNPJ, endereço
            const partes: string[] = [];
            
            // Nome do banco em negrito
            partes.push(`**${bancoReu.banco_nome}**`);
            
            // Descrição
            if (bancoReu.descricao && bancoReu.descricao.trim() !== "") {
              partes.push(bancoReu.descricao.trim());
            }
            
            // CNPJ
            if (bancoReu.cnpj) {
              const cnpjFormatado = bancoReu.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
              partes.push(`CNPJ: ${cnpjFormatado}`);
            }
            
            // Endereço completo
            const enderecoParts: string[] = [];
            if (bancoReu.logradouro) enderecoParts.push(bancoReu.logradouro);
            if (bancoReu.numero) enderecoParts.push(bancoReu.numero);
            if (bancoReu.bairro) enderecoParts.push(bancoReu.bairro);
            if (bancoReu.cidade) enderecoParts.push(bancoReu.cidade);
            if (bancoReu.estado) enderecoParts.push(bancoReu.estado);
            if (bancoReu.cep) {
              const cepFormatado = bancoReu.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
              enderecoParts.push(`CEP: ${cepFormatado}`);
            }
            
            if (enderecoParts.length > 0) {
              partes.push(enderecoParts.join(", "));
            }
            
            partesBanco.push(partes.join(", "));
          } else {
            // Se não encontrou o banco, usa apenas o nome
            partesBanco.push(`**${nomeBanco}**`);
          }
        }
        
        // Junta todos os bancos separados por ", e " (ou apenas um banco se for único)
        verificacaoData.value["bancos_reus"] = partesBanco.join(", e ");
      } else {
        verificacaoData.value["bancos_reus"] = "";
      }
    } else {
      verificacaoData.value["bancos_reus"] = "";
    }

    // Se verifica_documento tem bancos_reus, sobrescreve o valor gerado
    if (item.verifica_documento && typeof item.verifica_documento === "object" && item.verifica_documento["bancos_reus"]) {
      const valorSalvo = item.verifica_documento["bancos_reus"];
      if (!isEmpty(valorSalvo)) {
        verificacaoData.value["bancos_reus"] = String(valorSalvo);
      }
    }

    // Aguarda o próximo tick para garantir que o DOM foi atualizado
    await nextTick();
  } catch (error_) {
    const err = error_ as any;
    console.error("Erro ao carregar verificação:", error_);
    contratosStore.error =
      err?.response?.data?.detail ||
      err?.message ||
      "Falha ao carregar campos do template";
  } finally {
    verificacaoLoading.value = false;
  }
}

function isImageField(field: TemplateField): boolean {
  const k = normKey(field.name);
  const rawK = normKey(field.raw || "");
  // No modal de verificação, a variável imagem_do_contrato deve ser um path de texto,
  // então não tratamos esse campo como upload de imagem aqui.
  if (k.includes("imagemdocontrato") || rawK.includes("imagemdocontrato")) {
    return false;
  }
  return k.includes("imagem") || rawK.includes("imagem");
}

// Detecta se um campo é de contrato
function isContratoField(field: TemplateField): boolean {
  // Exceção: bancos_e_contratos é uma string única, não é campo de contrato
  const rawName = (field.raw || "").toLowerCase();
  const fieldName = (field.name || "").toLowerCase();
  if (rawName.includes("bancos_e_contratos") || fieldName.includes("bancos_e_contratos")) {
    return false;
  }
  
  // Verifica se o campo tem "item." no nome original (raw) - indica que é campo de contrato no Jinja
  // Exemplo: item.banco_do_contrato, item.valor_do_emprestimo
  if (rawName.includes("item.")) {
    return true;
  }
  
  // Verifica também no nome normalizado (item_*)
  const k = normKey(field.name);
  if (k.startsWith("item") && k !== "item") {
    return true;
  }
  
  // Verifica pelos nomes canônicos conhecidos (apenas se não for bancos_e_contratos)
  const canon = detectCanon(k);
  const contratoFields = [
    "numero_contrato", "banco_contrato", "situacao", "origem_averbacao",
    "data_inclusao", "data_inicio_desconto", "data_fim_desconto",
    "quantidade_parcelas", "valor_parcela", "iof", "valor_do_emprestimo",
    "valor_liberado"
  ];
  return contratoFields.includes(canon);
}

// Watcher para atualizar automaticamente campos "extenso" quando valores numéricos mudam
watch(
  () => verificacaoData.value,
  (newData) => {
    if (!verificacaoFields.value || verificacaoFields.value.length === 0) return;
    
    // Para cada campo "extenso", verifica se o valor base mudou
    for (const field of verificacaoFields.value) {
      if (isExtensoField(field.name)) {
        const baseFieldName = getBaseFieldNameForExtenso(field.name);
        const baseValue = newData[baseFieldName];
        
        if (baseValue !== undefined && baseValue !== null) {
          const num = typeof baseValue === "string"
            ? parseFloat(baseValue.toString().replace(/[^\d,.-]/g, "").replace(",", "."))
            : Number(baseValue);
          
          if (!isNaN(num) && num !== 0) {
            // Atualiza o campo extenso automaticamente
            verificacaoData.value[field.name] = numeroParaExtenso(num);
          } else if (num === 0 || baseValue === "" || baseValue === null) {
            verificacaoData.value[field.name] = "";
          }
        }
      }
    }
  },
  { deep: true }
);

function countEmptyFields(): number {
  if (!verificacaoFields.value || verificacaoFields.value.length === 0) {
    return 0;
  }
  let count = 0;
  for (const field of verificacaoFields.value) {
    if (isImageField(field)) {
      // Para campos de imagem, verifica se há arquivo
      if (!verificacaoImages.value[field.name]) {
        count++;
      }
    } else {
      const value = verificacaoData.value[field.name];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === false ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && isNaN(value));
      if (isEmpty) {
        count++;
      }
    }
  }
  return count;
}

function onImageChange(fieldName: string, event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    verificacaoImages.value[fieldName] = files[0];
  } else {
    verificacaoImages.value[fieldName] = null;
  }
}

// Função para resetar o documento - limpa verifica_documento e recarrega das fontes
async function resetVerificacao() {
  if (!verificacaoItem.value) {
    return;
  }

  if (!confirm("Deseja resetar o documento? Todos os campos serão limpos e recarregados das fontes originais (cliente, contas, contratos).")) {
    return;
  }

  verificacaoLoading.value = true;
  try {
    const item = verificacaoItem.value;

    // Limpa todos os dados do formulário
    verificacaoData.value = {};
    verificacaoImages.value = {};

    // Inicializa todos os campos do template
    const initialData: Record<string, any> = {};
    const initialImages: Record<string, File | null> = {};
    for (const field of verificacaoFields.value) {
      const k = normKey(field.name);
      const rawK = normKey(field.raw || "");
      const isImageFieldCheck =
        (k.includes("imagem") || rawK.includes("imagem")) &&
        !k.includes("imagemdocontrato") &&
        !rawK.includes("imagemdocontrato");
      
      if (isContratoField(field) && item.contratos && item.contratos.length > 1) {
        for (let i = 0; i < item.contratos.length; i++) {
          const fieldKey = `${field.name}_contrato_${i}`;
          if (isImageFieldCheck) {
            initialImages[fieldKey] = null;
          } else {
            if (field.type === "bool") {
              initialData[fieldKey] = false;
            } else if (field.type === "int") {
              initialData[fieldKey] = "";
            } else {
              initialData[fieldKey] = "";
            }
          }
        }
      } else {
        if (isImageFieldCheck) {
          initialImages[field.name] = null;
        } else {
          if (field.type === "bool") {
            initialData[field.name] = false;
          } else if (field.type === "int") {
            initialData[field.name] = "";
          } else {
            initialData[field.name] = "";
          }
        }
      }
    }
    verificacaoData.value = initialData;
    verificacaoImages.value = initialImages;

    // Garante que o cliente está no cache
    let cliente =
      (clientesStore.items as Cliente[]).find((c) => c.id === item.cliente) || null;
    if (!cliente) {
      try {
        cliente = await clientesStore.getDetail(item.cliente);
      } catch (err) {
        console.warn("Erro ao carregar cliente:", err);
      }
    }

    // Carrega conta principal do cliente
    const conta = await getContaPrincipalForCliente(item.cliente);

    // Carrega banco do réu
    const bancoReu = await getBancoReuForCliente(item.cliente);

    // Pega o primeiro contrato
    const primeiroContrato =
      item.contratos && item.contratos.length > 0 ? item.contratos[0] : null;

    // PASSO 1: Preenche apenas com os dados das fontes (SEM verifica_documento)
    for (const field of verificacaoFields.value) {
      if (isContratoField(field) && item.contratos && item.contratos.length > 1) {
        for (let i = 0; i < item.contratos.length; i++) {
          const contrato = item.contratos[i];
          const fieldKey = `${field.name}_contrato_${i}`;
          
          const v = valueFromSources(
            cliente,
            conta,
            bancoReu,
            contrato,
            item,
            field.name
          );
          
          if (v !== undefined && v !== null && v !== "") {
            if (field.type === "bool") {
              verificacaoData.value[fieldKey] = Boolean(v);
            } else if (field.type === "int") {
              const n = Number(v);
              if (!Number.isNaN(n)) {
                verificacaoData.value[fieldKey] = n;
              } else if (String(v).trim() !== "") {
                verificacaoData.value[fieldKey] = String(v);
              }
            } else {
              verificacaoData.value[fieldKey] = String(v);
            }
          }
        }
        continue;
      }
      
      // Verifica se é um campo "extenso"
      if (isExtensoField(field.name)) {
        const baseFieldName = getBaseFieldNameForExtenso(field.name);
        let valorNumerico: number | null = null;
        
        const baseValue = valueFromSources(
          cliente,
          conta,
          bancoReu,
          primeiroContrato,
          item,
          baseFieldName
        );
        
        if (baseValue !== undefined && baseValue !== null) {
          const num = typeof baseValue === "string" 
            ? parseFloat(baseValue.replace(/[^\d,.-]/g, "").replace(",", "."))
            : Number(baseValue);
          if (!isNaN(num)) {
            valorNumerico = num;
          }
        }
        
        if (valorNumerico === null && verificacaoData.value[baseFieldName] !== undefined) {
          const num = Number(verificacaoData.value[baseFieldName]);
          if (!isNaN(num)) {
            valorNumerico = num;
          }
        }
        
        if (valorNumerico !== null) {
          verificacaoData.value[field.name] = numeroParaExtenso(valorNumerico);
          continue;
        }
      }
      
      const v = valueFromSources(
        cliente,
        conta,
        bancoReu,
        primeiroContrato,
        item,
        field.name
      );
      
      if (v !== undefined && v !== null && v !== "") {
        if (field.type === "bool") {
          verificacaoData.value[field.name] = Boolean(v);
        } else if (field.type === "int") {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            verificacaoData.value[field.name] = n;
          } else if (String(v).trim() !== "") {
            verificacaoData.value[field.name] = String(v);
          }
        } else {
          verificacaoData.value[field.name] = String(v);
        }
      }
    }

    // PASSO 2: Gera bancos_e_contratos (sem sobrescrever com verifica_documento)
    if (item.contratos && item.contratos.length > 0) {
      const bancosMap = new Map<string, string[]>();
      
      for (const contrato of item.contratos) {
        const banco = (contrato as any).banco_do_contrato || (contrato as any).banco_contrato || "";
        const numeroContrato = contrato.numero_do_contrato || (contrato as any).numero_contrato || "";
        
        if (banco && banco.trim() !== "" && numeroContrato && String(numeroContrato).trim() !== "") {
          if (!bancosMap.has(banco)) {
            bancosMap.set(banco, []);
          }
          bancosMap.get(banco)!.push(String(numeroContrato));
        }
      }
      
      if (bancosMap.size > 0) {
        const partes: string[] = [];
        for (const [banco, numeros] of bancosMap.entries()) {
          if (numeros.length === 0) continue;
          
          let numerosFormatados = "";
          if (numeros.length === 1) {
            numerosFormatados = numeros[0];
          } else if (numeros.length === 2) {
            numerosFormatados = `${numeros[0]} e ${numeros[1]}`;
          } else {
            const todosMenosUltimo = numeros.slice(0, -1).join(", ");
            const ultimo = numeros[numeros.length - 1];
            numerosFormatados = `${todosMenosUltimo} e ${ultimo}`;
          }
          
          const textoContrato = numeros.length > 1 ? "CONTRATOS" : "CONTRATO";
          partes.push(`Banco ${banco}, ${textoContrato} Nº ${numerosFormatados}`);
        }
        
        if (partes.length > 0) {
          const bancosEContratosFormatado = partes.join(", ") + ":";
          verificacaoData.value["bancos_e_contratos"] = bancosEContratosFormatado;
        }
      } else {
        if (verificacaoData.value["bancos_e_contratos"]) {
          delete verificacaoData.value["bancos_e_contratos"];
        }
      }
    } else {
      if (verificacaoData.value["bancos_e_contratos"]) {
        delete verificacaoData.value["bancos_e_contratos"];
      }
    }

    // Gera o campo bancos_reus
    if (item.contratos && item.contratos.length > 0) {
      const bancosUnicos = new Set<string>();
      for (const contrato of item.contratos) {
        const banco = (contrato as any).banco_do_contrato || (contrato as any).banco_contrato || "";
        if (banco && banco.trim() !== "") {
          bancosUnicos.add(banco.trim());
        }
      }

      // Sempre formata o banco completo (mesmo com 1 contrato ou mesmo banco)
      if (bancosUnicos.size > 0) {
        const partesBanco: string[] = [];
        
        // Garante que os bancos do réu estão carregados
        if (contasReuStore.items.length === 0) {
          await contasReuStore.fetchAll();
        }
        
        for (const nomeBanco of Array.from(bancosUnicos)) {
          // Busca o banco do réu pelo nome
          const bancoReu = contasReuStore.items.find(
            b => b.banco_nome && b.banco_nome.trim().toLowerCase() === nomeBanco.trim().toLowerCase()
          );
          
          if (bancoReu) {
            // Formata: **Nome do banco**, descrição, CNPJ, endereço
            const partes: string[] = [];
            
            // Nome do banco em negrito
            partes.push(`**${bancoReu.banco_nome}**`);
            
            // Descrição
            if (bancoReu.descricao && bancoReu.descricao.trim() !== "") {
              partes.push(bancoReu.descricao.trim());
            }
            
            // CNPJ
            if (bancoReu.cnpj) {
              const cnpjFormatado = bancoReu.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
              partes.push(`CNPJ: ${cnpjFormatado}`);
            }
            
            // Endereço completo
            const enderecoParts: string[] = [];
            if (bancoReu.logradouro) enderecoParts.push(bancoReu.logradouro);
            if (bancoReu.numero) enderecoParts.push(bancoReu.numero);
            if (bancoReu.bairro) enderecoParts.push(bancoReu.bairro);
            if (bancoReu.cidade) enderecoParts.push(bancoReu.cidade);
            if (bancoReu.estado) enderecoParts.push(bancoReu.estado);
            if (bancoReu.cep) {
              const cepFormatado = bancoReu.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
              enderecoParts.push(`CEP: ${cepFormatado}`);
            }
            
            if (enderecoParts.length > 0) {
              partes.push(enderecoParts.join(", "));
            }
            
            partesBanco.push(partes.join(", "));
          } else {
            // Se não encontrou o banco, usa apenas o nome
            partesBanco.push(`**${nomeBanco}**`);
          }
        }
        
        // Junta todos os bancos separados por ", e " (ou apenas um banco se for único)
        verificacaoData.value["bancos_reus"] = partesBanco.join(", e ");
      } else {
        verificacaoData.value["bancos_reus"] = "";
      }
    } else {
      verificacaoData.value["bancos_reus"] = "";
    }

    await nextTick();
    showSnackbar("Documento resetado. Campos recarregados das fontes originais.", "success");
  } catch (error_) {
    const err = error_ as any;
    console.error("Erro ao resetar verificação:", error_);
    contratosStore.error =
      err?.response?.data?.detail ||
      err?.message ||
      "Falha ao resetar documento";
    showSnackbar("Erro ao resetar documento.", "error");
  } finally {
    verificacaoLoading.value = false;
  }
}

// Função auxiliar para salvar todos os dados do formulário no JSONB verifica_documento
// Salva todos os dados do formulário, incluindo os que já estão em contratos
async function salvarDadosVerificacao(): Promise<void> {
  if (!verificacaoItem.value) {
    throw new Error("Item de verificação não encontrado");
  }

  // Prepara os dados do formulário para salvar no verifica_documento
  const dadosVerificacao: Record<string, any> = {};
  
  // Processa todos os campos do formulário
  for (const [key, value] of Object.entries(verificacaoData.value)) {
    // Ignora campos vazios/null/undefined, mas mantém valores falsy (false, 0, "")
    if (value === undefined || value === null) {
      continue;
    }
    
    // Converte valores numéricos
    if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "")) {
      const num = typeof value === "number" ? value : Number(value);
      if (!isNaN(num)) {
        dadosVerificacao[key] = num;
      } else {
        dadosVerificacao[key] = value;
      }
    } else if (typeof value === "boolean") {
      dadosVerificacao[key] = value;
    } else if (typeof value === "string") {
      // Mantém strings, mesmo que vazias (podem ser campos de texto)
      dadosVerificacao[key] = value;
    } else {
      dadosVerificacao[key] = value;
    }
  }
  
  // Também inclui os dados que já estão em contratos (mescla tudo)
  const primeiroContrato = verificacaoItem.value.contratos && verificacaoItem.value.contratos.length > 0
    ? verificacaoItem.value.contratos[0]
    : {};
  
  // Mescla os dados de contratos com os dados do formulário
  // Os dados do formulário têm prioridade (sobrescrevem se houver conflito)
  const dadosCompletos = {
    ...primeiroContrato,
    ...dadosVerificacao,
  };
  
  // Envia para o backend - salva no campo verifica_documento
  await contratosStore.update(verificacaoItem.value.id, {
    verifica_documento: dadosCompletos,
  });
  
  // Atualiza o item local para refletir as mudanças
  verificacaoItem.value.verifica_documento = dadosCompletos;
}

async function saveVerificacao() {
  try {
    await salvarDadosVerificacao();
    showSnackbar("Dados salvos com sucesso!", "success");
    dialogVerificacao.value = false;
  } catch (error_) {
    console.error("Erro ao salvar verificação:", error_);
    const errorMessage = contratosStore.error || "Erro ao salvar os dados. Tente novamente.";
    showSnackbar(errorMessage, "error");
  }
}

async function generateAndDownload() {
  if (!verificacaoItem.value || !verificacaoItem.value.template) {
    contratosStore.error = "Template não encontrado.";
    return;
  }

  rendering.value = true;
  let contextLimpo: Record<string, any> = {}; // Declarado fora do try para estar acessível no catch
  try {
    // Primeiro salva todos os dados do formulário no JSONB
    await salvarDadosVerificacao();
    
    // Prepara o contexto PRIMEIRO com os dados de verifica_documento (já formatados pelo usuário)
    // Esses dados têm prioridade pois estão formatados de acordo com o que o usuário quer
    let context: Record<string, any> = {};
    
    // Carrega dados de verifica_documento se existirem
    if (verificacaoItem.value.verifica_documento && typeof verificacaoItem.value.verifica_documento === "object") {
      for (const [key, value] of Object.entries(verificacaoItem.value.verifica_documento)) {
        if (value !== undefined && value !== null) {
          // Converte valores para tipos primitivos
          if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
            context[key] = value;
          } else {
            context[key] = String(value);
          }
        }
      }
    }
    
    // Mapa de nomes normalizados para nomes originais (raw) dos campos
    const rawNameMap = new Map<string, string>();
    for (const field of verificacaoFields.value) {
      if (field.raw && field.name) {
        rawNameMap.set(field.name, field.raw);
      }
    }
    
    // Preenche campos vazios em verifica_documento com dados do contrato ou cliente
    // Carrega dados necessários para valueFromSources
    let cliente: Cliente | null = null;
    let conta: ContaBancaria | null = null;
    let bancoReu: ContaBancariaReu | null = null;
    const primeiroContrato = verificacaoItem.value.contratos && verificacaoItem.value.contratos.length > 0
      ? verificacaoItem.value.contratos[0]
      : null;
    
    if (verificacaoItem.value.cliente) {
      cliente = (clientesStore.items as Cliente[]).find((c) => c.id === verificacaoItem.value!.cliente) || null;
      if (!cliente) {
        try {
          cliente = await clientesStore.getDetail(verificacaoItem.value.cliente);
        } catch (err) {
          console.warn("Erro ao carregar cliente para preencher campos vazios:", err);
        }
      }
      
      if (cliente) {
        conta = await getContaPrincipalForCliente(cliente.id);
        bancoReu = await getBancoReuForCliente(cliente.id);
      }
    }
    
    // Para cada campo do template, verifica se está vazio em verifica_documento
    // Se estiver vazio, busca das fontes (cliente, conta, banco do réu, contrato)
    for (const field of verificacaoFields.value) {
      // Ignora campos de contrato indexados (serão tratados no array de contratos)
      if (isContratoField(field) && verificacaoItem.value.contratos && verificacaoItem.value.contratos.length > 1) {
        continue; // Campos de múltiplos contratos serão tratados no array
      }
      
      // Ignora bancos_e_contratos - será gerado depois se necessário
      if (field.name === "bancos_e_contratos" || field.name.toLowerCase().includes("bancos_e_contratos")) {
        continue;
      }
      
      // Verifica se o campo está vazio ou não existe em verifica_documento
      // Verifica tanto pelo nome normalizado quanto pelo nome raw (original)
      const rawName = rawNameMap.get(field.name);
      const fieldValue = context[field.name] || (rawName ? context[rawName] : undefined);
      const isEmpty = fieldValue === undefined || 
                     fieldValue === null || 
                     (typeof fieldValue === "string" && fieldValue.trim() === "") ||
                     fieldValue === "";
      
      // Se estiver vazio, busca das fontes
      if (isEmpty) {
        const valueFromSource = valueFromSources(
          cliente,
          conta,
          bancoReu,
          primeiroContrato,
          verificacaoItem.value,
          field.name
        );
        
        // Se encontrou um valor, preenche
        if (valueFromSource !== undefined && valueFromSource !== null && valueFromSource !== "") {
          // Converte para o tipo correto
          if (field.type === "bool") {
            context[field.name] = Boolean(valueFromSource);
          } else if (field.type === "int") {
            const n = Number(valueFromSource);
            if (!Number.isNaN(n)) {
              context[field.name] = n;
            } else if (String(valueFromSource).trim() !== "") {
              context[field.name] = String(valueFromSource);
            }
          } else {
            context[field.name] = String(valueFromSource);
          }
          
          // Também adiciona com o nome original (raw) se for diferente
          const rawName = rawNameMap.get(field.name);
          if (rawName && rawName !== field.name) {
            if (field.type === "bool") {
              context[rawName] = Boolean(valueFromSource);
            } else if (field.type === "int") {
              const n = Number(valueFromSource);
              if (!Number.isNaN(n)) {
                context[rawName] = n;
              } else if (String(valueFromSource).trim() !== "") {
                context[rawName] = String(valueFromSource);
              }
            } else {
              context[rawName] = String(valueFromSource);
            }
          }
        }
      }
    }
    
    // Depois, mescla com os dados do formulário atual (verificacaoData)
    // Os dados do formulário só sobrescrevem se não estiverem vazios
    for (const [key, value] of Object.entries(verificacaoData.value)) {
      // Ignora campos indexados de contrato (ex: item_banco_do_contrato_contrato_0)
      // Esses campos serão incluídos apenas no array de contratos
      if (key.includes("_contrato_") && isContratoField({ name: key, raw: key, type: "string" } as TemplateField)) {
        continue;
      }
      
      // Se bancos_e_contratos já está em verifica_documento, usa esse valor (já formatado pelo usuário)
      // Caso contrário, será gerado depois com base nos contratos
      if (key === "bancos_e_contratos" || key.toLowerCase().includes("bancos_e_contratos")) {
        // Se já existe em context (vindo de verifica_documento), mantém esse valor
        // Se não existe, será gerado depois
        if (context["bancos_e_contratos"] || context[key]) {
          continue; // Mantém o valor de verifica_documento
        }
        // Se não existe em verifica_documento, será gerado depois
        continue;
      }
      
      // Converte valores para tipos primitivos
      if (value === undefined || value === null) {
        continue;
      }
      
      let processedValue: any;
      if (typeof value === "boolean") {
        processedValue = value;
      } else if (typeof value === "number") {
        processedValue = value;
      } else if (typeof value === "string") {
        processedValue = value;
      } else {
        // Converte outros tipos para string
        processedValue = String(value);
      }
      
      // Adiciona com o nome normalizado (minúsculas/snake_case)
      context[key] = processedValue;
      
      // Também adiciona com o nome original (raw) se for diferente
      // Isso garante que templates com {{ NOME_COMPLETO }} funcionem
      // MAS: não sobrescreve bancos_e_contratos que será gerado depois
      const rawName = rawNameMap.get(key);
      if (rawName && rawName !== key && rawName !== "bancos_e_contratos" && !rawName.toLowerCase().includes("bancos_e_contratos")) {
        context[rawName] = processedValue;
      }
    }
    
    
    // Adiciona os contratos como array para loops no Jinja
    // Converte campos indexados de volta para arrays de contratos
    // Exemplo de uso no template: {% for contrato in contratos %}
    if (verificacaoItem.value.contratos && verificacaoItem.value.contratos.length > 0) {
      // Se houver campos indexados no verificacaoData, usa eles para construir os contratos
      const contratosArray: Record<string, any>[] = [];
      const contratosByIndex = new Map<number, Record<string, any>>();
      
      // Agrupa campos indexados por índice de contrato
      for (const [key, value] of Object.entries(verificacaoData.value)) {
        if (key.includes("_contrato_")) {
          const parts = key.split("_contrato_");
          if (parts.length === 2) {
            let fieldName = parts[0];
            const index = parseInt(parts[1]);
            if (!isNaN(index)) {
              if (!contratosByIndex.has(index)) {
                contratosByIndex.set(index, {});
              }
              
              // Remove prefixo "item_" dos campos para que o Jinja possa acessar corretamente
              // Exemplo: item_banco_do_contrato → banco_do_contrato
              if (fieldName.startsWith("item_")) {
                fieldName = fieldName.replace(/^item_/, "");
              }
              
              contratosByIndex.get(index)![fieldName] = value;
            }
          }
        }
      }
      
      // Constrói array de contratos a partir dos dados indexados ou usa os contratos originais
      if (contratosByIndex.size > 0) {
        for (let i = 0; i < Math.max(contratosByIndex.size, verificacaoItem.value.contratos.length); i++) {
          const contratoData = contratosByIndex.get(i) || {};
          const contratoOriginal = verificacaoItem.value.contratos[i] || {};
          
          // Limpa e converte valores para primitivos serializáveis
          const contratoLimpo: Record<string, any> = {};
          
          // Primeiro adiciona dados originais (convertidos)
          for (const [key, value] of Object.entries(contratoOriginal)) {
            if (value !== undefined && value !== null) {
              // Mapeia banco_contrato para banco_do_contrato (nome esperado pelo template)
              let finalKey = key;
              if (key === "banco_contrato") {
                finalKey = "banco_do_contrato";
              }
              
              if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
                contratoLimpo[finalKey] = value;
              } else {
                contratoLimpo[finalKey] = String(value);
              }
            }
          }
          
          // Depois sobrescreve com dados indexados (convertidos)
          for (const [key, value] of Object.entries(contratoData)) {
            if (value !== undefined && value !== null) {
              // Remove prefixo "item_" se existir
              let cleanKey = key;
              if (cleanKey.startsWith("item_")) {
                cleanKey = cleanKey.replace(/^item_/, "");
              }
              
              // Mapeia banco_contrato para banco_do_contrato (nome esperado pelo template)
              if (cleanKey === "banco_contrato") {
                cleanKey = "banco_do_contrato";
              }
              
              if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
                contratoLimpo[cleanKey] = value;
              } else {
                contratoLimpo[cleanKey] = String(value);
              }
            }
          }
          
          // Também remove prefixo "item_" dos campos originais se existirem e mapeia banco_contrato
          const keysToClean = Object.keys(contratoLimpo);
          for (const key of keysToClean) {
            if (key.startsWith("item_")) {
              const cleanKey = key.replace(/^item_/, "");
              const finalKey = cleanKey === "banco_contrato" ? "banco_do_contrato" : cleanKey;
              if (!contratoLimpo[finalKey]) {
                contratoLimpo[finalKey] = contratoLimpo[key];
                delete contratoLimpo[key];
              }
            } else if (key === "banco_contrato" && !contratoLimpo["banco_do_contrato"]) {
              // Se existe banco_contrato mas não banco_do_contrato, cria banco_do_contrato
              contratoLimpo["banco_do_contrato"] = contratoLimpo[key];
            }
          }
          
          // Preenche campos vazios do contrato com dados das fontes
          // Verifica campos de contrato que podem estar vazios
          for (const field of verificacaoFields.value) {
            if (isContratoField(field)) {
              // Remove prefixo "item_" se existir para verificar o campo
              let fieldNameToCheck = field.name;
              if (fieldNameToCheck.startsWith("item_")) {
                fieldNameToCheck = fieldNameToCheck.replace(/^item_/, "");
              }
              
              // Verifica se o campo está vazio no contrato
              const contratoFieldValue = contratoLimpo[fieldNameToCheck];
              const isEmpty = contratoFieldValue === undefined || 
                             contratoFieldValue === null || 
                             (typeof contratoFieldValue === "string" && contratoFieldValue.trim() === "") ||
                             contratoFieldValue === "";
              
              // Se estiver vazio, busca das fontes usando o contrato atual
              if (isEmpty) {
                const valueFromSource = valueFromSources(
                  cliente,
                  conta,
                  bancoReu,
                  contratoOriginal as ContratoItem,
                  verificacaoItem.value,
                  field.name
                );
                
                // Se encontrou um valor, preenche
                if (valueFromSource !== undefined && valueFromSource !== null && valueFromSource !== "") {
                  if (field.type === "bool") {
                    contratoLimpo[fieldNameToCheck] = Boolean(valueFromSource);
                  } else if (field.type === "int") {
                    const n = Number(valueFromSource);
                    if (!Number.isNaN(n)) {
                      contratoLimpo[fieldNameToCheck] = n;
                    } else if (String(valueFromSource).trim() !== "") {
                      contratoLimpo[fieldNameToCheck] = String(valueFromSource);
                    }
                  } else {
                    contratoLimpo[fieldNameToCheck] = String(valueFromSource);
                  }
                }
              }
            }
          }
          
          // banco_do_contrato só vem do contrato original, não preenche com fallbacks
          // Se não existir no contrato original, não adiciona
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1145',message:'Contrato limpo adicionado ao array (com indexados)',data:{contratoLimpo,bancoDoContrato:contratoLimpo.banco_do_contrato,numeroDoContrato:contratoLimpo.numero_do_contrato},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          contratosArray.push(contratoLimpo);
        }
      } else {
        // Se não há campos indexados, usa os contratos originais (convertidos)
        for (const contrato of verificacaoItem.value.contratos) {
          const contratoLimpo: Record<string, any> = {};
          for (const [key, value] of Object.entries(contrato)) {
            if (value !== undefined && value !== null) {
              // Remove prefixo "item_" se existir
              let cleanKey = key;
              if (cleanKey.startsWith("item_")) {
                cleanKey = cleanKey.replace(/^item_/, "");
              }
              
              // Mapeia banco_contrato para banco_do_contrato (nome esperado pelo template)
              if (cleanKey === "banco_contrato") {
                cleanKey = "banco_do_contrato";
              }
              
              if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
                contratoLimpo[cleanKey] = value;
              } else {
                contratoLimpo[cleanKey] = String(value);
              }
            }
          }
          
          // Preenche campos vazios do contrato com dados das fontes
          // Verifica campos de contrato que podem estar vazios
          for (const field of verificacaoFields.value) {
            if (isContratoField(field)) {
              // Remove prefixo "item_" se existir para verificar o campo
              let fieldNameToCheck = field.name;
              if (fieldNameToCheck.startsWith("item_")) {
                fieldNameToCheck = fieldNameToCheck.replace(/^item_/, "");
              }
              
              // Verifica se o campo está vazio no contrato
              const contratoFieldValue = contratoLimpo[fieldNameToCheck];
              const isEmpty = contratoFieldValue === undefined || 
                             contratoFieldValue === null || 
                             (typeof contratoFieldValue === "string" && contratoFieldValue.trim() === "") ||
                             contratoFieldValue === "";
              
              // Se estiver vazio, busca das fontes usando o contrato atual
              if (isEmpty) {
                const valueFromSource = valueFromSources(
                  cliente,
                  conta,
                  bancoReu,
                  contrato as ContratoItem,
                  verificacaoItem.value,
                  field.name
                );
                
                // Se encontrou um valor, preenche
                if (valueFromSource !== undefined && valueFromSource !== null && valueFromSource !== "") {
                  if (field.type === "bool") {
                    contratoLimpo[fieldNameToCheck] = Boolean(valueFromSource);
                  } else if (field.type === "int") {
                    const n = Number(valueFromSource);
                    if (!Number.isNaN(n)) {
                      contratoLimpo[fieldNameToCheck] = n;
                    } else if (String(valueFromSource).trim() !== "") {
                      contratoLimpo[fieldNameToCheck] = String(valueFromSource);
                    }
                  } else {
                    contratoLimpo[fieldNameToCheck] = String(valueFromSource);
                  }
                }
              }
            }
          }
          
          // banco_do_contrato só vem do contrato original, não preenche com fallbacks
          // Se não existir no contrato original, não adiciona
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1175',message:'Contrato limpo adicionado ao array (sem indexados)',data:{contratoLimpo,bancoDoContrato:contratoLimpo.banco_do_contrato,numeroDoContrato:contratoLimpo.numero_do_contrato,contratoOriginal:contrato},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          contratosArray.push(contratoLimpo);
        }
      }
      
      // Adiciona apenas se houver contratos válidos
      if (contratosArray.length > 0) {
        context["contratos"] = contratosArray;
        
        // Gera o campo bancos_e_contratos agrupando contratos por banco
        // MAS: só gera se não existir em verifica_documento (já formatado pelo usuário)
        // Se já existe em context (vindo de verifica_documento), mantém esse valor
        if (!context["bancos_e_contratos"]) {
          // Remove qualquer valor anterior de bancos_e_contratos do contexto (se houver)
          delete context["bancos_e_contratos"];
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1200',message:'Iniciando geração bancos_e_contratos',data:{contratosArrayLength:contratosArray.length,contratosArray:contratosArray},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        const bancosMap = new Map<string, string[]>(); // banco -> array de números de contrato
        
        // Usa os dados do contratosArray que já foi construído (inclui dados atualizados)
        console.log("=== INICIANDO GERAÇÃO DE bancos_e_contratos ===");
        console.log("contratosArray completo:", JSON.stringify(contratosArray, null, 2));
        console.log("Número de contratos no array:", contratosArray.length);
        
        for (let i = 0; i < contratosArray.length; i++) {
          const contrato = contratosArray[i];
          // Pega o banco e número do contrato - tenta diferentes variações do nome
          const banco = contrato.banco_do_contrato || contrato.banco_contrato || contrato["banco_do_contrato"] || "";
          // Tenta todas as variações possíveis do número do contrato
          const numeroContrato = contrato.numero_do_contrato || contrato.numero_contrato || contrato["numero_do_contrato"] || contrato["numero_contrato"] || "";
          
          // #region agent log
          const contratoValues: Record<string, any> = {};
          for (const [k, v] of Object.entries(contrato)) {
            contratoValues[k] = v;
          }
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1205',message:'Valores extraídos do contrato',data:{index:i,banco,numeroContrato,contratoKeys:Object.keys(contrato),contratoValues},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1210',message:'Processando contrato para bancos_e_contratos',data:{index:i,banco,numeroContrato,bancoTipo:typeof banco,numeroTipo:typeof numeroContrato,bancoVazio:!banco||banco.trim()==='',numeroVazio:!numeroContrato||String(numeroContrato).trim()==='',todasChaves:Object.keys(contrato)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Debug: log para verificar os dados
          console.log(`Processando contrato ${i + 1} para bancos_e_contratos:`, {
            banco,
            numeroContrato,
            bancoTipo: typeof banco,
            numeroTipo: typeof numeroContrato,
            bancoVazio: !banco || banco.trim() === "",
            numeroVazio: !numeroContrato || String(numeroContrato).trim() === "",
            todasChaves: Object.keys(contrato),
            contratoCompleto: contrato
          });
          
          // Só adiciona se ambos existirem e não estiverem vazios
          const bancoValido = banco && banco.trim() !== "";
          const numeroValido = numeroContrato && String(numeroContrato).trim() !== "";
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1220',message:'Validando banco e numero',data:{index:i,bancoValido,numeroValido,banco,numeroContrato},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          if (bancoValido && numeroValido) {
            if (!bancosMap.has(banco)) {
              bancosMap.set(banco, []);
            }
            const numerosAntes = bancosMap.get(banco)!.length;
            bancosMap.get(banco)!.push(String(numeroContrato));
            const numerosDepois = bancosMap.get(banco)!.length;
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1230',message:'Adicionado ao mapa',data:{banco,numeroContrato,numerosAntes,numerosDepois,arrayCompleto:bancosMap.get(banco)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            console.log(`✓ Adicionado ao mapa: Banco "${banco}" - Contrato "${numeroContrato}"`);
          } else {
            console.warn(`✗ Ignorado: Banco="${banco}", Numero="${numeroContrato}"`);
            if (!banco || banco.trim() === "") {
              console.warn(`  → Razão: Banco está vazio ou não encontrado`);
            }
            if (!numeroContrato || String(numeroContrato).trim() === "") {
              console.warn(`  → Razão: Número do contrato está vazio ou não encontrado`);
            }
          }
        }
        
        // Debug: log do mapa de bancos
        console.log("=== MAPA DE BANCOS GERADO ===");
        console.log("Tamanho do mapa:", bancosMap.size);
        
        // #region agent log
        const mapaData: Record<string, any> = {};
        for (const [banco, numeros] of bancosMap.entries()) {
          mapaData[banco] = {count: numeros.length, numeros: numeros};
        }
        fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1240',message:'Mapa de bancos gerado',data:{tamanho:bancosMap.size,mapa:mapaData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        for (const [banco, numeros] of bancosMap.entries()) {
          console.log(`Banco: "${banco}" - Contratos: [${numeros.join(", ")}]`);
        }
        
        // Só gera o campo se houver dados válidos (com banco e número de contrato)
        if (bancosMap.size > 0) {
          console.log("=== FORMATANDO bancos_e_contratos ===");
          // Formata a string conforme os exemplos
          // Exemplo 1: "Banco AGIBANK SA, CONTRATOS Nº 1512287291, 1240335985 e 1240335033:"
          // Exemplo 2: "Banco AGIBANK SA, CONTRATOS Nº 1512287291, 1240335985 e 1240335033, Banco do Brasil SA, CONTRATOS Nº 121344345, 234324234:"
          const partes: string[] = [];
          for (const [banco, numeros] of bancosMap.entries()) {
            console.log(`Formatando banco "${banco}" com ${numeros.length} contrato(s):`, numeros);
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1250',message:'Formatando banco',data:{banco,numerosLength:numeros.length,numeros},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            if (numeros.length === 0) {
              console.warn(`⚠ Banco "${banco}" não tem números de contrato, pulando...`);
              continue;
            }
            
            let numerosFormatados = "";
            if (numeros.length === 1) {
              numerosFormatados = numeros[0];
            } else if (numeros.length === 2) {
              numerosFormatados = `${numeros[0]} e ${numeros[1]}`;
            } else {
              // Mais de 2: "num1, num2 e num3"
              const todosMenosUltimo = numeros.slice(0, -1).join(", ");
              const ultimo = numeros[numeros.length - 1];
              numerosFormatados = `${todosMenosUltimo} e ${ultimo}`;
            }
            
            const textoContrato = numeros.length > 1 ? "CONTRATOS" : "CONTRATO";
            const parteFormatada = `Banco ${banco}, ${textoContrato} Nº ${numerosFormatados}`;
            partes.push(parteFormatada);
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1270',message:'Parte formatada',data:{banco,numerosFormatados,parteFormatada,partesLength:partes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            console.log(`✓ Parte formatada: "${parteFormatada}"`);
          }
          
          // Só adiciona se houver partes válidas
          if (partes.length > 0) {
            // Junta as partes com vírgula e espaço, e adiciona dois pontos no final
            const bancosEContratosFormatado = partes.join(", ") + ":";
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1280',message:'Antes de adicionar ao context',data:{bancosEContratosFormatado,partes,contextAntes:context["bancos_e_contratos"]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            context["bancos_e_contratos"] = bancosEContratosFormatado;
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1285',message:'Depois de adicionar ao context',data:{bancosEContratosFormatado,contextDepois:context["bancos_e_contratos"]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            console.log("✓ bancos_e_contratos gerado e adicionado ao context:", bancosEContratosFormatado);
            console.log("✓ Context após adicionar bancos_e_contratos:", context["bancos_e_contratos"]);
            console.log("✓ Partes formatadas:", partes);
          } else {
            console.warn("⚠ Nenhuma parte válida foi formatada, mesmo com bancos no mapa");
          }
        } else {
          console.warn("⚠ Nenhum banco válido encontrado nos contratos para gerar bancos_e_contratos");
          console.warn("⚠ Tamanho do bancosMap:", bancosMap.size);
          console.warn("⚠ Contratos processados:", contratosArray.length);
        }
        // Se não houver dados válidos, não adiciona o campo (ou deixa vazio)
        } else {
          // Se bancos_e_contratos já existe em context (vindo de verifica_documento), mantém
          console.log("✓ bancos_e_contratos já existe em verifica_documento, mantendo valor:", context["bancos_e_contratos"]);
        }

        // Gera o campo bancos_reus
        // Só gera se não existir em verifica_documento (já formatado pelo usuário)
        if (!context["bancos_reus"]) {
          const contratos = verificacaoItem.value.contratos || [];
          
          // Se não houver contratos, não gera
          if (contratos.length === 0) {
            context["bancos_reus"] = "";
          } else {
            // Coleta todos os bancos únicos dos contratos
            const bancosUnicos = new Set<string>();
            for (const contrato of contratos) {
              const banco = (contrato as any).banco_do_contrato || (contrato as any).banco_contrato || "";
              if (banco && banco.trim() !== "") {
                bancosUnicos.add(banco.trim());
              }
            }

            // Sempre formata o banco completo (mesmo com 1 contrato ou mesmo banco)
            if (bancosUnicos.size > 0) {
              const partesBanco: string[] = [];
              
              // Garante que os bancos do réu estão carregados
              if (contasReuStore.items.length === 0) {
                await contasReuStore.fetchAll();
              }
              
              for (const nomeBanco of Array.from(bancosUnicos)) {
                // Busca o banco do réu pelo nome
                const bancoReu = contasReuStore.items.find(
                  b => b.banco_nome && b.banco_nome.trim().toLowerCase() === nomeBanco.trim().toLowerCase()
                );
                
                if (bancoReu) {
                  // Formata: **Nome do banco**, descrição, CNPJ, endereço
                  const partes: string[] = [];
                  
                  // Nome do banco em negrito (usando ** para markdown/HTML)
                  partes.push(`**${bancoReu.banco_nome}**`);
                  
                  // Descrição
                  if (bancoReu.descricao && bancoReu.descricao.trim() !== "") {
                    partes.push(bancoReu.descricao.trim());
                  }
                  
                  // CNPJ
                  if (bancoReu.cnpj) {
                    const cnpjFormatado = bancoReu.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
                    partes.push(`CNPJ: ${cnpjFormatado}`);
                  }
                  
                  // Endereço completo
                  const enderecoParts: string[] = [];
                  if (bancoReu.logradouro) enderecoParts.push(bancoReu.logradouro);
                  if (bancoReu.numero) enderecoParts.push(bancoReu.numero);
                  if (bancoReu.bairro) enderecoParts.push(bancoReu.bairro);
                  if (bancoReu.cidade) enderecoParts.push(bancoReu.cidade);
                  if (bancoReu.estado) enderecoParts.push(bancoReu.estado);
                  if (bancoReu.cep) {
                    const cepFormatado = bancoReu.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
                    enderecoParts.push(`CEP: ${cepFormatado}`);
                  }
                  
                  if (enderecoParts.length > 0) {
                    partes.push(enderecoParts.join(", "));
                  }
                  
                  partesBanco.push(partes.join(", "));
                } else {
                  // Se não encontrou o banco, usa apenas o nome
                  partesBanco.push(`**${nomeBanco}**`);
                }
              }
              
              // Junta todos os bancos separados por ", e " (ou apenas um banco se for único)
              context["bancos_reus"] = partesBanco.join(", e ");
            } else {
              // Nenhum banco válido encontrado
              context["bancos_reus"] = "";
            }
          }
        }
      }
    }
    
    // Por enquanto, não incluímos imagens no contexto
    // O docxtpl precisa de objetos InlineImage especiais para imagens
    // TODO: Implementar suporte a imagens usando InlineImage do docxtpl no backend
    // for (const [fieldName, file] of Object.entries(verificacaoImages.value)) {
    //   if (file) {
    //     // Converte File para base64
    //     const base64 = await new Promise<string>((resolve, reject) => {
    //       const reader = new FileReader();
    //       reader.onload = () => {
    //         const result = reader.result as string;
    //         // Remove o prefixo data:image/...;base64,
    //         const base64String = result.split(',')[1];
    //         resolve(base64String);
    //       };
    //       reader.onerror = reject;
    //       reader.readAsDataURL(file);
    //     });
    //     context[fieldName] = base64;
    //   }
    // }

    // Inclui campos do cliente que podem não estar no template mas são necessários
    // (idoso, incapaz, criancaadolescente)
    if (verificacaoItem.value.cliente) {
      let cliente =
        (clientesStore.items as Cliente[]).find((c) => c.id === verificacaoItem.value!.cliente) || null;
      if (!cliente) {
        try {
          cliente = await clientesStore.getDetail(verificacaoItem.value.cliente);
        } catch (err) {
          console.warn("Erro ao carregar cliente para contexto:", err);
        }
      }
      
      if (cliente) {
        // Adiciona campos do cliente ao contexto com todas as variações de nomes
        const nomeCompleto = cliente.nome_completo || "";
        
        // Variações de nome_completo (case-insensitive)
        context["nome_completo"] = nomeCompleto;
        context["NOME_COMPLETO"] = nomeCompleto;
        context["nome"] = nomeCompleto;
        context["NOME"] = nomeCompleto;
        
        // Adiciona campos booleanos do cliente ao contexto (mesmo que não estejam no template)
        // Usa os nomes canônicos que o valueFromSources usa
        context["idoso"] = Boolean(cliente.se_idoso);
        context["incapaz"] = Boolean(cliente.se_incapaz);
        context["criancaadolescente"] = Boolean(cliente.se_crianca_adolescente);
        // Também adiciona variações comuns de nomes
        context["se_idoso"] = Boolean(cliente.se_idoso);
        context["se_incapaz"] = Boolean(cliente.se_incapaz);
        context["se_crianca_adolescente"] = Boolean(cliente.se_crianca_adolescente);
      }
    }

    // Limpa o contexto final: remove valores undefined, null e objetos complexos
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1350',message:'Antes de limpar context',data:{bancosEContratosAntes:context["bancos_e_contratos"]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    contextLimpo = {};
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null) {
        continue;
      }
      
      // Se for array, verifica se está vazio ou se tem valores válidos
      if (Array.isArray(value)) {
        if (value.length > 0) {
          contextLimpo[key] = value;
        }
        continue;
      }
      
      // Se for objeto, verifica se é um objeto simples (não Date, etc)
      if (typeof value === "object" && value.constructor === Object) {
        contextLimpo[key] = value;
        continue;
      }
      
      // Valores primitivos
      if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        contextLimpo[key] = value;
      } else {
        // Converte outros tipos para string
        contextLimpo[key] = String(value);
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1380',message:'Depois de limpar context',data:{bancosEContratosDepois:contextLimpo["bancos_e_contratos"]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Gera o documento usando o template store
    const filename = renderFilename.value.trim() || `contrato_${verificacaoItem.value.id}.docx`;
    
    console.log("bancos_e_contratos FINAL no contextLimpo:", contextLimpo["bancos_e_contratos"]);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1400',message:'Verificação final antes de enviar',data:{bancosEContratos:contextLimpo["bancos_e_contratos"],temContrato:typeof contextLimpo["bancos_e_contratos"]==='string'&&contextLimpo["bancos_e_contratos"].includes('CONTRATO')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Verificação final: se bancos_e_contratos não está correto E não veio de verifica_documento, força a regeneração
    // Se veio de verifica_documento, mantém o valor mesmo que não tenha "CONTRATO" (usuário pode ter formatado diferente)
    const bancosEContratosVeioDeVerificaDocumento = verificacaoItem.value.verifica_documento && 
      typeof verificacaoItem.value.verifica_documento === "object" && 
      verificacaoItem.value.verifica_documento["bancos_e_contratos"];
    
    if (!bancosEContratosVeioDeVerificaDocumento && 
        (!contextLimpo["bancos_e_contratos"] || (typeof contextLimpo["bancos_e_contratos"] === "string" && !contextLimpo["bancos_e_contratos"].includes("CONTRATO")))) {
      console.warn("bancos_e_contratos não está correto e não veio de verifica_documento, regenerando...");
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/353bb56a-b58f-461f-b5be-a4cf4a869b22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContratosView.vue:1405',message:'Regenerando bancos_e_contratos',data:{valorAtual:contextLimpo["bancos_e_contratos"],veioDeVerificaDocumento:bancosEContratosVeioDeVerificaDocumento},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Regenera bancos_e_contratos se necessário
      if (contextLimpo["contratos"] && Array.isArray(contextLimpo["contratos"]) && contextLimpo["contratos"].length > 0) {
        const bancosMapFinal = new Map<string, string[]>();
        for (const contrato of contextLimpo["contratos"]) {
          const banco = contrato.banco_do_contrato || "";
          const numeroContrato = contrato.numero_do_contrato || "";
          if (banco && banco.trim() !== "" && numeroContrato && String(numeroContrato).trim() !== "") {
            if (!bancosMapFinal.has(banco)) {
              bancosMapFinal.set(banco, []);
            }
            bancosMapFinal.get(banco)!.push(String(numeroContrato));
          }
        }
        
        if (bancosMapFinal.size > 0) {
          const partesFinal: string[] = [];
          for (const [banco, numeros] of bancosMapFinal.entries()) {
            if (numeros.length === 0) continue;
            let numerosFormatados = "";
            if (numeros.length === 1) {
              numerosFormatados = numeros[0];
            } else if (numeros.length === 2) {
              numerosFormatados = `${numeros[0]} e ${numeros[1]}`;
            } else {
              const todosMenosUltimo = numeros.slice(0, -1).join(", ");
              const ultimo = numeros[numeros.length - 1];
              numerosFormatados = `${todosMenosUltimo} e ${ultimo}`;
            }
            const textoContrato = numeros.length > 1 ? "CONTRATOS" : "CONTRATO";
            partesFinal.push(`Banco ${banco}, ${textoContrato} Nº ${numerosFormatados}`);
          }
          if (partesFinal.length > 0) {
            contextLimpo["bancos_e_contratos"] = partesFinal.join(", ") + ":";
            console.log("bancos_e_contratos regenerado:", contextLimpo["bancos_e_contratos"]);
          }
        }
      }
    }
    
    // Chama o render do template store
    const result = await templatesStore.render(verificacaoItem.value.template, {
      context: contextLimpo,
      filename: filename,
    });
    
    // Faz o download
    templatesStore.downloadRendered(result);
    showSnackbar("Documento gerado e baixado com sucesso!", "success");
  } catch (error_) {
    console.error("Erro ao gerar documento:", error_);
    const err = error_ as any;
    const errorDetail = err?.response?.data;
    console.error("Detalhes do erro:", errorDetail);
    // Log do contexto para debug (se disponível)
    try {
      console.error("Contexto que causou erro:", JSON.stringify(contextLimpo || {}, null, 2));
    } catch {
      console.error("Não foi possível serializar o contexto");
    }
    
    const errorMessage = err?.response?.data?.detail || 
                        templatesStore.lastError || 
                        "Erro ao gerar o documento. Tente novamente.";
    showSnackbar(errorMessage, "error");
    
    // Tenta extrair mensagem de erro do blob se for o caso
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        console.error("Mensagem de erro do backend:", text);
        const json = JSON.parse(text);
        contratosStore.error = json.detail || text || "Erro ao gerar documento";
      } catch (parseError) {
        console.error("Erro ao parsear resposta:", parseError);
        contratosStore.error = "Erro ao gerar documento";
      }
    } else if (errorDetail?.detail) {
      contratosStore.error = errorDetail.detail;
    } else if (err?.message) {
      contratosStore.error = err.message;
    } else {
      contratosStore.error = "Erro ao gerar documento. Verifique o console para mais detalhes.";
    }
  } finally {
    rendering.value = false;
  }
}

// Carregar dados necessários
onMounted(async () => {
  if (clientesStore.items.length === 0) {
    await clientesStore.fetchList({});
  }
  if (templatesStore.items.length === 0) {
    await templatesStore.fetch({});
  }
  if (contratosStore.items.length === 0) {
    await contratosStore.fetchList({});
  }
});
</script>

<template>
  <v-container fluid>
    <!-- Cabeçalho -->
    <v-card class="rounded mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Contratos</div>
          <div class="text-body-2 text-medium-emphasis">
            Gerenciamento de contratos
          </div>
        </div>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-file-document-plus"
          @click="openCreate"
        >
          Novo contrato
        </v-btn>
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
            {{ templateLabel(item.template, item.template_nome) }}
          </template>

          <template #item.contratos="{ item }">
            {{ formatContratos(item.contratos) }}
          </template>

          <template #item.actions="{ item }">
            <v-btn
              color="primary"
              icon
              size="small"
              variant="text"
              @click="openVerificacao(item)"
              title="Verificar documento"
            >
              <v-icon icon="mdi-file-check" />
            </v-btn>
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="remove(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum contrato encontrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialog" max-width="900" scrollable>
      <v-card>
        <v-card-title>
          {{ editing ? "Editar contrato" : "Novo contrato" }}
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="save">
            <!-- Cliente e Template -->
            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.cliente"
                  :items="clienteOptions"
                  label="Cliente *"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.template"
                  :items="templateOptions"
                  label="Template *"
                  required
                />
              </v-col>
              <!-- Imagem do Contrato -->
              <v-col cols="12" md="4">
                <v-file-input
                  v-model="form.imagem_do_contrato"
                  :label="imagemExistenteUrl && !form.imagem_do_contrato ? 'Trocar imagem' : 'Imagem do contrato'"
                  accept="image/*"
                  prepend-icon="mdi-image"
                  clearable
                  show-size
                  class="-mb-4"
                />
                <!-- Mostra path da imagem existente como link se houver e não houver nova imagem selecionada -->
                <div v-if="imagemExistenteUrl && !form.imagem_do_contrato && imagemExistenteUrlCompleta" class="mt-0 d-flex align-center">
                  <a
                    :href="imagemExistenteUrlCompleta || '#'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-decoration-none text-truncate"
                    style="font-size: 0.875rem; flex: 1; min-width: 0;"
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

            <!-- Lista de Contratos -->
            <div
              v-for="(contrato, index) in form.contratos"
              :key="index"
              class="mb-6"
            >
              <v-divider class="mb-4" v-if="index > 0" />
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
                  <v-text-field
                    v-model="contrato.numero_do_contrato"
                    label="Número do contrato"
                  />
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
                  <v-select
                    v-model="contrato.situacao"
                    :items="situacaoItems"
                    label="Situação"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="contrato.origem_averbacao"
                    :items="origemAverbacaoItems"
                    label="Origem da averbação"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="contrato.data_inclusao"
                    label="Data de inclusão"
                    type="date"
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="contrato.data_inicio_desconto"
                    label="Data início desconto"
                    type="month"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="contrato.data_fim_desconto"
                    label="Data fim desconto"
                    type="month"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="contrato.quantidade_parcelas"
                    label="Quantidade de parcelas"
                    type="number"
                    min="0"
                  />
                </v-col>
      
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="contrato.valor_parcela"
                    label="Valor da parcela"
                    prefix="R$"
                    type="number"
                    step="0.01"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="contrato.iof"
                    label="IOF"
                    prefix="R$"
                    type="number"
                    step="0.01"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="contrato.valor_do_emprestimo"
                    label="Valor do empréstimo"
                    prefix="R$"
                    type="number"
                    step="0.01"
                  />
                </v-col>
       
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="contrato.valor_liberado"
                    label="Valor liberado"
                    prefix="R$"
                    type="number"
                    step="0.01"
                  />
                </v-col>
              </v-row>
            </div>

            <!-- Botão para adicionar mais contratos -->
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-plus"
              @click="addContrato"
              class="mb-4"
            >
              Adicionar Contrato
            </v-btn>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="save">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Verificação -->
    <v-dialog v-model="dialogVerificacao" max-width="900" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <div>
            <div class="text-subtitle-1">Verificação do Documento</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ verificacaoItem ? `Cliente: ${clienteNome(verificacaoItem.cliente, verificacaoItem.cliente_nome)}` : "" }}
            </div>
          </div>
          <v-spacer />
          <v-chip
            v-if="!verificacaoLoading && verificacaoFields.length > 0"
            :color="countEmptyFields() > 0 ? 'warning' : 'success'"
            size="small"
            variant="tonal"
          >
            {{ countEmptyFields() > 0 ? `${countEmptyFields()} campo(s) vazio(s)` : "Todos os campos preenchidos" }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <v-skeleton-loader v-if="verificacaoLoading" type="table" />
          <div v-else>
            <v-alert
              v-if="verificacaoFields.length === 0"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              Nenhum campo detectado no template.
            </v-alert>
            <div v-else>              
              <v-form v-if="verificacaoFields.length > 0">
                <!-- Campos normais: todos os campos EXCETO campos de contrato quando há múltiplos contratos -->
                <v-row dense>
                  <v-col
                    v-for="field in verificacaoFields.filter(f => {
                      // Se é campo de contrato E há múltiplos contratos, não mostra aqui (mostra nas seções)
                      if (isContratoField(f) && verificacaoItem && verificacaoItem.contratos && verificacaoItem.contratos.length > 1) {
                        return false;
                      }
                      // Todos os outros campos aparecem aqui
                      return true;
                    })"
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
                      prepend-icon="mdi-image"
                      :model-value="verificacaoImages[field.name] ? [verificacaoImages[field.name]!] : []"
                      @update:model-value="(files: File | File[]) => {
                        if (Array.isArray(files)) {
                          verificacaoImages[field.name] = files.length > 0 ? files[0] : null;
                        } else {
                          verificacaoImages[field.name] = files || null;
                        }
                      }"
                      hide-details="auto"
                    />
                    <v-text-field
                      v-else
                      v-model="verificacaoData[field.name]"
                      :label="field.raw || field.name"
                      :type="
                        field.type === 'int'
                          ? 'number'
                          : field.type === 'date'
                          ? 'date'
                          : 'text'
                      "
                      hide-details="auto"
                    />
                  </v-col>
                </v-row>
                
                <!-- Campos de contrato: mostra em seções repetidas se houver múltiplos contratos -->
                <template v-if="verificacaoItem && verificacaoItem.contratos && verificacaoItem.contratos.length > 1">
                  <template v-for="(contrato, contratoIndex) in verificacaoItem.contratos" :key="`contrato-section-${contratoIndex}`">
                    <v-divider v-if="contratoIndex > 0" class="my-4" />
                    <div class="text-subtitle-2 pa-2 font-weight-medium mb-2">
                      Contrato {{ contratoIndex + 1 }}
                    </div>
                    <v-row dense>
                      <v-col
                        v-for="field in verificacaoFields.filter(f => isContratoField(f))"
                        :key="`${field.name}-${contratoIndex}`"
                        cols="12"
                        :md="isImageField(field) ? 12 : 6"
                      >
                        <v-switch
                          v-if="field.type === 'bool'"
                          v-model="verificacaoData[`${field.name}_contrato_${contratoIndex}`]"
                          :label="field.raw || field.name"
                          hide-details
                        />
                        <v-file-input
                          v-else-if="isImageField(field)"
                          :label="field.raw || field.name"
                          accept="image/*"
                          prepend-icon="mdi-image"
                          :model-value="verificacaoImages[`${field.name}_contrato_${contratoIndex}`] ? [verificacaoImages[`${field.name}_contrato_${contratoIndex}`]!] : []"
                          @update:model-value="(files: File | File[]) => {
                            const key = `${field.name}_contrato_${contratoIndex}`;
                            if (Array.isArray(files)) {
                              verificacaoImages[key] = files.length > 0 ? files[0] : null;
                            } else {
                              verificacaoImages[key] = files || null;
                            }
                          }"
                          hide-details="auto"
                        />
                        <v-text-field
                          v-else
                          v-model="verificacaoData[`${field.name}_contrato_${contratoIndex}`]"
                          :label="field.raw || field.name"
                          :type="
                            field.type === 'int'
                              ? 'number'
                              : field.type === 'date'
                              ? 'date'
                              : 'text'
                          "
                          hide-details="auto"
                        />
                      </v-col>
                    </v-row>
                  </template>
                </template>
              </v-form>
              
              <v-alert
                v-else
                type="warning"
                variant="tonal"
                class="mb-4"
              >
                Nenhum campo encontrado no template. Verifique se o template possui variáveis definidas.
              </v-alert>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="warning"
            variant="outlined"
            prepend-icon="mdi-refresh"
            :loading="verificacaoLoading"
            @click="resetVerificacao"
          >
            Resetar Documento
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="dialogVerificacao = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            variant="outlined"
            @click="saveVerificacao"
          >
            Salvar
          </v-btn>
          <v-btn
            color="primary"
            :loading="rendering"
            @click="generateAndDownload"
          >
            Gerar e Baixar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Snackbar para feedback -->
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="4000"
      location="top right"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn
          variant="text"
          @click="snackbar = false"
        >
          Fechar
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>
