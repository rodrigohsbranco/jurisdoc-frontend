import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useClientesStore } from '@/stores/clientes';
import { useContasStore } from '@/stores/contas';
import { usePeticoesStore } from '@/stores/peticoes';
import { useTemplatesStore } from '@/stores/templates';
const peticoes = usePeticoesStore();
const templates = useTemplatesStore();
const clientes = useClientesStore();
const contas = useContasStore();
// =========================
// Config de prefill
// =========================
const PREFILL_MASKS = true; // aplica máscara em CPF/CEP
// normaliza chave p/ comparação
const normKey = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const maskCPF = (cpf) => {
    if (!cpf)
        return '';
    const d = cpf.replace(/\D/g, '').slice(0, 11);
    if (!PREFILL_MASKS)
        return d;
    return d
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};
const maskCEP = (cep) => {
    if (!cep)
        return '';
    const d = cep.replace(/\D/g, '').slice(0, 8);
    if (!PREFILL_MASKS)
        return d;
    return d.replace(/^(\d{5})(\d{1,3})$/, '$1-$2');
};
const composeEndereco = (c) => {
    const partes = [
        [c.logradouro, c.numero].filter(Boolean).join(', '),
        c.bairro,
        [c.cidade, (c.uf || '')?.toUpperCase()].filter(Boolean).join('/'),
        maskCEP(c.cep),
    ].filter(Boolean);
    return partes.join(' – ');
};
// Sinônimos → chave canônica (cliente + bancário)
const SYNONYMS = {
    // cliente
    nome: [
        'nome',
        'nomecliente',
        'cliente',
        'nomecompleto',
        'autor',
        'requerente',
    ],
    cpf: ['cpf', 'cpfrequerente', 'documentocpf'],
    rg: ['rg', 'identidade'],
    orgaoexpedidor: ['orgaoexpedidor', 'oexpedidor', 'oexp', 'expedidor'],
    qualificacao: ['qualificacao', 'ocupacao', 'profissao'],
    idoso: ['idoso', 'eidoso', 'seidoso', 'senior'],
    logradouro: ['logradouro', 'rua', 'endereco', 'end', 'endereco_rua'],
    numero: ['numero', 'num', 'n'],
    bairro: ['bairro'],
    cidade: ['cidade', 'municipio'],
    cep: ['cep', 'codigopostal', 'codpostal'],
    uf: ['uf', 'estado', 'siglaestado'],
    enderecocompleto: [
        'enderecocompleto',
        'enderecoformatado',
        'enderecofull',
        'endereco_full',
        'enderecocompletoformatado',
        'endereco',
    ],
    cidadeuf: ['cidadeuf', 'localidade', 'cidade_uf'],
    // bancário (conta principal)
    banco: [
        'banco',
        'banco_nome',
        'nomebanco',
        'bancodesc',
        'codigo_banco',
        'codigo_bco',
        'bancoquerecebe',
        'banco_que_recebe',
        'bancodestino',
        'bancorecebedor',
        'bancobeneficiario',
    ],
    agencia: [
        'agencia',
        'ag',
        'nragencia',
        'agenciaquerecebe',
        'agencia_que_recebe',
        'agenciadestino',
    ],
    conta: [
        'conta',
        'nconta',
        'contacorrente',
        'contanumero',
        'conta_numero',
        'contaquerecebe',
        'conta_que_recebe',
        'contadestino',
    ],
    digito: ['digito', 'dv', 'digitoverificador'],
    tipoconta: ['tipoconta', 'tipo', 'contatipo', 'tipo_conta'],
    contaformatada: ['contaformatada', 'agenciaconta', 'contacompleta'],
    // novos sinalizadores do cliente
    incapaz: ['incapaz', 'interditado', 'curatelado', 'tutelado'],
    criancaadolescente: [
        'criancaadolescente', 'crianca_adolescente', 'menor',
        'crianca', 'adolescente', 'criancaouadolescente',
    ],
    // dados civis
    nacionalidade: ['nacionalidade'],
    estadocivil: ['estadocivil', 'estado_civil'],
    profissao: ['profissao', 'ocupacao'],
};
const LOOKUP = new Map();
for (const [canon, list] of Object.entries(SYNONYMS)) {
    LOOKUP.set(canon, canon);
    for (const s of list)
        LOOKUP.set(s, canon);
}
function detectCanon(k) {
    if (LOOKUP.has(k))
        return LOOKUP.get(k); // já é sinônimo conhecido
    // bancário (sub-string match robusto)
    if (k.includes('banco'))
        return 'banco';
    if (k.includes('agencia') || k === 'ag')
        return 'agencia';
    if (k.includes('conta'))
        return 'conta';
    if (k.includes('digito') || k === 'dv')
        return 'digito';
    if ((k.includes('tipo') && k.includes('conta')) || k === 'tipoconta')
        return 'tipoconta';
    // cliente (alguns atalhos úteis)
    if (k.includes('enderecocompleto') || k === 'endereco')
        return 'enderecocompleto';
    if (k.includes('cidadeuf'))
        return 'cidadeuf';
    // novos: criança/adolescente
    if (k.includes('crianca') || k.includes('adolescente') || k.includes('menor')) {
        return 'criancaadolescente';
    }
    // novos: estado civil
    if ((k.includes('estado') && k.includes('civil')) || k === 'estadocivil') {
        return 'estadocivil';
    }
    return k; // sem match: deixa passar
}
const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
// pega conta principal do cliente (ou 1ª)
async function getContaPrincipalForCliente(clienteId) {
    const cid = Number(clienteId);
    if (!Number.isFinite(cid) || cid <= 0)
        return null;
    // tenta cache local primeiro
    const inCache = contas.principal(cid) || (contas.byCliente(cid) || [])[0] || null;
    if (inCache)
        return inCache;
    // carrega do servidor e tenta de novo
    try {
        await contas.fetchForCliente(cid);
    }
    catch {
        return null;
    }
    return contas.principal(cid) || (contas.byCliente(cid) || [])[0] || null;
}
// resolve valor para um field do template a partir do cliente e (opcional) conta
const valueFromSources = (c, acc, rawFieldName) => {
    const k = normKey(rawFieldName);
    const canon = detectCanon(k);
    // 1) campos do cliente
    if (c) {
        switch (canon) {
            case 'nome': {
                return c.nome_completo || '';
            }
            case 'cpf': {
                return maskCPF(c.cpf);
            }
            case 'rg': {
                return c.rg || '';
            }
            case 'orgaoexpedidor': {
                return c.orgao_expedidor || '';
            }
            case 'qualificacao': {
                return c.qualificacao || '';
            }
            case 'idoso': {
                return !!c.se_idoso;
            }
            case 'logradouro': {
                return c.logradouro || '';
            }
            case 'numero': {
                return c.numero || '';
            }
            case 'bairro': {
                return c.bairro || '';
            }
            case 'cidade': {
                return c.cidade || '';
            }
            case 'cep': {
                return maskCEP(c.cep);
            }
            case 'uf': {
                return (c.uf || '').toUpperCase();
            }
            case 'enderecocompleto': {
                return composeEndereco(c);
            }
            case 'cidadeuf': {
                return ([c.cidade, (c.uf || '')?.toUpperCase()].filter(Boolean).join('/')
                    || '');
            }
            case 'incapaz': {
                return !!c.se_incapaz;
            }
            case 'criancaadolescente': {
                return !!c.se_crianca_adolescente;
            }
            case 'nacionalidade': {
                return c.nacionalidade || '';
            }
            case 'estadocivil': {
                return c.estado_civil || '';
            }
            case 'profissao': {
                return c.profissao || '';
            }
        }
    }
    // 2) campos bancários (conta principal)
    if (acc) {
        switch (canon) {
            case 'banco': {
                // Agora busca a descrição ativa (se existir) ou o nome do banco
                return acc.descricao_ativa || acc.banco_nome || '';
            }
            case 'agencia': {
                return acc.agencia || '';
            }
            case 'conta': {
                return acc.conta || '';
            }
            case 'digito': {
                return acc.digito || '';
            }
            case 'tipoconta': {
                return acc.tipo || '';
            }
            case 'contaformatada': {
                const ag = acc.agencia ?? '';
                const num = acc.conta ?? '';
                const dv = acc.digito ?? '';
                return [ag, num].filter(Boolean).join('/') + (dv ? `-${dv}` : '');
            }
        }
    }
    // sem match
    return undefined;
};
// =========================
// Carregamento e lookups
// =========================
const requestedClients = new Set();
function ensureClientInCache(id) {
    const cid = Number(id);
    if (!Number.isFinite(cid) || cid <= 0)
        return;
    const found = clientes.items.some(c => Number(c.id) === cid);
    if (!found && !requestedClients.has(cid)) {
        requestedClients.add(cid);
        clientes.getDetail(cid).catch(() => { });
    }
}
// Opções para selects
const clientOptions = computed(() => clientes.items.map(c => ({
    title: c.nome_completo || `#${Number(c.id)}`,
    value: Number(c.id),
})));
const templateOptions = computed(() => templates.items.map(t => ({ title: t.name, value: Number(t.id) })));
// =========================
// Tabela
// =========================
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref([
    { key: 'created_at', order: 'desc' },
]);
const headers = [
    { title: 'Cliente', key: 'cliente' },
    { title: 'Template', key: 'template' },
    { title: 'Criada em', key: 'created_at' },
    { title: 'Atualizada em', key: 'updated_at' },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];
const clienteNome = (id, fallback) => {
    if (fallback && String(fallback).trim())
        return String(fallback);
    const cid = Number(id);
    if (!Number.isFinite(cid) || cid <= 0)
        return '—';
    const c = clientes.items.find(x => Number(x.id) === cid);
    if (c)
        return c.nome_completo || `#${cid}`;
    ensureClientInCache(cid);
    return '—';
};
const templateLabel = (id) => {
    const tid = Number(id);
    if (!Number.isFinite(tid) || tid <= 0)
        return '—';
    const t = templates.byId(tid);
    return t ? t.name : `#${tid}`;
};
// =========================
// Dialog / Form
// =========================
const dialogUpsert = ref(false);
const editing = ref(null);
const form = reactive({
    cliente: null,
    template: null,
    context: {},
});
const fieldsLoading = ref(false);
const fields = ref([]);
const syntaxInfo = ref('');
async function loadFieldsForTemplate(tid, force = false) {
    const id = typeof tid === 'string' ? Number(tid) : tid;
    fields.value = [];
    syntaxInfo.value = '';
    if (!Number.isFinite(id) || id <= 0)
        return;
    fieldsLoading.value = true;
    try {
        const resp = await templates.fetchFields(id, { force });
        syntaxInfo.value = resp.syntax || '';
        if (resp.syntax && resp.syntax.toLowerCase().includes('angle')) {
            templates.lastError
                = 'Este template ainda usa << >>. Atualize para {{ }} antes de gerar.';
            fields.value = [];
            return;
        }
        fields.value = resp.fields || [];
        // Garante chaves no context para todos os fields
        for (const f of fields.value) {
            if (!(f.name in form.context))
                form.context[f.name] = '';
        }
        // Tenta autopreencher se já houver cliente selecionado
        await nextTick();
        await tryPrefillFromSources();
    }
    catch (error_) {
        templates.lastError
            = error_?.response?.data?.detail
                || error_?.message
                || 'Falha ao carregar campos do template';
    }
    finally {
        fieldsLoading.value = false;
    }
}
// Dispara quando template mudar
watch(() => form.template, tid => loadFieldsForTemplate(tid, true));
// Dispara quando cliente mudar (carrega cliente + contas e preenche)
watch(() => form.cliente, async (cid) => {
    if (!cid)
        return;
    ensureClientInCache(Number(cid));
    const c = clientes.items.find(x => Number(x.id) === Number(cid));
    if (c) {
        if (form.context.idoso === undefined)
            form.context.idoso = !!c.se_idoso;
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
});
async function tryPrefillFromSources() {
    if (!form.cliente || fields.value.length === 0)
        return;
    // garante cliente e contas
    let c = clientes.items.find(x => Number(x.id) === Number(form.cliente)) || null;
    if (!c) {
        try {
            c = await clientes.getDetail(Number(form.cliente));
        }
        catch {
            /* ignore */
        }
    }
    const acc = await getContaPrincipalForCliente(Number(form.cliente));
    // percorre os campos do template e preenche se vazio
    for (const f of fields.value) {
        const current = form.context[f.name];
        if (!isEmpty(current))
            continue;
        const v = valueFromSources(c, acc, f.name);
        if (v === undefined || v === null || v === '')
            continue;
        if (f.type === 'bool') {
            form.context[f.name] = Boolean(v);
        }
        else if (f.type === 'int') {
            const n = Number(v);
            if (!Number.isNaN(n))
                form.context[f.name] = n;
        }
        else {
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
    syntaxInfo.value = '';
    if (clientes.items.length === 0) {
        await clientes.fetchList({ page: 1, page_size: 500 });
    }
    dialogUpsert.value = true;
}
function openEdit(p) {
    editing.value = p;
    form.cliente = Number(p.cliente) || null;
    form.template = Number(p.template) || null;
    form.context = { ...p.context };
    dialogUpsert.value = true;
    ensureClientInCache(p.cliente);
    // também podemos pré-carregar contas para o cliente já selecionado
    if (p.cliente)
        contas.fetchForCliente(Number(p.cliente)).catch(() => { });
    loadFieldsForTemplate(p.template || null, true);
}
async function saveUpsert() {
    try {
        if (!form.cliente)
            throw new Error('Selecione o cliente.');
        if (!form.template)
            throw new Error('Selecione o template.');
        const payload = {
            cliente: Number(form.cliente),
            template: Number(form.template),
            context: form.context || {},
        };
        await (editing.value
            ? peticoes.update(editing.value.id, payload)
            : peticoes.create(payload));
        dialogUpsert.value = false;
    }
    catch (error_) {
        peticoes.error
            = error_?.response?.data?.detail
                || error_?.message
                || 'Erro ao salvar petição.';
    }
}
async function removePetition(p) {
    if (!confirm('Excluir esta petição?'))
        return;
    try {
        await peticoes.remove(p.id);
    }
    catch (error_) {
        peticoes.error
            = error_?.response?.data?.detail || 'Não foi possível excluir.';
    }
}
// ===== render =====
const dialogRender = ref(false);
const rendering = ref(false);
const renderItem = ref(null);
const renderFilename = ref('');
async function openRender(p) {
    try {
        await loadFieldsForTemplate(p.template, false);
        if (syntaxInfo.value && syntaxInfo.value.toLowerCase().includes('angle'))
            return;
        renderItem.value = p;
        renderFilename.value = `peticao_${p.id}.docx`;
        dialogRender.value = true;
    }
    catch (error_) {
        peticoes.error
            = error_?.response?.data?.detail
                || error_?.message
                || 'Não foi possível abrir geração.';
    }
}
async function doRender() {
    if (!renderItem.value)
        return;
    rendering.value = true;
    try {
        const result = await peticoes.render(renderItem.value.id, {
            filename: renderFilename.value.trim() || undefined,
            strict: true,
        });
        peticoes.downloadRendered(result);
        dialogRender.value = false;
    }
    catch {
        // erro já populado
    }
    finally {
        rendering.value = false;
    }
}
// ===== carregamento inicial =====
const loading = computed(() => peticoes.loading);
const error = computed(() => peticoes.error || templates.lastError);
const items = computed(() => peticoes.items);
async function loadAll() {
    await clientes.fetchList({ page: 1, page_size: 500 });
    await Promise.all([
        templates.fetch({ page: 1, page_size: 100, active: true }),
        peticoes.fetch({ page: 1, page_size: itemsPerPage.value }),
    ]);
}
onMounted(loadAll);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.VContainer;
/** @type {[typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, ]} */ ;
// @ts-ignore
VContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    fluid: true,
}));
const __VLS_2 = __VLS_1({
    fluid: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
const { default: __VLS_5 } = __VLS_3.slots;
const __VLS_6 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ class: "rounded-xl mb-4" },
    elevation: "2",
}));
const __VLS_8 = __VLS_7({
    ...{ class: "rounded-xl mb-4" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_10 } = __VLS_9.slots;
const __VLS_11 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    ...{ class: "d-flex align-center" },
}));
const __VLS_13 = __VLS_12({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_15 } = __VLS_14.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-1" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-body-2 text-medium-emphasis" },
});
const __VLS_16 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_21 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    ...{ 'onClick': {} },
    color: "primary",
    prependIcon: "mdi-file-document-plus",
}));
const __VLS_23 = __VLS_22({
    ...{ 'onClick': {} },
    color: "primary",
    prependIcon: "mdi-file-document-plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_25;
let __VLS_26;
const __VLS_27 = ({ click: {} },
    { onClick: (__VLS_ctx.openCreate) });
const { default: __VLS_28 } = __VLS_24.slots;
// @ts-ignore
[openCreate,];
var __VLS_24;
var __VLS_14;
var __VLS_9;
const __VLS_29 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_31 = __VLS_30({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const { default: __VLS_33 } = __VLS_32.slots;
const __VLS_34 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    ...{ class: "d-flex align-center" },
}));
const __VLS_36 = __VLS_35({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
const { default: __VLS_38 } = __VLS_37.slots;
const __VLS_39 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent(__VLS_39, new __VLS_39({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}));
const __VLS_41 = __VLS_40({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_40));
// @ts-ignore
[search,];
var __VLS_37;
const __VLS_44 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const { default: __VLS_48 } = __VLS_47.slots;
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    const __VLS_49 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }));
    const __VLS_51 = __VLS_50({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    const { default: __VLS_53 } = __VLS_52.slots;
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
    var __VLS_52;
}
const __VLS_54 = {}.VDataTable;
/** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
// @ts-ignore
VDataTable;
// @ts-ignore
const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}));
const __VLS_56 = __VLS_55({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_55));
const { default: __VLS_58 } = __VLS_57.slots;
// @ts-ignore
[search, itemsPerPage, page, sortBy, headers, items, loading,];
{
    const { 'item.cliente': __VLS_59 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_59);
    (__VLS_ctx.clienteNome(item.cliente, item.cliente_nome));
    // @ts-ignore
    [clienteNome,];
}
{
    const { 'item.template': __VLS_60 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_60);
    (__VLS_ctx.templateLabel(item.template));
    // @ts-ignore
    [templateLabel,];
}
{
    const { 'item.created_at': __VLS_61 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_61);
    (item.created_at && !isNaN(new Date(item.created_at).getTime())
        ? new Date(item.created_at).toLocaleString()
        : "—");
}
{
    const { 'item.updated_at': __VLS_62 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_62);
    (item.updated_at && !isNaN(new Date(item.updated_at).getTime())
        ? new Date(item.updated_at).toLocaleString()
        : "—");
}
{
    const { 'item.actions': __VLS_63 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_63);
    const __VLS_64 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_66 = __VLS_65({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_68;
    let __VLS_69;
    const __VLS_70 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openEdit(item);
                // @ts-ignore
                [openEdit,];
            } });
    const { default: __VLS_71 } = __VLS_67.slots;
    const __VLS_72 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        icon: "mdi-pencil",
    }));
    const __VLS_74 = __VLS_73({
        icon: "mdi-pencil",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    var __VLS_67;
    const __VLS_77 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_79 = __VLS_78({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    let __VLS_81;
    let __VLS_82;
    const __VLS_83 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openRender(item);
                // @ts-ignore
                [openRender,];
            } });
    const { default: __VLS_84 } = __VLS_80.slots;
    const __VLS_85 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
        icon: "mdi-download",
    }));
    const __VLS_87 = __VLS_86({
        icon: "mdi-download",
    }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    var __VLS_80;
    const __VLS_90 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_92 = __VLS_91({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_94;
    let __VLS_95;
    const __VLS_96 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.removePetition(item);
                // @ts-ignore
                [removePetition,];
            } });
    const { default: __VLS_97 } = __VLS_93.slots;
    const __VLS_98 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
        icon: "mdi-delete",
    }));
    const __VLS_100 = __VLS_99({
        icon: "mdi-delete",
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    var __VLS_93;
}
{
    const { 'no-data': __VLS_103 } = __VLS_57.slots;
    const __VLS_104 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_106 = __VLS_105({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    const { default: __VLS_108 } = __VLS_107.slots;
    var __VLS_107;
}
var __VLS_57;
var __VLS_47;
var __VLS_32;
const __VLS_109 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({
    modelValue: (__VLS_ctx.dialogUpsert),
    maxWidth: "920",
}));
const __VLS_111 = __VLS_110({
    modelValue: (__VLS_ctx.dialogUpsert),
    maxWidth: "920",
}, ...__VLS_functionalComponentArgsRest(__VLS_110));
const { default: __VLS_113 } = __VLS_112.slots;
// @ts-ignore
[dialogUpsert,];
const __VLS_114 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({}));
const __VLS_116 = __VLS_115({}, ...__VLS_functionalComponentArgsRest(__VLS_115));
const { default: __VLS_118 } = __VLS_117.slots;
const __VLS_119 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({}));
const __VLS_121 = __VLS_120({}, ...__VLS_functionalComponentArgsRest(__VLS_120));
const { default: __VLS_123 } = __VLS_122.slots;
(__VLS_ctx.editing ? "Editar petição" : "Nova petição");
// @ts-ignore
[editing,];
var __VLS_122;
const __VLS_124 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
const { default: __VLS_128 } = __VLS_127.slots;
const __VLS_129 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
    ...{ 'onSubmit': {} },
}));
const __VLS_131 = __VLS_130({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_130));
let __VLS_133;
let __VLS_134;
const __VLS_135 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.saveUpsert) });
const { default: __VLS_136 } = __VLS_132.slots;
// @ts-ignore
[saveUpsert,];
const __VLS_137 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
    dense: true,
}));
const __VLS_139 = __VLS_138({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_138));
const { default: __VLS_141 } = __VLS_140.slots;
const __VLS_142 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    cols: "12",
    md: "6",
}));
const __VLS_144 = __VLS_143({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
const { default: __VLS_146 } = __VLS_145.slots;
const __VLS_147 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
VSelect;
// @ts-ignore
const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
    modelValue: (__VLS_ctx.form.cliente),
    clearable: true,
    itemTitle: "title",
    itemValue: "value",
    items: (__VLS_ctx.clientOptions),
    label: "Cliente",
    loading: (__VLS_ctx.clientes.loading),
    noDataText: "Nenhum cliente encontrado",
    returnObject: (false),
    rules: ([(v) => (!!v) || 'Obrigatório']),
    valueComparator: ((a, b) => Number(a) === Number(b)),
}));
const __VLS_149 = __VLS_148({
    modelValue: (__VLS_ctx.form.cliente),
    clearable: true,
    itemTitle: "title",
    itemValue: "value",
    items: (__VLS_ctx.clientOptions),
    label: "Cliente",
    loading: (__VLS_ctx.clientes.loading),
    noDataText: "Nenhum cliente encontrado",
    returnObject: (false),
    rules: ([(v) => (!!v) || 'Obrigatório']),
    valueComparator: ((a, b) => Number(a) === Number(b)),
}, ...__VLS_functionalComponentArgsRest(__VLS_148));
// @ts-ignore
[form, clientOptions, clientes,];
var __VLS_145;
const __VLS_152 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
    cols: "12",
    md: "6",
}));
const __VLS_154 = __VLS_153({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_153));
const { default: __VLS_156 } = __VLS_155.slots;
const __VLS_157 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
VSelect;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.form.template),
    clearable: true,
    itemTitle: "title",
    itemValue: "value",
    items: (__VLS_ctx.templateOptions),
    label: "Template",
    returnObject: (false),
    rules: ([(v) => (!!v) || 'Obrigatório']),
}));
const __VLS_159 = __VLS_158({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.form.template),
    clearable: true,
    itemTitle: "title",
    itemValue: "value",
    items: (__VLS_ctx.templateOptions),
    label: "Template",
    returnObject: (false),
    rules: ([(v) => (!!v) || 'Obrigatório']),
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
let __VLS_161;
let __VLS_162;
const __VLS_163 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': ((v) => __VLS_ctx.loadFieldsForTemplate(v, true)) });
// @ts-ignore
[form, templateOptions, loadFieldsForTemplate,];
var __VLS_160;
var __VLS_155;
const __VLS_165 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_166 = __VLS_asFunctionalComponent(__VLS_165, new __VLS_165({
    cols: "12",
}));
const __VLS_167 = __VLS_166({
    cols: "12",
}, ...__VLS_functionalComponentArgsRest(__VLS_166));
const { default: __VLS_169 } = __VLS_168.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center justify-space-between mb-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-2" },
});
const __VLS_170 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.form.cliente || __VLS_ctx.fieldsLoading || __VLS_ctx.fields.length === 0),
    prependIcon: "mdi-content-copy",
    size: "small",
    title: "Preencher com dados do cliente (inclui bancários)",
    variant: "tonal",
}));
const __VLS_172 = __VLS_171({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.form.cliente || __VLS_ctx.fieldsLoading || __VLS_ctx.fields.length === 0),
    prependIcon: "mdi-content-copy",
    size: "small",
    title: "Preencher com dados do cliente (inclui bancários)",
    variant: "tonal",
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
let __VLS_174;
let __VLS_175;
const __VLS_176 = ({ click: {} },
    { onClick: (__VLS_ctx.tryPrefillFromSources) });
const { default: __VLS_177 } = __VLS_173.slots;
// @ts-ignore
[form, fieldsLoading, fields, tryPrefillFromSources,];
var __VLS_173;
if (__VLS_ctx.syntaxInfo && __VLS_ctx.syntaxInfo.toLowerCase().includes('angle')) {
    // @ts-ignore
    [syntaxInfo, syntaxInfo,];
    const __VLS_178 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }));
    const __VLS_180 = __VLS_179({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_179));
    const { default: __VLS_182 } = __VLS_181.slots;
    __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
    __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
    ("{");
    ("}");
    var __VLS_181;
}
if (__VLS_ctx.fieldsLoading) {
    // @ts-ignore
    [fieldsLoading,];
    const __VLS_183 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    VSkeletonLoader;
    // @ts-ignore
    const __VLS_184 = __VLS_asFunctionalComponent(__VLS_183, new __VLS_183({
        type: "article",
    }));
    const __VLS_185 = __VLS_184({
        type: "article",
    }, ...__VLS_functionalComponentArgsRest(__VLS_184));
}
else {
    if (__VLS_ctx.fields.length > 0) {
        // @ts-ignore
        [fields,];
        const __VLS_188 = {}.VRow;
        /** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
        // @ts-ignore
        VRow;
        // @ts-ignore
        const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
            dense: true,
        }));
        const __VLS_190 = __VLS_189({
            dense: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_189));
        const { default: __VLS_192 } = __VLS_191.slots;
        for (const [f] of __VLS_getVForSourceType((__VLS_ctx.fields))) {
            // @ts-ignore
            [fields,];
            const __VLS_193 = {}.VCol;
            /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
            // @ts-ignore
            VCol;
            // @ts-ignore
            const __VLS_194 = __VLS_asFunctionalComponent(__VLS_193, new __VLS_193({
                key: (f.name),
                cols: "12",
                md: "6",
            }));
            const __VLS_195 = __VLS_194({
                key: (f.name),
                cols: "12",
                md: "6",
            }, ...__VLS_functionalComponentArgsRest(__VLS_194));
            const { default: __VLS_197 } = __VLS_196.slots;
            if (f.type === 'bool') {
                const __VLS_198 = {}.VSwitch;
                /** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
                // @ts-ignore
                VSwitch;
                // @ts-ignore
                const __VLS_199 = __VLS_asFunctionalComponent(__VLS_198, new __VLS_198({
                    modelValue: (__VLS_ctx.form.context[f.name]),
                    hideDetails: true,
                    label: (f.raw || f.name),
                }));
                const __VLS_200 = __VLS_199({
                    modelValue: (__VLS_ctx.form.context[f.name]),
                    hideDetails: true,
                    label: (f.raw || f.name),
                }, ...__VLS_functionalComponentArgsRest(__VLS_199));
                // @ts-ignore
                [form,];
            }
            else {
                const __VLS_203 = {}.VTextField;
                /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
                // @ts-ignore
                VTextField;
                // @ts-ignore
                const __VLS_204 = __VLS_asFunctionalComponent(__VLS_203, new __VLS_203({
                    modelValue: (__VLS_ctx.form.context[f.name]),
                    hideDetails: "auto",
                    label: (f.raw || f.name),
                    type: (f.type === 'int' ? 'number' : 'text'),
                }));
                const __VLS_205 = __VLS_204({
                    modelValue: (__VLS_ctx.form.context[f.name]),
                    hideDetails: "auto",
                    label: (f.raw || f.name),
                    type: (f.type === 'int' ? 'number' : 'text'),
                }, ...__VLS_functionalComponentArgsRest(__VLS_204));
                // @ts-ignore
                [form,];
            }
            var __VLS_196;
        }
        var __VLS_191;
    }
    else {
        const __VLS_208 = {}.VAlert;
        /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
        // @ts-ignore
        VAlert;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
            type: "info",
            variant: "tonal",
        }));
        const __VLS_210 = __VLS_209({
            type: "info",
            variant: "tonal",
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
        const { default: __VLS_212 } = __VLS_211.slots;
        var __VLS_211;
    }
}
var __VLS_168;
var __VLS_140;
var __VLS_132;
var __VLS_127;
const __VLS_213 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_214 = __VLS_asFunctionalComponent(__VLS_213, new __VLS_213({}));
const __VLS_215 = __VLS_214({}, ...__VLS_functionalComponentArgsRest(__VLS_214));
const { default: __VLS_217 } = __VLS_216.slots;
const __VLS_218 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_219 = __VLS_asFunctionalComponent(__VLS_218, new __VLS_218({}));
const __VLS_220 = __VLS_219({}, ...__VLS_functionalComponentArgsRest(__VLS_219));
const __VLS_223 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_224 = __VLS_asFunctionalComponent(__VLS_223, new __VLS_223({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_225 = __VLS_224({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_224));
let __VLS_227;
let __VLS_228;
const __VLS_229 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialogUpsert = false;
            // @ts-ignore
            [dialogUpsert,];
        } });
const { default: __VLS_230 } = __VLS_226.slots;
var __VLS_226;
const __VLS_231 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_232 = __VLS_asFunctionalComponent(__VLS_231, new __VLS_231({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_233 = __VLS_232({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_232));
let __VLS_235;
let __VLS_236;
const __VLS_237 = ({ click: {} },
    { onClick: (__VLS_ctx.saveUpsert) });
const { default: __VLS_238 } = __VLS_234.slots;
// @ts-ignore
[saveUpsert,];
var __VLS_234;
var __VLS_216;
var __VLS_117;
var __VLS_112;
const __VLS_239 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_240 = __VLS_asFunctionalComponent(__VLS_239, new __VLS_239({
    modelValue: (__VLS_ctx.dialogRender),
    maxWidth: "720",
}));
const __VLS_241 = __VLS_240({
    modelValue: (__VLS_ctx.dialogRender),
    maxWidth: "720",
}, ...__VLS_functionalComponentArgsRest(__VLS_240));
const { default: __VLS_243 } = __VLS_242.slots;
// @ts-ignore
[dialogRender,];
const __VLS_244 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({}));
const __VLS_246 = __VLS_245({}, ...__VLS_functionalComponentArgsRest(__VLS_245));
const { default: __VLS_248 } = __VLS_247.slots;
const __VLS_249 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_250 = __VLS_asFunctionalComponent(__VLS_249, new __VLS_249({}));
const __VLS_251 = __VLS_250({}, ...__VLS_functionalComponentArgsRest(__VLS_250));
const { default: __VLS_253 } = __VLS_252.slots;
var __VLS_252;
const __VLS_254 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({}));
const __VLS_256 = __VLS_255({}, ...__VLS_functionalComponentArgsRest(__VLS_255));
const { default: __VLS_258 } = __VLS_257.slots;
const __VLS_259 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_260 = __VLS_asFunctionalComponent(__VLS_259, new __VLS_259({
    ...{ 'onSubmit': {} },
}));
const __VLS_261 = __VLS_260({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_260));
let __VLS_263;
let __VLS_264;
const __VLS_265 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.doRender) });
const { default: __VLS_266 } = __VLS_262.slots;
// @ts-ignore
[doRender,];
const __VLS_267 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_268 = __VLS_asFunctionalComponent(__VLS_267, new __VLS_267({
    modelValue: (__VLS_ctx.renderFilename),
    ...{ class: "mb-4" },
    label: "Nome do arquivo (.docx)",
}));
const __VLS_269 = __VLS_268({
    modelValue: (__VLS_ctx.renderFilename),
    ...{ class: "mb-4" },
    label: "Nome do arquivo (.docx)",
}, ...__VLS_functionalComponentArgsRest(__VLS_268));
// @ts-ignore
[renderFilename,];
if (__VLS_ctx.syntaxInfo && __VLS_ctx.syntaxInfo.toLowerCase().includes('angle')) {
    // @ts-ignore
    [syntaxInfo, syntaxInfo,];
    const __VLS_272 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }));
    const __VLS_274 = __VLS_273({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_273));
    const { default: __VLS_276 } = __VLS_275.slots;
    __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
    var __VLS_275;
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-caption text-medium-emphasis" },
});
var __VLS_262;
var __VLS_257;
const __VLS_277 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({}));
const __VLS_279 = __VLS_278({}, ...__VLS_functionalComponentArgsRest(__VLS_278));
const { default: __VLS_281 } = __VLS_280.slots;
const __VLS_282 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_283 = __VLS_asFunctionalComponent(__VLS_282, new __VLS_282({}));
const __VLS_284 = __VLS_283({}, ...__VLS_functionalComponentArgsRest(__VLS_283));
const __VLS_287 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_288 = __VLS_asFunctionalComponent(__VLS_287, new __VLS_287({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_289 = __VLS_288({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_288));
let __VLS_291;
let __VLS_292;
const __VLS_293 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialogRender = false;
            // @ts-ignore
            [dialogRender,];
        } });
const { default: __VLS_294 } = __VLS_290.slots;
var __VLS_290;
const __VLS_295 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_296 = __VLS_asFunctionalComponent(__VLS_295, new __VLS_295({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rendering),
}));
const __VLS_297 = __VLS_296({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rendering),
}, ...__VLS_functionalComponentArgsRest(__VLS_296));
let __VLS_299;
let __VLS_300;
const __VLS_301 = ({ click: {} },
    { onClick: (__VLS_ctx.doRender) });
const { default: __VLS_302 } = __VLS_298.slots;
// @ts-ignore
[doRender, rendering,];
var __VLS_298;
var __VLS_280;
var __VLS_247;
var __VLS_242;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            clientes: clientes,
            clientOptions: clientOptions,
            templateOptions: templateOptions,
            search: search,
            page: page,
            itemsPerPage: itemsPerPage,
            sortBy: sortBy,
            headers: headers,
            clienteNome: clienteNome,
            templateLabel: templateLabel,
            dialogUpsert: dialogUpsert,
            editing: editing,
            form: form,
            fieldsLoading: fieldsLoading,
            fields: fields,
            syntaxInfo: syntaxInfo,
            loadFieldsForTemplate: loadFieldsForTemplate,
            tryPrefillFromSources: tryPrefillFromSources,
            openCreate: openCreate,
            openEdit: openEdit,
            saveUpsert: saveUpsert,
            removePetition: removePetition,
            dialogRender: dialogRender,
            rendering: rendering,
            renderFilename: renderFilename,
            openRender: openRender,
            doRender: doRender,
            loading: loading,
            error: error,
            items: items,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
