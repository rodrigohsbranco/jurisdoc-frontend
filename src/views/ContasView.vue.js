import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useClientesStore } from '@/stores/clientes';
import { useContasStore, } from '@/stores/contas';
const route = useRoute();
const router = useRouter();
const contas = useContasStore();
const clientes = useClientesStore();
const clienteId = computed(() => Number(route.params.id));
const cliente = ref(null);
const loading = computed(() => contas.loading);
const error = computed(() => contas.error);
// === Bancos (autocomplete com fallback offline) ===
const bankItems = ref([]);
const bankSearch = ref('');
const bankLoading = ref(false);
// === Identificador do banco escolhido (ISPB preferido; ou COMPE/slug) ===
const bankIspb = ref(''); // chave para backend (banco_id)
const CUSTOM_BANKS = [
    { label: 'DEPÓSITO DIRETO NO CARTÃO', ispb: 'CARD-DEP' },
    // 👇 Adicione seus extras aqui (use um ID curto, <=32, estável)
    { label: 'BANCO OLE BONSUCESSO CONSIGNADO S.A.', ispb: 'CARD-OLE' },
    // { label: 'AGIPLAN S.A.', ispb: 'CARD-AGI' },
];
// === Variações de descrição por banco (no servidor) ===
const bankNotes = ref([]);
const selectedNoteId = ref(null);
// lista mínima para funcionar offline
const FALLBACK_BANKS = [
    'Banco do Brasil (001)',
    'Bradesco (237)',
    'Itaú Unibanco (341)',
    'Caixa Econômica Federal (104)',
    'Santander (033)',
    'Nubank (260)',
    'Inter (077)',
    'C6 Bank (336)',
    'BTG Pactual (208)',
    'Sicoob (756)',
    'Sicredi (748)',
    'Banrisul (041)',
    'BRB (070)',
    'Banco Original (212)',
    'PagBank (290)',
].map(label => ({ label }));
// tabela (client-side)
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref([
    { key: 'banco_nome', order: 'asc' },
]);
// diálogo criar/editar
const dialog = ref(false);
const editing = ref(null);
const form = ref({
    banco_nome: '',
    agencia: '',
    conta: '',
    digito: '',
    tipo: 'corrente',
    is_principal: false,
});
// helpers
function onlyDigits(v) {
    return (v || '').replace(/\D/g, '');
}
function bankLabel() {
    return typeof form.value.banco_nome === 'string'
        ? (form.value.banco_nome || '').trim()
        : form.value.banco_nome?.label?.trim?.() || '';
}
function resetForm() {
    form.value = {
        banco_nome: '',
        agencia: '',
        conta: '',
        digito: '',
        tipo: 'corrente',
        is_principal: false,
    };
}
function openCreate() {
    editing.value = null;
    resetForm();
    dialog.value = true;
    // reseta variações
    bankIspb.value = '';
    bankNotes.value = [];
    selectedNoteId.value = null;
}
async function openEdit(c) {
    editing.value = c;
    form.value = { ...c };
    dialog.value = true;
    await loadBankCatalog();
    await onBankChange(String(form.value.banco_nome || ''));
}
function findBankMetaByLabel(label) {
    return bankItems.value.find(i => i.label === label) || null;
}
function extractCompeFromLabel(label) {
    const m = /\((\d{3})\)\s*$/.exec(label);
    return m ? m[1] : '';
}
function ensureCustomBanks(list) {
    // unshift na ordem inversa para manter a ordem definida acima no topo
    for (const cb of [...CUSTOM_BANKS].reverse()) {
        if (!list.some(i => i.label === cb.label)) {
            list.unshift({ label: cb.label, ispb: cb.ispb });
        }
    }
}
function normalizeBankId(input) {
    // Uppercase + remove acentos
    let v = (input || '').toUpperCase();
    v = v.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
    // Espaços/pontos -> hífen; remove o que não for A-Z/0-9/_/-
    v = v.replace(/[\s\.]+/g, '-').replace(/[^A-Z0-9_-]/g, '');
    // Compacta múltiplos hífens/underscores e tira das pontas
    v = v.replace(/[-_]{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
    // Limita a 32 chars e evita terminar em hífen
    if (v.length > 32)
        v = v.slice(0, 32).replace(/[-_]+$/g, '');
    // Garante algo minimamente válido
    if (v.length < 3)
        v = (v + '-BANK').slice(0, 3);
    return v;
}
async function refreshNotes() {
    bankNotes.value = [];
    selectedNoteId.value = null;
    if (!bankIspb.value)
        return;
    const list = await contas.listDescricoes(bankIspb.value);
    bankNotes.value = list;
    const ativa = list.find(n => n.is_ativa);
    selectedNoteId.value = ativa ? ativa.id : list[0]?.id ?? null;
}
// dispara ao trocar o banco no combobox
async function onBankChange(val) {
    const label = typeof val === 'string' ? val : val?.label ?? '';
    // limpa estado
    bankIspb.value = '';
    bankNotes.value = [];
    selectedNoteId.value = null;
    if (!label)
        return;
    await loadBankCatalog(); // garante catálogo em memória quando vindo de "Editar"
    const meta = findBankMetaByLabel(label);
    const compe = meta?.code || extractCompeFromLabel(label);
    // prioriza ISPB; se não houver, usa COMPE ou o próprio label como slug
    bankIspb.value = meta?.ispb || compe || normalizeBankId(label);
    // carrega variações do servidor (ativa primeiro)
    try {
        await refreshNotes();
    }
    catch {
        // erro já vai para store.error; não bloqueia o formulário
    }
}
async function loadBankCatalog() {
    if (bankItems.value.length > 0)
        return;
    bankLoading.value = true;
    try {
        // cache local para evitar hits repetidos (e ajudar quando oscila a rede)
        const cached = localStorage.getItem('br_banks_v1');
        if (cached) {
            bankItems.value = JSON.parse(cached);
            ensureCustomBanks(bankItems.value);
            return;
        }
        const resp = await fetch('https://brasilapi.com.br/api/banks/v1');
        if (!resp.ok)
            throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        const mapped = data.map(b => ({
            label: `${b.fullName || b.name}${b.code ? ` (${b.code})` : ''}`,
            code: b.code ? String(b.code) : undefined,
            ispb: b.ispb ? String(b.ispb) : undefined,
        }));
        mapped.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        ensureCustomBanks(mapped); // garante opção especial mesmo online
        bankItems.value = mapped;
        localStorage.setItem('br_banks_v1', JSON.stringify(mapped));
    }
    catch {
        // offline / erro de rede → fallback local
        bankItems.value = FALLBACK_BANKS;
        ensureCustomBanks(bankItems.value);
    }
    finally {
        bankLoading.value = false;
    }
}
async function addNote() {
    const nomeBanco = bankLabel();
    if (!bankIspb.value || !nomeBanco)
        return;
    try {
        await contas.createDescricaoBanco({
            banco_id: bankIspb.value,
            banco_nome: nomeBanco,
            descricao: '',
            is_ativa: false,
        });
        await refreshNotes();
        // não altera a ativa automaticamente — usuário decide com o radio
    }
    catch {
        /* erro já vai para store.error */
    }
}
async function setActiveNote(id) {
    if (!id)
        return;
    try {
        await contas.setDescricaoAtiva(id);
        // refreshNotes já chamado em store.setDescricaoAtiva; ainda assim garantimos estado:
        await refreshNotes();
    }
    catch {
        /* erro já vai para store.error */
    }
}
async function updateNoteText(note) {
    try {
        await contas.updateDescricaoBanco(note.id, { descricao: note.descricao });
        // cache já é atualizado via listDescricoes no store; aqui mantemos responsivo
    }
    catch {
        /* erro já vai para store.error */
    }
}
async function save() {
    try {
        // extrai o nome do banco como STRING (combobox pode entregar objeto)
        const nomeBanco = typeof form.value.banco_nome === 'string'
            ? form.value.banco_nome.trim()
            : form.value.banco_nome?.label?.trim?.() || '';
        // validações simples
        if (!nomeBanco)
            throw new Error('Informe o nome do banco.');
        if (!form.value.agencia || !String(form.value.agencia).trim())
            throw new Error('Informe a agência.');
        if (!form.value.conta || !String(form.value.conta).trim())
            throw new Error('Informe a conta.');
        // extras: apenas o banco_id (descrições são geridas pelas ações acima)
        const safeBankId = bankIspb.value
            || extractCompeFromLabel(nomeBanco)
            || normalizeBankId(nomeBanco);
        const extras = { banco_id: safeBankId };
        // sanitização
        const payload = {
            ...form.value,
            banco_nome: nomeBanco, // <-- garante string
            cliente: clienteId.value,
            agencia: onlyDigits(String(form.value.agencia || '')),
            conta: onlyDigits(String(form.value.conta || '')),
            digito: form.value.digito ? onlyDigits(String(form.value.digito)) : '',
            tipo: form.value.tipo || 'corrente',
        };
        await (editing.value
            ? contas.update(editing.value.id, { ...payload, ...extras })
            : contas.create(payload, extras));
        dialog.value = false;
        // limpa estado
        bankNotes.value = [];
        selectedNoteId.value = null;
        bankIspb.value = '';
    }
    catch (error_) {
        contas.error
            = error_?.response?.data?.detail || error_?.message || 'Erro ao salvar.';
    }
}
async function remove(acc) {
    if (!confirm(`Excluir a conta ${acc.banco_nome} (${acc.agencia}/${acc.conta}${acc.digito ? '-' + acc.digito : ''})?`))
        return;
    try {
        await contas.remove(acc.id);
    }
    catch (error_) {
        contas.error
            = error_?.response?.data?.detail || 'Não foi possível excluir.';
    }
}
async function makePrincipal(acc) {
    try {
        await contas.setPrincipal(acc.id);
    }
    catch (error_) {
        contas.error
            = error_?.response?.data?.detail
                || 'Não foi possível definir como principal.';
    }
}
function goBack() {
    router.push({ name: 'clientes' });
}
const headers = [
    { title: 'Banco', key: 'banco_nome' },
    { title: 'Agência', key: 'agencia' },
    { title: 'Conta', key: 'conta' },
    { title: 'Tipo', key: 'tipo' },
    { title: 'Principal', key: 'is_principal', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];
const contasDoCliente = computed(() => contas.byCliente(clienteId.value));
async function load() {
    if (!Number.isFinite(clienteId.value)) {
        router.replace({ name: 'clientes' });
        return;
    }
    try {
        cliente.value = await clientes.getDetail(clienteId.value);
    }
    catch {
        cliente.value = {
            id: clienteId.value,
            nome_completo: 'Cliente',
            cidade: '',
            uf: '',
        };
    }
    await contas.fetchForCliente(clienteId.value, { page: 1, page_size: 100 });
}
onMounted(load);
watch(() => route.params.id, load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
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
__VLS_asFunctionalElement(__VLS_elements.strong, __VLS_elements.strong)({});
(__VLS_ctx.cliente?.nome_completo || "#" + __VLS_ctx.clienteId);
// @ts-ignore
[cliente, clienteId,];
if (__VLS_ctx.cliente?.cidade) {
    // @ts-ignore
    [cliente,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.cliente.cidade);
    (__VLS_ctx.cliente?.uf);
    // @ts-ignore
    [cliente, cliente,];
}
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
    prependIcon: "mdi-arrow-left",
    variant: "text",
}));
const __VLS_23 = __VLS_22({
    ...{ 'onClick': {} },
    prependIcon: "mdi-arrow-left",
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_25;
let __VLS_26;
const __VLS_27 = ({ click: {} },
    { onClick: (__VLS_ctx.goBack) });
const { default: __VLS_28 } = __VLS_24.slots;
// @ts-ignore
[goBack,];
var __VLS_24;
const __VLS_29 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    ...{ 'onClick': {} },
    ...{ class: "ml-2" },
    color: "primary",
    prependIcon: "mdi-bank-plus",
}));
const __VLS_31 = __VLS_30({
    ...{ 'onClick': {} },
    ...{ class: "ml-2" },
    color: "primary",
    prependIcon: "mdi-bank-plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
let __VLS_33;
let __VLS_34;
const __VLS_35 = ({ click: {} },
    { onClick: (__VLS_ctx.openCreate) });
const { default: __VLS_36 } = __VLS_32.slots;
// @ts-ignore
[openCreate,];
var __VLS_32;
var __VLS_14;
var __VLS_9;
const __VLS_37 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_39 = __VLS_38({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
const { default: __VLS_41 } = __VLS_40.slots;
const __VLS_42 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
    ...{ class: "d-flex align-center" },
}));
const __VLS_44 = __VLS_43({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
const { default: __VLS_46 } = __VLS_45.slots;
const __VLS_47 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}));
const __VLS_49 = __VLS_48({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
// @ts-ignore
[search,];
var __VLS_45;
const __VLS_52 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const { default: __VLS_56 } = __VLS_55.slots;
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    const __VLS_57 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    const { default: __VLS_61 } = __VLS_60.slots;
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
    var __VLS_60;
}
const __VLS_62 = {}.VDataTable;
/** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
// @ts-ignore
VDataTable;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.contasDoCliente),
    loading: (__VLS_ctx.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}));
const __VLS_64 = __VLS_63({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.contasDoCliente),
    loading: (__VLS_ctx.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
const { default: __VLS_66 } = __VLS_65.slots;
// @ts-ignore
[search, itemsPerPage, page, sortBy, headers, contasDoCliente, loading,];
{
    const { 'item.agencia': __VLS_67 } = __VLS_65.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_67);
    (item.agencia || "—");
}
{
    const { 'item.conta': __VLS_68 } = __VLS_65.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_68);
    (item.conta);
    if (item.digito) {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (item.digito);
    }
}
{
    const { 'item.tipo': __VLS_69 } = __VLS_65.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_69);
    const __VLS_70 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    VChip;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
        size: "small",
        variant: "tonal",
    }));
    const __VLS_72 = __VLS_71({
        size: "small",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    const { default: __VLS_74 } = __VLS_73.slots;
    (item.tipo === "poupanca" ? "Poupança" : "Corrente");
    var __VLS_73;
}
{
    const { 'item.is_principal': __VLS_75 } = __VLS_65.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_75);
    if (item.is_principal) {
        const __VLS_76 = {}.VChip;
        /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
        // @ts-ignore
        VChip;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            color: "secondary",
            size: "small",
            variant: "elevated",
        }));
        const __VLS_78 = __VLS_77({
            color: "secondary",
            size: "small",
            variant: "elevated",
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        const { default: __VLS_80 } = __VLS_79.slots;
        var __VLS_79;
    }
    else {
        const __VLS_81 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        VBtn;
        // @ts-ignore
        const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
            ...{ 'onClick': {} },
            color: "secondary",
            size: "small",
            variant: "text",
        }));
        const __VLS_83 = __VLS_82({
            ...{ 'onClick': {} },
            color: "secondary",
            size: "small",
            variant: "text",
        }, ...__VLS_functionalComponentArgsRest(__VLS_82));
        let __VLS_85;
        let __VLS_86;
        const __VLS_87 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(item.is_principal))
                        return;
                    __VLS_ctx.makePrincipal(item);
                    // @ts-ignore
                    [makePrincipal,];
                } });
        const { default: __VLS_88 } = __VLS_84.slots;
        var __VLS_84;
    }
}
{
    const { 'item.actions': __VLS_89 } = __VLS_65.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_89);
    const __VLS_90 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_92 = __VLS_91({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_94;
    let __VLS_95;
    const __VLS_96 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openEdit(item);
                // @ts-ignore
                [openEdit,];
            } });
    const { default: __VLS_97 } = __VLS_93.slots;
    const __VLS_98 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
        icon: "mdi-pencil",
    }));
    const __VLS_100 = __VLS_99({
        icon: "mdi-pencil",
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    var __VLS_93;
    const __VLS_103 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_105 = __VLS_104({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_104));
    let __VLS_107;
    let __VLS_108;
    const __VLS_109 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.remove(item);
                // @ts-ignore
                [remove,];
            } });
    const { default: __VLS_110 } = __VLS_106.slots;
    const __VLS_111 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
        icon: "mdi-delete",
    }));
    const __VLS_113 = __VLS_112({
        icon: "mdi-delete",
    }, ...__VLS_functionalComponentArgsRest(__VLS_112));
    var __VLS_106;
}
{
    const { 'no-data': __VLS_116 } = __VLS_65.slots;
    const __VLS_117 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_119 = __VLS_118({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    const { default: __VLS_121 } = __VLS_120.slots;
    var __VLS_120;
}
var __VLS_65;
var __VLS_55;
var __VLS_40;
const __VLS_122 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "840",
}));
const __VLS_124 = __VLS_123({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "840",
}, ...__VLS_functionalComponentArgsRest(__VLS_123));
const { default: __VLS_126 } = __VLS_125.slots;
// @ts-ignore
[dialog,];
const __VLS_127 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({}));
const __VLS_129 = __VLS_128({}, ...__VLS_functionalComponentArgsRest(__VLS_128));
const { default: __VLS_131 } = __VLS_130.slots;
const __VLS_132 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
const { default: __VLS_136 } = __VLS_135.slots;
(__VLS_ctx.editing ? "Editar conta" : "Nova conta");
// @ts-ignore
[editing,];
var __VLS_135;
const __VLS_137 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({}));
const __VLS_139 = __VLS_138({}, ...__VLS_functionalComponentArgsRest(__VLS_138));
const { default: __VLS_141 } = __VLS_140.slots;
const __VLS_142 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    ...{ 'onSubmit': {} },
}));
const __VLS_144 = __VLS_143({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
let __VLS_146;
let __VLS_147;
const __VLS_148 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.save) });
const { default: __VLS_149 } = __VLS_145.slots;
// @ts-ignore
[save,];
const __VLS_150 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
    dense: true,
}));
const __VLS_152 = __VLS_151({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_151));
const { default: __VLS_154 } = __VLS_153.slots;
const __VLS_155 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
    cols: "12",
    md: "6",
}));
const __VLS_157 = __VLS_156({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_156));
const { default: __VLS_159 } = __VLS_158.slots;
const __VLS_160 = {}.VCombobox;
/** @type {[typeof __VLS_components.VCombobox, typeof __VLS_components.vCombobox, ]} */ ;
// @ts-ignore
VCombobox;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    ...{ 'onFocus': {} },
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.form.banco_nome),
    search: (__VLS_ctx.bankSearch),
    clearable: true,
    itemTitle: "label",
    itemValue: "label",
    items: (__VLS_ctx.bankItems),
    label: "Banco",
    loading: (__VLS_ctx.bankLoading),
    required: true,
    returnObject: (false),
    rules: ([
        (v) => (typeof v === 'string' && v.trim().length > 0) ||
            (v &&
                typeof v === 'object' &&
                v.label &&
                String(v.label).trim().length > 0) ||
            'Obrigatório',
    ]),
}));
const __VLS_162 = __VLS_161({
    ...{ 'onFocus': {} },
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.form.banco_nome),
    search: (__VLS_ctx.bankSearch),
    clearable: true,
    itemTitle: "label",
    itemValue: "label",
    items: (__VLS_ctx.bankItems),
    label: "Banco",
    loading: (__VLS_ctx.bankLoading),
    required: true,
    returnObject: (false),
    rules: ([
        (v) => (typeof v === 'string' && v.trim().length > 0) ||
            (v &&
                typeof v === 'object' &&
                v.label &&
                String(v.label).trim().length > 0) ||
            'Obrigatório',
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
let __VLS_164;
let __VLS_165;
const __VLS_166 = ({ focus: {} },
    { onFocus: (__VLS_ctx.loadBankCatalog) });
const __VLS_167 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (__VLS_ctx.onBankChange) });
// @ts-ignore
[form, bankSearch, bankItems, bankLoading, loadBankCatalog, onBankChange,];
var __VLS_163;
var __VLS_158;
const __VLS_169 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    cols: "6",
    md: "3",
}));
const __VLS_171 = __VLS_170({
    cols: "6",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
const { default: __VLS_173 } = __VLS_172.slots;
const __VLS_174 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_175 = __VLS_asFunctionalComponent(__VLS_174, new __VLS_174({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.agencia),
    label: "Agência",
    required: true,
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) || 'Obrigatório',
    ]),
}));
const __VLS_176 = __VLS_175({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.agencia),
    label: "Agência",
    required: true,
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) || 'Obrigatório',
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_175));
let __VLS_178;
let __VLS_179;
const __VLS_180 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.form.agencia = __VLS_ctx.onlyDigits(String(__VLS_ctx.form.agencia || ''));
            // @ts-ignore
            [form, form, form, onlyDigits,];
        } });
var __VLS_177;
var __VLS_172;
const __VLS_182 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
    cols: "6",
    md: "3",
}));
const __VLS_184 = __VLS_183({
    cols: "6",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_183));
const { default: __VLS_186 } = __VLS_185.slots;
const __VLS_187 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_188 = __VLS_asFunctionalComponent(__VLS_187, new __VLS_187({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.conta),
    label: "Conta",
    required: true,
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) || 'Obrigatório',
    ]),
}));
const __VLS_189 = __VLS_188({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.conta),
    label: "Conta",
    required: true,
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) || 'Obrigatório',
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_188));
let __VLS_191;
let __VLS_192;
const __VLS_193 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.form.conta = __VLS_ctx.onlyDigits(String(__VLS_ctx.form.conta || ''));
            // @ts-ignore
            [form, form, form, onlyDigits,];
        } });
var __VLS_190;
var __VLS_185;
const __VLS_195 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_196 = __VLS_asFunctionalComponent(__VLS_195, new __VLS_195({
    cols: "6",
    md: "3",
}));
const __VLS_197 = __VLS_196({
    cols: "6",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_196));
const { default: __VLS_199 } = __VLS_198.slots;
const __VLS_200 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.digito),
    label: "Dígito",
}));
const __VLS_202 = __VLS_201({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.digito),
    label: "Dígito",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
let __VLS_204;
let __VLS_205;
const __VLS_206 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.form.digito = __VLS_ctx.onlyDigits(String(__VLS_ctx.form.digito || ''));
            // @ts-ignore
            [form, form, form, onlyDigits,];
        } });
var __VLS_203;
var __VLS_198;
const __VLS_208 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
    cols: "6",
    md: "3",
}));
const __VLS_210 = __VLS_209({
    cols: "6",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_209));
const { default: __VLS_212 } = __VLS_211.slots;
const __VLS_213 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
VSelect;
// @ts-ignore
const __VLS_214 = __VLS_asFunctionalComponent(__VLS_213, new __VLS_213({
    modelValue: (__VLS_ctx.form.tipo),
    items: ([
        { title: 'Corrente', value: 'corrente' },
        { title: 'Poupança', value: 'poupanca' },
    ]),
    label: "Tipo",
}));
const __VLS_215 = __VLS_214({
    modelValue: (__VLS_ctx.form.tipo),
    items: ([
        { title: 'Corrente', value: 'corrente' },
        { title: 'Poupança', value: 'poupanca' },
    ]),
    label: "Tipo",
}, ...__VLS_functionalComponentArgsRest(__VLS_214));
// @ts-ignore
[form,];
var __VLS_211;
const __VLS_218 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_219 = __VLS_asFunctionalComponent(__VLS_218, new __VLS_218({
    cols: "12",
    md: "6",
}));
const __VLS_220 = __VLS_219({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_219));
const { default: __VLS_222 } = __VLS_221.slots;
const __VLS_223 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_224 = __VLS_asFunctionalComponent(__VLS_223, new __VLS_223({
    modelValue: (__VLS_ctx.form.is_principal),
    color: "secondary",
    hideDetails: true,
    label: "Definir como principal",
}));
const __VLS_225 = __VLS_224({
    modelValue: (__VLS_ctx.form.is_principal),
    color: "secondary",
    hideDetails: true,
    label: "Definir como principal",
}, ...__VLS_functionalComponentArgsRest(__VLS_224));
// @ts-ignore
[form,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-caption text-medium-emphasis mt-1" },
});
var __VLS_221;
const __VLS_228 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
    cols: "12",
}));
const __VLS_230 = __VLS_229({
    cols: "12",
}, ...__VLS_functionalComponentArgsRest(__VLS_229));
const { default: __VLS_232 } = __VLS_231.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center mb-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-2" },
});
const __VLS_233 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_234 = __VLS_asFunctionalComponent(__VLS_233, new __VLS_233({}));
const __VLS_235 = __VLS_234({}, ...__VLS_functionalComponentArgsRest(__VLS_234));
const __VLS_238 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_239 = __VLS_asFunctionalComponent(__VLS_238, new __VLS_238({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.bankIspb || !__VLS_ctx.bankLabel()),
    prependIcon: "mdi-plus",
    size: "small",
    variant: "text",
}));
const __VLS_240 = __VLS_239({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.bankIspb || !__VLS_ctx.bankLabel()),
    prependIcon: "mdi-plus",
    size: "small",
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_239));
let __VLS_242;
let __VLS_243;
const __VLS_244 = ({ click: {} },
    { onClick: (__VLS_ctx.addNote) });
const { default: __VLS_245 } = __VLS_241.slots;
// @ts-ignore
[bankIspb, bankLabel, addNote,];
var __VLS_241;
if (!__VLS_ctx.bankIspb) {
    // @ts-ignore
    [bankIspb,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-body-2 text-medium-emphasis" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    if (__VLS_ctx.bankNotes.length === 0) {
        // @ts-ignore
        [bankNotes,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-body-2 text-medium-emphasis" },
        });
        __VLS_asFunctionalElement(__VLS_elements.strong, __VLS_elements.strong)({});
    }
    const __VLS_246 = {}.VRadioGroup;
    /** @type {[typeof __VLS_components.VRadioGroup, typeof __VLS_components.vRadioGroup, typeof __VLS_components.VRadioGroup, typeof __VLS_components.vRadioGroup, ]} */ ;
    // @ts-ignore
    VRadioGroup;
    // @ts-ignore
    const __VLS_247 = __VLS_asFunctionalComponent(__VLS_246, new __VLS_246({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedNoteId),
        ...{ class: "mt-1" },
        hideDetails: true,
        inline: true,
    }));
    const __VLS_248 = __VLS_247({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedNoteId),
        ...{ class: "mt-1" },
        hideDetails: true,
        inline: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_247));
    let __VLS_250;
    let __VLS_251;
    const __VLS_252 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': ((v) => __VLS_ctx.setActiveNote(Number(v))) });
    const { default: __VLS_253 } = __VLS_249.slots;
    // @ts-ignore
    [selectedNoteId, setActiveNote,];
    const __VLS_254 = {}.VRow;
    /** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
    // @ts-ignore
    VRow;
    // @ts-ignore
    const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({
        dense: true,
    }));
    const __VLS_256 = __VLS_255({
        dense: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_255));
    const { default: __VLS_258 } = __VLS_257.slots;
    for (const [note] of __VLS_getVForSourceType((__VLS_ctx.bankNotes))) {
        // @ts-ignore
        [bankNotes,];
        const __VLS_259 = {}.VCol;
        /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
        // @ts-ignore
        VCol;
        // @ts-ignore
        const __VLS_260 = __VLS_asFunctionalComponent(__VLS_259, new __VLS_259({
            key: (note.id),
            cols: "12",
        }));
        const __VLS_261 = __VLS_260({
            key: (note.id),
            cols: "12",
        }, ...__VLS_functionalComponentArgsRest(__VLS_260));
        const { default: __VLS_263 } = __VLS_262.slots;
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "d-flex align-start ga-2" },
        });
        const __VLS_264 = {}.VRadio;
        /** @type {[typeof __VLS_components.VRadio, typeof __VLS_components.vRadio, ]} */ ;
        // @ts-ignore
        VRadio;
        // @ts-ignore
        const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
            'aria-label': "Selecionar descrição",
            ...{ class: "mt-3" },
            density: "comfortable",
            ripple: (false),
            value: (note.id),
        }));
        const __VLS_266 = __VLS_265({
            'aria-label': "Selecionar descrição",
            ...{ class: "mt-3" },
            density: "comfortable",
            ripple: (false),
            value: (note.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_265));
        const __VLS_269 = {}.VTextarea;
        /** @type {[typeof __VLS_components.VTextarea, typeof __VLS_components.vTextarea, ]} */ ;
        // @ts-ignore
        VTextarea;
        // @ts-ignore
        const __VLS_270 = __VLS_asFunctionalComponent(__VLS_269, new __VLS_269({
            ...{ 'onBlur': {} },
            modelValue: (note.descricao),
            autoGrow: true,
            ...{ class: (note.id !== __VLS_ctx.selectedNoteId ? 'opacity-60' : '') },
            hint: (note.is_ativa
                ? 'Esta variação está ativa e será usada por padrão.'
                : 'Para usar esta variação agora, selecione o rádio ao lado.'),
            label: (note.is_ativa ? 'Descrição (ativa)' : 'Descrição'),
            persistentHint: true,
            rows: "2",
        }));
        const __VLS_271 = __VLS_270({
            ...{ 'onBlur': {} },
            modelValue: (note.descricao),
            autoGrow: true,
            ...{ class: (note.id !== __VLS_ctx.selectedNoteId ? 'opacity-60' : '') },
            hint: (note.is_ativa
                ? 'Esta variação está ativa e será usada por padrão.'
                : 'Para usar esta variação agora, selecione o rádio ao lado.'),
            label: (note.is_ativa ? 'Descrição (ativa)' : 'Descrição'),
            persistentHint: true,
            rows: "2",
        }, ...__VLS_functionalComponentArgsRest(__VLS_270));
        let __VLS_273;
        let __VLS_274;
        const __VLS_275 = ({ blur: {} },
            { onBlur: (...[$event]) => {
                    if (!!(!__VLS_ctx.bankIspb))
                        return;
                    __VLS_ctx.updateNoteText(note);
                    // @ts-ignore
                    [selectedNoteId, updateNoteText,];
                } });
        var __VLS_272;
        var __VLS_262;
    }
    var __VLS_257;
    var __VLS_249;
}
var __VLS_231;
var __VLS_153;
var __VLS_145;
var __VLS_140;
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
            __VLS_ctx.dialog = false;
            // @ts-ignore
            [dialog,];
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
}));
const __VLS_297 = __VLS_296({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_296));
let __VLS_299;
let __VLS_300;
const __VLS_301 = ({ click: {} },
    { onClick: (__VLS_ctx.save) });
const { default: __VLS_302 } = __VLS_298.slots;
// @ts-ignore
[save,];
var __VLS_298;
var __VLS_280;
var __VLS_130;
var __VLS_125;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-start']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            clienteId: clienteId,
            cliente: cliente,
            loading: loading,
            error: error,
            bankItems: bankItems,
            bankSearch: bankSearch,
            bankLoading: bankLoading,
            bankIspb: bankIspb,
            bankNotes: bankNotes,
            selectedNoteId: selectedNoteId,
            search: search,
            page: page,
            itemsPerPage: itemsPerPage,
            sortBy: sortBy,
            dialog: dialog,
            editing: editing,
            form: form,
            onlyDigits: onlyDigits,
            bankLabel: bankLabel,
            openCreate: openCreate,
            openEdit: openEdit,
            onBankChange: onBankChange,
            loadBankCatalog: loadBankCatalog,
            addNote: addNote,
            setActiveNote: setActiveNote,
            updateNoteText: updateNoteText,
            save: save,
            remove: remove,
            makePrincipal: makePrincipal,
            goBack: goBack,
            headers: headers,
            contasDoCliente: contasDoCliente,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
