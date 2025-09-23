import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useClientesStore, } from '@/stores/clientes';
const store = useClientesStore();
const router = useRouter();
// UI state (lista)
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref([
    { key: 'nome_completo', order: 'asc' },
]);
// Dialog cliente
const dialog = ref(false);
const editing = ref(null);
const form = ref({});
// CEP helpers/estado
const cepLoading = ref(false);
const cepStatus = ref('');
// ==== utils locais ====
function onlyDigits(v) {
    return (v || '').replace(/\D/g, '');
}
function goContas(c) {
    router.push({ name: 'contas', params: { id: c.id } });
}
function isValidCPF(v) {
    const s = onlyDigits(v || '');
    if (s.length !== 11)
        return false;
    if (/^(\d)\1{10}$/.test(s))
        return false; // rejeita 000... 111... etc.
    // dígito 1
    let sum = 0;
    for (let i = 0; i < 9; i++)
        sum += Number.parseInt(s[i], 10) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10)
        d1 = 0;
    if (d1 !== Number.parseInt(s[9], 10))
        return false;
    // dígito 2
    sum = 0;
    for (let i = 0; i < 10; i++)
        sum += Number.parseInt(s[i], 10) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10)
        d2 = 0;
    return d2 === Number.parseInt(s[10], 10);
}
function formatCPF(v) {
    const s = onlyDigits(v).slice(0, 11);
    if (s.length <= 3)
        return s;
    if (s.length <= 6)
        return `${s.slice(0, 3)}.${s.slice(3)}`;
    if (s.length <= 9)
        return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}
// regras Vuetify
function formatCEP(v) {
    const s = onlyDigits(v).slice(0, 8);
    if (s.length <= 5)
        return s;
    return `${s.slice(0, 5)}-${s.slice(5)}`;
}
const rules = {
    cepOptional: (v) => !v || onlyDigits(v).length === 8 || 'CEP inválido',
    ufOptional: (v) => !v || /^[A-Za-z]{2}$/.test(v) || 'UF inválida',
    cpfRequired: (v) => (v && isValidCPF(v)) || 'CPF inválido',
};
const fieldErrors = ref({});
// ==== CEP lookup (ViaCEP) ====
async function lookupCEP() {
    const raw = form.value.cep || '';
    const s = onlyDigits(raw);
    cepStatus.value = '';
    if (s.length !== 8) {
        form.value.cep = formatCEP(raw);
        return;
    }
    cepLoading.value = true;
    try {
        const resp = await fetch(`https://viacep.com.br/ws/${s}/json/`);
        if (!resp.ok)
            throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.erro)
            throw new Error('CEP não encontrado');
        form.value.logradouro = data.logradouro || form.value.logradouro || '';
        form.value.bairro = data.bairro || form.value.bairro || '';
        form.value.cidade = data.localidade || form.value.cidade || '';
        form.value.uf = data.uf || form.value.uf || '';
        cepStatus.value = 'Endereço preenchido pelo CEP.';
    }
    catch {
        cepStatus.value = 'Não foi possível consultar o CEP. Preencha manualmente.';
    }
    finally {
        cepLoading.value = false;
        form.value.cep = formatCEP(raw);
    }
}
// helpers de formulário
function resetForm() {
    form.value = {
        nome_completo: '',
        // qualificacao: '', // 🔕 oculto no UI; mantido no back
        cpf: '',
        rg: '',
        orgao_expedidor: '',
        // novos sinalizadores (apenas no cliente)
        se_idoso: false,
        se_incapaz: false,
        se_crianca_adolescente: false,
        // dados civis
        nacionalidade: '',
        estado_civil: '',
        profissao: '',
        // endereço
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        uf: '',
    };
    cepStatus.value = '';
    fieldErrors.value = {};
}
function openCreate() {
    editing.value = null;
    resetForm();
    dialog.value = true;
}
async function openEdit(c) {
    editing.value = c;
    form.value = { ...c };
    cepStatus.value = '';
    fieldErrors.value = {};
    dialog.value = true;
    // carrega representantes desse cliente
    try {
        await store.fetchRepresentantes(c.id, { force: true });
    }
    catch {
        /* erro tratado via store */
    }
}
async function save() {
    fieldErrors.value = {};
    try {
        if (!form.value.nome_completo || !String(form.value.nome_completo).trim()) {
            throw new Error('Informe o nome completo.');
        }
        const payload = { ...form.value };
        if (payload.cpf)
            payload.cpf = onlyDigits(payload.cpf);
        if (payload.cep)
            payload.cep = onlyDigits(payload.cep);
        if (payload.uf)
            payload.uf = String(payload.uf).toUpperCase();
        // (Se em algum momento o form voltar a carregar reps embutidos, sanitizar aqui.)
        await (editing.value
            ? store.update(editing.value.id, payload)
            : store.create(payload));
        dialog.value = false;
    }
    catch (error) {
        if (error?.response?.status === 400
            && error.response?.data
            && typeof error.response.data === 'object') {
            fieldErrors.value = error.response.data;
            store.error = '';
            return;
        }
        store.error
            = error?.response?.data?.detail || error?.message || 'Erro ao salvar.';
    }
}
async function remove(c) {
    if (!confirm(`Excluir o cliente "${c.nome_completo}"?`))
        return;
    try {
        await store.remove(c.id);
    }
    catch (error) {
        store.error = error?.response?.data?.detail || 'Não foi possível excluir.';
    }
}
function formatDate(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleDateString('pt-BR');
    }
    catch {
        return iso;
    }
}
// headers simples
const headers = [
    { title: 'Nome', key: 'nome_completo' },
    { title: 'CPF', key: 'cpf' },
    { title: 'Cidade', key: 'cidade' },
    { title: 'UF', key: 'uf' },
    { title: 'Criado em', key: 'criado_em', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];
onMounted(() => {
    store.fetchList({ page: 1, page_size: 1000, ordering: 'nome_completo' });
});
// =========================
// Representantes (UI)
// =========================
const repsDialog = ref(false);
const repsEditing = ref(null);
const repsForm = ref({});
const repsFieldErrors = ref({});
function copyEnderecoClienteToRepForm() {
    if (!editing.value || !repsForm.value)
        return;
    // copia do form atual do cliente (não do server), mantendo editável
    repsForm.value.cep = form.value.cep || '';
    repsForm.value.logradouro = form.value.logradouro || '';
    repsForm.value.numero = form.value.numero || '';
    repsForm.value.bairro = form.value.bairro || '';
    repsForm.value.cidade = form.value.cidade || '';
    repsForm.value.uf = (form.value.uf || '').toUpperCase();
}
function openRepCreate() {
    if (!editing.value)
        return;
    repsEditing.value = null;
    repsFieldErrors.value = {};
    repsForm.value = {
        cliente: editing.value.id,
        nome_completo: '',
        cpf: '',
        rg: '',
        orgao_expedidor: '',
        // civis
        nacionalidade: '',
        estado_civil: '',
        profissao: '',
        // endereço
        usa_endereco_do_cliente: true, // default esperto 😉
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        uf: '',
    };
    // pré-preenche endereço se o toggle começar ligado
    if (repsForm.value.usa_endereco_do_cliente) {
        copyEnderecoClienteToRepForm();
    }
    repsDialog.value = true;
}
function openRepEdit(r) {
    repsEditing.value = r;
    repsFieldErrors.value = {};
    repsForm.value = { ...r };
    // se a flag vier ligada, reflete no formulário local
    if (repsForm.value.usa_endereco_do_cliente) {
        copyEnderecoClienteToRepForm();
    }
    repsDialog.value = true;
}
// quando o usuário ligar/desligar o toggle na UI do representante (dialog),
// sincronizamos os campos locais se ligar.
watch(() => repsForm.value.usa_endereco_do_cliente, val => {
    if (val)
        copyEnderecoClienteToRepForm();
});
async function saveRep() {
    repsFieldErrors.value = {};
    try {
        if (!repsForm.value.nome_completo
            || !String(repsForm.value.nome_completo).trim()) {
            throw new Error('Informe o nome do representante.');
        }
        if (!editing.value)
            throw new Error('Salve o cliente antes de cadastrar representantes.');
        const payload = { ...repsForm.value };
        // sanitização básica
        if (payload.cpf)
            payload.cpf = onlyDigits(payload.cpf);
        if (payload.cep)
            payload.cep = onlyDigits(payload.cep);
        if (payload.uf)
            payload.uf = String(payload.uf).toUpperCase();
        // garante vínculo
        payload.cliente = editing.value.id;
        // nunca enviar flags de "situação especial" para reps
        delete payload.se_idoso;
        delete payload.se_incapaz;
        delete payload.se_crianca_adolescente;
        await (repsEditing.value
            ? store.updateRepresentante(repsEditing.value.id, payload, editing.value.id)
            : store.createRepresentante(payload));
        repsDialog.value = false;
    }
    catch (error) {
        if (error?.response?.status === 400
            && error.response?.data
            && typeof error.response.data === 'object') {
            repsFieldErrors.value = error.response.data;
            return;
        }
        store.repsErrorByCliente[editing.value?.id || 0]
            = error?.response?.data?.detail
                || error?.message
                || 'Erro ao salvar representante.';
    }
}
async function removeRep(r) {
    if (!editing.value)
        return;
    if (!confirm(`Excluir o representante "${r.nome_completo}"?`))
        return;
    try {
        await store.removeRepresentante(r.id, editing.value.id);
    }
    catch (error) {
        store.repsErrorByCliente[editing.value.id]
            = error?.response?.data?.detail
                || 'Não foi possível excluir representante.';
    }
}
// ação opcional (server) para copiar endereço do cliente em reps JÁ salvos
async function usarEnderecoDoCliente(r) {
    if (!editing.value)
        return;
    try {
        await store.usarEnderecoDoClienteNoRepresentante(r.id, editing.value.id);
        // refresh leve
        await store.fetchRepresentantes(editing.value.id, { force: true });
    }
    catch (error) {
        store.repsErrorByCliente[editing.value.id]
            = error?.response?.data?.detail || 'Não foi possível copiar endereço.';
    }
}
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
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_8 = __VLS_7({
    ...{ class: "rounded-xl" },
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
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
const __VLS_16 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({}));
const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_21 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}));
const __VLS_23 = __VLS_22({
    modelValue: (__VLS_ctx.search),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    label: "Buscar",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
// @ts-ignore
[search,];
const __VLS_26 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    ...{ 'onClick': {} },
    ...{ class: "ml-2" },
    color: "primary",
}));
const __VLS_28 = __VLS_27({
    ...{ 'onClick': {} },
    ...{ class: "ml-2" },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
let __VLS_30;
let __VLS_31;
const __VLS_32 = ({ click: {} },
    { onClick: (__VLS_ctx.openCreate) });
const { default: __VLS_33 } = __VLS_29.slots;
// @ts-ignore
[openCreate,];
const __VLS_34 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    icon: "mdi-account-plus",
    start: true,
}));
const __VLS_36 = __VLS_35({
    icon: "mdi-account-plus",
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
var __VLS_29;
var __VLS_14;
const __VLS_39 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent(__VLS_39, new __VLS_39({}));
const __VLS_41 = __VLS_40({}, ...__VLS_functionalComponentArgsRest(__VLS_40));
const { default: __VLS_43 } = __VLS_42.slots;
if (__VLS_ctx.store.hasError) {
    // @ts-ignore
    [store,];
    const __VLS_44 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }));
    const __VLS_46 = __VLS_45({
        ...{ class: "mb-4" },
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    const { default: __VLS_48 } = __VLS_47.slots;
    (__VLS_ctx.store.error);
    // @ts-ignore
    [store,];
    var __VLS_47;
}
const __VLS_49 = {}.VDataTable;
/** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
// @ts-ignore
VDataTable;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.store.items),
    loading: (__VLS_ctx.store.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}));
const __VLS_51 = __VLS_50({
    itemsPerPage: (__VLS_ctx.itemsPerPage),
    page: (__VLS_ctx.page),
    sortBy: (__VLS_ctx.sortBy),
    ...{ class: "rounded-lg" },
    headers: (__VLS_ctx.headers),
    itemKey: "id",
    items: (__VLS_ctx.store.items),
    loading: (__VLS_ctx.store.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const { default: __VLS_53 } = __VLS_52.slots;
// @ts-ignore
[search, store, store, itemsPerPage, page, sortBy, headers,];
{
    const { 'item.criado_em': __VLS_54 } = __VLS_52.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_54);
    (__VLS_ctx.formatDate(item.criado_em));
    // @ts-ignore
    [formatDate,];
}
{
    const { 'item.actions': __VLS_55 } = __VLS_52.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_55);
    const __VLS_56 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_60;
    let __VLS_61;
    const __VLS_62 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openEdit(item);
                // @ts-ignore
                [openEdit,];
            } });
    const { default: __VLS_63 } = __VLS_59.slots;
    const __VLS_64 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        icon: "mdi-pencil",
    }));
    const __VLS_66 = __VLS_65({
        icon: "mdi-pencil",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    var __VLS_59;
    const __VLS_69 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_71 = __VLS_70({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.remove(item);
                // @ts-ignore
                [remove,];
            } });
    const { default: __VLS_76 } = __VLS_72.slots;
    const __VLS_77 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        icon: "mdi-delete",
    }));
    const __VLS_79 = __VLS_78({
        icon: "mdi-delete",
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    var __VLS_72;
    const __VLS_82 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
        ...{ 'onClick': {} },
        color: "indigo",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_84 = __VLS_83({
        ...{ 'onClick': {} },
        color: "indigo",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    let __VLS_86;
    let __VLS_87;
    const __VLS_88 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.goContas(item);
                // @ts-ignore
                [goContas,];
            } });
    const { default: __VLS_89 } = __VLS_85.slots;
    const __VLS_90 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
        icon: "mdi-bank",
    }));
    const __VLS_92 = __VLS_91({
        icon: "mdi-bank",
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    var __VLS_85;
}
{
    const { 'no-data': __VLS_95 } = __VLS_52.slots;
    const __VLS_96 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_98 = __VLS_97({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    const { default: __VLS_100 } = __VLS_99.slots;
    var __VLS_99;
}
var __VLS_52;
var __VLS_42;
var __VLS_9;
const __VLS_101 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "980",
}));
const __VLS_103 = __VLS_102({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "980",
}, ...__VLS_functionalComponentArgsRest(__VLS_102));
const { default: __VLS_105 } = __VLS_104.slots;
// @ts-ignore
[dialog,];
const __VLS_106 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({}));
const __VLS_108 = __VLS_107({}, ...__VLS_functionalComponentArgsRest(__VLS_107));
const { default: __VLS_110 } = __VLS_109.slots;
const __VLS_111 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({}));
const __VLS_113 = __VLS_112({}, ...__VLS_functionalComponentArgsRest(__VLS_112));
const { default: __VLS_115 } = __VLS_114.slots;
(__VLS_ctx.editing ? "Editar cliente" : "Novo cliente");
// @ts-ignore
[editing,];
var __VLS_114;
const __VLS_116 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({}));
const __VLS_118 = __VLS_117({}, ...__VLS_functionalComponentArgsRest(__VLS_117));
const { default: __VLS_120 } = __VLS_119.slots;
const __VLS_121 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_122 = __VLS_asFunctionalComponent(__VLS_121, new __VLS_121({
    ...{ 'onSubmit': {} },
}));
const __VLS_123 = __VLS_122({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_122));
let __VLS_125;
let __VLS_126;
const __VLS_127 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.save) });
const { default: __VLS_128 } = __VLS_124.slots;
// @ts-ignore
[save,];
const __VLS_129 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
    dense: true,
}));
const __VLS_131 = __VLS_130({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_130));
const { default: __VLS_133 } = __VLS_132.slots;
const __VLS_134 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
    cols: "12",
    md: "8",
}));
const __VLS_136 = __VLS_135({
    cols: "12",
    md: "8",
}, ...__VLS_functionalComponentArgsRest(__VLS_135));
const { default: __VLS_138 } = __VLS_137.slots;
const __VLS_139 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({
    modelValue: (__VLS_ctx.form.nome_completo),
    errorMessages: (__VLS_ctx.fieldErrors.nome_completo),
    label: "Nome completo",
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) ||
            'Nome é obrigatório',
    ]),
}));
const __VLS_141 = __VLS_140({
    modelValue: (__VLS_ctx.form.nome_completo),
    errorMessages: (__VLS_ctx.fieldErrors.nome_completo),
    label: "Nome completo",
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) ||
            'Nome é obrigatório',
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_140));
// @ts-ignore
[form, fieldErrors,];
var __VLS_137;
const __VLS_144 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    cols: "12",
    md: "4",
}));
const __VLS_146 = __VLS_145({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
const { default: __VLS_148 } = __VLS_147.slots;
const __VLS_149 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_150 = __VLS_asFunctionalComponent(__VLS_149, new __VLS_149({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.cpf),
    errorMessages: (__VLS_ctx.fieldErrors.cpf),
    label: "CPF",
    rules: ([__VLS_ctx.rules.cpfRequired]),
}));
const __VLS_151 = __VLS_150({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.cpf),
    errorMessages: (__VLS_ctx.fieldErrors.cpf),
    label: "CPF",
    rules: ([__VLS_ctx.rules.cpfRequired]),
}, ...__VLS_functionalComponentArgsRest(__VLS_150));
let __VLS_153;
let __VLS_154;
const __VLS_155 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.form.cpf = __VLS_ctx.formatCPF(__VLS_ctx.form.cpf || '');
            // @ts-ignore
            [form, form, form, fieldErrors, rules, formatCPF,];
        } });
var __VLS_152;
var __VLS_147;
const __VLS_157 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    cols: "12",
    md: "4",
}));
const __VLS_159 = __VLS_158({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
const { default: __VLS_161 } = __VLS_160.slots;
const __VLS_162 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    modelValue: (__VLS_ctx.form.rg),
    label: "RG",
}));
const __VLS_164 = __VLS_163({
    modelValue: (__VLS_ctx.form.rg),
    label: "RG",
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
// @ts-ignore
[form,];
var __VLS_160;
const __VLS_167 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_168 = __VLS_asFunctionalComponent(__VLS_167, new __VLS_167({
    cols: "12",
    md: "4",
}));
const __VLS_169 = __VLS_168({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_168));
const { default: __VLS_171 } = __VLS_170.slots;
const __VLS_172 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
    modelValue: (__VLS_ctx.form.orgao_expedidor),
    label: "Órgão expedidor",
}));
const __VLS_174 = __VLS_173({
    modelValue: (__VLS_ctx.form.orgao_expedidor),
    label: "Órgão expedidor",
}, ...__VLS_functionalComponentArgsRest(__VLS_173));
// @ts-ignore
[form,];
var __VLS_170;
const __VLS_177 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
    cols: "12",
    md: "4",
}));
const __VLS_179 = __VLS_178({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_178));
const { default: __VLS_181 } = __VLS_180.slots;
const __VLS_182 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
    modelValue: (__VLS_ctx.form.nacionalidade),
    label: "Nacionalidade",
}));
const __VLS_184 = __VLS_183({
    modelValue: (__VLS_ctx.form.nacionalidade),
    label: "Nacionalidade",
}, ...__VLS_functionalComponentArgsRest(__VLS_183));
// @ts-ignore
[form,];
var __VLS_180;
const __VLS_187 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_188 = __VLS_asFunctionalComponent(__VLS_187, new __VLS_187({
    cols: "12",
    md: "6",
}));
const __VLS_189 = __VLS_188({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_188));
const { default: __VLS_191 } = __VLS_190.slots;
const __VLS_192 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.form.estado_civil),
    label: "Estado civil",
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.form.estado_civil),
    label: "Estado civil",
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
// @ts-ignore
[form,];
var __VLS_190;
const __VLS_197 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_198 = __VLS_asFunctionalComponent(__VLS_197, new __VLS_197({
    cols: "12",
    md: "6",
}));
const __VLS_199 = __VLS_198({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_198));
const { default: __VLS_201 } = __VLS_200.slots;
const __VLS_202 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
    modelValue: (__VLS_ctx.form.profissao),
    label: "Profissão",
}));
const __VLS_204 = __VLS_203({
    modelValue: (__VLS_ctx.form.profissao),
    label: "Profissão",
}, ...__VLS_functionalComponentArgsRest(__VLS_203));
// @ts-ignore
[form,];
var __VLS_200;
const __VLS_207 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_208 = __VLS_asFunctionalComponent(__VLS_207, new __VLS_207({
    cols: "12",
    md: "4",
}));
const __VLS_209 = __VLS_208({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_208));
const { default: __VLS_211 } = __VLS_210.slots;
const __VLS_212 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    modelValue: (__VLS_ctx.form.se_idoso),
    color: "secondary",
    hideDetails: true,
    label: "Idoso?",
}));
const __VLS_214 = __VLS_213({
    modelValue: (__VLS_ctx.form.se_idoso),
    color: "secondary",
    hideDetails: true,
    label: "Idoso?",
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
// @ts-ignore
[form,];
var __VLS_210;
const __VLS_217 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
    cols: "12",
    md: "4",
}));
const __VLS_219 = __VLS_218({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_218));
const { default: __VLS_221 } = __VLS_220.slots;
const __VLS_222 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_223 = __VLS_asFunctionalComponent(__VLS_222, new __VLS_222({
    modelValue: (__VLS_ctx.form.se_incapaz),
    color: "secondary",
    hideDetails: true,
    label: "Incapaz?",
}));
const __VLS_224 = __VLS_223({
    modelValue: (__VLS_ctx.form.se_incapaz),
    color: "secondary",
    hideDetails: true,
    label: "Incapaz?",
}, ...__VLS_functionalComponentArgsRest(__VLS_223));
// @ts-ignore
[form,];
var __VLS_220;
const __VLS_227 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_228 = __VLS_asFunctionalComponent(__VLS_227, new __VLS_227({
    cols: "12",
    md: "4",
}));
const __VLS_229 = __VLS_228({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_228));
const { default: __VLS_231 } = __VLS_230.slots;
const __VLS_232 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    modelValue: (__VLS_ctx.form.se_crianca_adolescente),
    color: "secondary",
    hideDetails: true,
    label: "Criança/Adolescente?",
}));
const __VLS_234 = __VLS_233({
    modelValue: (__VLS_ctx.form.se_crianca_adolescente),
    color: "secondary",
    hideDetails: true,
    label: "Criança/Adolescente?",
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
// @ts-ignore
[form,];
var __VLS_230;
const __VLS_237 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_238 = __VLS_asFunctionalComponent(__VLS_237, new __VLS_237({
    cols: "12",
    md: "3",
}));
const __VLS_239 = __VLS_238({
    cols: "12",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_238));
const { default: __VLS_241 } = __VLS_240.slots;
const __VLS_242 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_243 = __VLS_asFunctionalComponent(__VLS_242, new __VLS_242({
    ...{ 'onBlur': {} },
    ...{ 'onClick:appendInner': {} },
    modelValue: (__VLS_ctx.form.cep),
    appendInnerIcon: "mdi-magnify",
    label: "CEP",
    loading: (__VLS_ctx.cepLoading),
    prependInnerIcon: "mdi-map-search",
    rules: ([__VLS_ctx.rules.cepOptional]),
}));
const __VLS_244 = __VLS_243({
    ...{ 'onBlur': {} },
    ...{ 'onClick:appendInner': {} },
    modelValue: (__VLS_ctx.form.cep),
    appendInnerIcon: "mdi-magnify",
    label: "CEP",
    loading: (__VLS_ctx.cepLoading),
    prependInnerIcon: "mdi-map-search",
    rules: ([__VLS_ctx.rules.cepOptional]),
}, ...__VLS_functionalComponentArgsRest(__VLS_243));
let __VLS_246;
let __VLS_247;
const __VLS_248 = ({ blur: {} },
    { onBlur: (__VLS_ctx.lookupCEP) });
const __VLS_249 = ({ 'click:appendInner': {} },
    { 'onClick:appendInner': (__VLS_ctx.lookupCEP) });
// @ts-ignore
[form, rules, cepLoading, lookupCEP, lookupCEP,];
var __VLS_245;
if (__VLS_ctx.cepStatus) {
    // @ts-ignore
    [cepStatus,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption text-medium-emphasis mt-1" },
    });
    (__VLS_ctx.cepStatus);
    // @ts-ignore
    [cepStatus,];
}
var __VLS_240;
const __VLS_251 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_252 = __VLS_asFunctionalComponent(__VLS_251, new __VLS_251({
    cols: "12",
    md: "5",
}));
const __VLS_253 = __VLS_252({
    cols: "12",
    md: "5",
}, ...__VLS_functionalComponentArgsRest(__VLS_252));
const { default: __VLS_255 } = __VLS_254.slots;
const __VLS_256 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
    modelValue: (__VLS_ctx.form.logradouro),
    label: "Logradouro",
}));
const __VLS_258 = __VLS_257({
    modelValue: (__VLS_ctx.form.logradouro),
    label: "Logradouro",
}, ...__VLS_functionalComponentArgsRest(__VLS_257));
// @ts-ignore
[form,];
var __VLS_254;
const __VLS_261 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_262 = __VLS_asFunctionalComponent(__VLS_261, new __VLS_261({
    cols: "12",
    md: "4",
}));
const __VLS_263 = __VLS_262({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_262));
const { default: __VLS_265 } = __VLS_264.slots;
const __VLS_266 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_267 = __VLS_asFunctionalComponent(__VLS_266, new __VLS_266({
    modelValue: (__VLS_ctx.form.numero),
    label: "Número",
}));
const __VLS_268 = __VLS_267({
    modelValue: (__VLS_ctx.form.numero),
    label: "Número",
}, ...__VLS_functionalComponentArgsRest(__VLS_267));
// @ts-ignore
[form,];
var __VLS_264;
const __VLS_271 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_272 = __VLS_asFunctionalComponent(__VLS_271, new __VLS_271({
    cols: "12",
    md: "6",
}));
const __VLS_273 = __VLS_272({
    cols: "12",
    md: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_272));
const { default: __VLS_275 } = __VLS_274.slots;
const __VLS_276 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
    modelValue: (__VLS_ctx.form.bairro),
    label: "Bairro",
}));
const __VLS_278 = __VLS_277({
    modelValue: (__VLS_ctx.form.bairro),
    label: "Bairro",
}, ...__VLS_functionalComponentArgsRest(__VLS_277));
// @ts-ignore
[form,];
var __VLS_274;
const __VLS_281 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_282 = __VLS_asFunctionalComponent(__VLS_281, new __VLS_281({
    cols: "12",
    md: "4",
}));
const __VLS_283 = __VLS_282({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_282));
const { default: __VLS_285 } = __VLS_284.slots;
const __VLS_286 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_287 = __VLS_asFunctionalComponent(__VLS_286, new __VLS_286({
    modelValue: (__VLS_ctx.form.cidade),
    label: "Cidade",
}));
const __VLS_288 = __VLS_287({
    modelValue: (__VLS_ctx.form.cidade),
    label: "Cidade",
}, ...__VLS_functionalComponentArgsRest(__VLS_287));
// @ts-ignore
[form,];
var __VLS_284;
const __VLS_291 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_292 = __VLS_asFunctionalComponent(__VLS_291, new __VLS_291({
    cols: "12",
    md: "2",
}));
const __VLS_293 = __VLS_292({
    cols: "12",
    md: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_292));
const { default: __VLS_295 } = __VLS_294.slots;
const __VLS_296 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.uf),
    label: "UF",
    maxlength: "2",
    rules: ([__VLS_ctx.rules.ufOptional]),
}));
const __VLS_298 = __VLS_297({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.form.uf),
    label: "UF",
    maxlength: "2",
    rules: ([__VLS_ctx.rules.ufOptional]),
}, ...__VLS_functionalComponentArgsRest(__VLS_297));
let __VLS_300;
let __VLS_301;
const __VLS_302 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.form.uf = (__VLS_ctx.form.uf || '').toUpperCase();
            // @ts-ignore
            [form, form, form, rules,];
        } });
var __VLS_299;
var __VLS_294;
var __VLS_132;
var __VLS_124;
const __VLS_304 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
VDivider;
// @ts-ignore
const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
    ...{ class: "my-4" },
}));
const __VLS_306 = __VLS_305({
    ...{ class: "my-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_305));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center justify-space-between mb-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-2" },
});
if (__VLS_ctx.editing) {
    // @ts-ignore
    [editing,];
    const __VLS_309 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_310 = __VLS_asFunctionalComponent(__VLS_309, new __VLS_309({
        ...{ 'onClick': {} },
        color: "primary",
        prependIcon: "mdi-account-plus",
    }));
    const __VLS_311 = __VLS_310({
        ...{ 'onClick': {} },
        color: "primary",
        prependIcon: "mdi-account-plus",
    }, ...__VLS_functionalComponentArgsRest(__VLS_310));
    let __VLS_313;
    let __VLS_314;
    const __VLS_315 = ({ click: {} },
        { onClick: (__VLS_ctx.openRepCreate) });
    const { default: __VLS_316 } = __VLS_312.slots;
    // @ts-ignore
    [openRepCreate,];
    var __VLS_312;
}
if (!__VLS_ctx.editing) {
    // @ts-ignore
    [editing,];
    const __VLS_317 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_318 = __VLS_asFunctionalComponent(__VLS_317, new __VLS_317({
        ...{ class: "mb-2" },
        type: "info",
        variant: "tonal",
    }));
    const __VLS_319 = __VLS_318({
        ...{ class: "mb-2" },
        type: "info",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_318));
    const { default: __VLS_321 } = __VLS_320.slots;
    var __VLS_320;
}
else if (__VLS_ctx.store.repsErrorByCliente[__VLS_ctx.editing.id]) {
    // @ts-ignore
    [store, editing,];
    const __VLS_322 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_323 = __VLS_asFunctionalComponent(__VLS_322, new __VLS_322({
        ...{ class: "mb-2" },
        type: "error",
        variant: "tonal",
    }));
    const __VLS_324 = __VLS_323({
        ...{ class: "mb-2" },
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_323));
    const { default: __VLS_326 } = __VLS_325.slots;
    (__VLS_ctx.store.repsErrorByCliente[__VLS_ctx.editing.id]);
    // @ts-ignore
    [store, editing,];
    var __VLS_325;
}
if (__VLS_ctx.editing) {
    // @ts-ignore
    [editing,];
    if (__VLS_ctx.store.representantesDoCliente(__VLS_ctx.editing.id).length > 0) {
        // @ts-ignore
        [store, editing,];
        const __VLS_327 = {}.VTable;
        /** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
        // @ts-ignore
        VTable;
        // @ts-ignore
        const __VLS_328 = __VLS_asFunctionalComponent(__VLS_327, new __VLS_327({
            density: "comfortable",
        }));
        const __VLS_329 = __VLS_328({
            density: "comfortable",
        }, ...__VLS_functionalComponentArgsRest(__VLS_328));
        const { default: __VLS_331 } = __VLS_330.slots;
        __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
        for (const [r] of __VLS_getVForSourceType((__VLS_ctx.store.representantesDoCliente(__VLS_ctx.editing.id)))) {
            // @ts-ignore
            [store, editing,];
            __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
                key: (r.id),
            });
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            (r.nome_completo);
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            (r.cpf);
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            if (r.usa_endereco_do_cliente) {
                const __VLS_332 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                VChip;
                // @ts-ignore
                const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
                    ...{ class: "mr-1" },
                    color: "secondary",
                    size: "small",
                    title: "Usando endereço do cliente",
                }));
                const __VLS_334 = __VLS_333({
                    ...{ class: "mr-1" },
                    color: "secondary",
                    size: "small",
                    title: "Usando endereço do cliente",
                }, ...__VLS_functionalComponentArgsRest(__VLS_333));
                const { default: __VLS_336 } = __VLS_335.slots;
                var __VLS_335;
            }
            else {
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
                ([r.logradouro, r.numero].filter(Boolean).join(", "));
                if (r.bairro) {
                    (r.bairro);
                }
                if (r.cidade || r.uf) {
                    ([r.cidade, (r.uf || "").toUpperCase()]
                        .filter(Boolean)
                        .join("/"));
                }
            }
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            if (r.se_idoso) {
                const __VLS_337 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                VChip;
                // @ts-ignore
                const __VLS_338 = __VLS_asFunctionalComponent(__VLS_337, new __VLS_337({
                    ...{ class: "mr-1" },
                    size: "x-small",
                }));
                const __VLS_339 = __VLS_338({
                    ...{ class: "mr-1" },
                    size: "x-small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_338));
                const { default: __VLS_341 } = __VLS_340.slots;
                var __VLS_340;
            }
            if (r.se_incapaz) {
                const __VLS_342 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                VChip;
                // @ts-ignore
                const __VLS_343 = __VLS_asFunctionalComponent(__VLS_342, new __VLS_342({
                    ...{ class: "mr-1" },
                    size: "x-small",
                }));
                const __VLS_344 = __VLS_343({
                    ...{ class: "mr-1" },
                    size: "x-small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_343));
                const { default: __VLS_346 } = __VLS_345.slots;
                var __VLS_345;
            }
            if (r.se_crianca_adolescente) {
                const __VLS_347 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                VChip;
                // @ts-ignore
                const __VLS_348 = __VLS_asFunctionalComponent(__VLS_347, new __VLS_347({
                    size: "x-small",
                }));
                const __VLS_349 = __VLS_348({
                    size: "x-small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_348));
                const { default: __VLS_351 } = __VLS_350.slots;
                var __VLS_350;
            }
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                ...{ class: "text-right" },
            });
            const __VLS_352 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            VBtn;
            // @ts-ignore
            const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
                ...{ 'onClick': {} },
                icon: true,
                size: "small",
                title: ('Usar endereço do cliente'),
                variant: "text",
            }));
            const __VLS_354 = __VLS_353({
                ...{ 'onClick': {} },
                icon: true,
                size: "small",
                title: ('Usar endereço do cliente'),
                variant: "text",
            }, ...__VLS_functionalComponentArgsRest(__VLS_353));
            let __VLS_356;
            let __VLS_357;
            const __VLS_358 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(__VLS_ctx.editing))
                            return;
                        if (!(__VLS_ctx.store.representantesDoCliente(__VLS_ctx.editing.id).length > 0))
                            return;
                        __VLS_ctx.usarEnderecoDoCliente(r);
                        // @ts-ignore
                        [usarEnderecoDoCliente,];
                    } });
            const { default: __VLS_359 } = __VLS_355.slots;
            const __VLS_360 = {}.VIcon;
            /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
            // @ts-ignore
            VIcon;
            // @ts-ignore
            const __VLS_361 = __VLS_asFunctionalComponent(__VLS_360, new __VLS_360({
                icon: "mdi-home-account",
            }));
            const __VLS_362 = __VLS_361({
                icon: "mdi-home-account",
            }, ...__VLS_functionalComponentArgsRest(__VLS_361));
            var __VLS_355;
            const __VLS_365 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            VBtn;
            // @ts-ignore
            const __VLS_366 = __VLS_asFunctionalComponent(__VLS_365, new __VLS_365({
                ...{ 'onClick': {} },
                icon: true,
                size: "small",
                title: "Editar",
                variant: "text",
            }));
            const __VLS_367 = __VLS_366({
                ...{ 'onClick': {} },
                icon: true,
                size: "small",
                title: "Editar",
                variant: "text",
            }, ...__VLS_functionalComponentArgsRest(__VLS_366));
            let __VLS_369;
            let __VLS_370;
            const __VLS_371 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(__VLS_ctx.editing))
                            return;
                        if (!(__VLS_ctx.store.representantesDoCliente(__VLS_ctx.editing.id).length > 0))
                            return;
                        __VLS_ctx.openRepEdit(r);
                        // @ts-ignore
                        [openRepEdit,];
                    } });
            const { default: __VLS_372 } = __VLS_368.slots;
            const __VLS_373 = {}.VIcon;
            /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
            // @ts-ignore
            VIcon;
            // @ts-ignore
            const __VLS_374 = __VLS_asFunctionalComponent(__VLS_373, new __VLS_373({
                icon: "mdi-pencil",
            }));
            const __VLS_375 = __VLS_374({
                icon: "mdi-pencil",
            }, ...__VLS_functionalComponentArgsRest(__VLS_374));
            var __VLS_368;
            const __VLS_378 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            VBtn;
            // @ts-ignore
            const __VLS_379 = __VLS_asFunctionalComponent(__VLS_378, new __VLS_378({
                ...{ 'onClick': {} },
                color: "error",
                icon: true,
                size: "small",
                title: "Excluir",
                variant: "text",
            }));
            const __VLS_380 = __VLS_379({
                ...{ 'onClick': {} },
                color: "error",
                icon: true,
                size: "small",
                title: "Excluir",
                variant: "text",
            }, ...__VLS_functionalComponentArgsRest(__VLS_379));
            let __VLS_382;
            let __VLS_383;
            const __VLS_384 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!(__VLS_ctx.editing))
                            return;
                        if (!(__VLS_ctx.store.representantesDoCliente(__VLS_ctx.editing.id).length > 0))
                            return;
                        __VLS_ctx.removeRep(r);
                        // @ts-ignore
                        [removeRep,];
                    } });
            const { default: __VLS_385 } = __VLS_381.slots;
            const __VLS_386 = {}.VIcon;
            /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
            // @ts-ignore
            VIcon;
            // @ts-ignore
            const __VLS_387 = __VLS_asFunctionalComponent(__VLS_386, new __VLS_386({
                icon: "mdi-delete",
            }));
            const __VLS_388 = __VLS_387({
                icon: "mdi-delete",
            }, ...__VLS_functionalComponentArgsRest(__VLS_387));
            var __VLS_381;
        }
        var __VLS_330;
    }
    else {
        const __VLS_391 = {}.VAlert;
        /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
        // @ts-ignore
        VAlert;
        // @ts-ignore
        const __VLS_392 = __VLS_asFunctionalComponent(__VLS_391, new __VLS_391({
            type: "info",
            variant: "tonal",
        }));
        const __VLS_393 = __VLS_392({
            type: "info",
            variant: "tonal",
        }, ...__VLS_functionalComponentArgsRest(__VLS_392));
        const { default: __VLS_395 } = __VLS_394.slots;
        var __VLS_394;
    }
}
var __VLS_119;
const __VLS_396 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({}));
const __VLS_398 = __VLS_397({}, ...__VLS_functionalComponentArgsRest(__VLS_397));
const { default: __VLS_400 } = __VLS_399.slots;
const __VLS_401 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_402 = __VLS_asFunctionalComponent(__VLS_401, new __VLS_401({}));
const __VLS_403 = __VLS_402({}, ...__VLS_functionalComponentArgsRest(__VLS_402));
const __VLS_406 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_407 = __VLS_asFunctionalComponent(__VLS_406, new __VLS_406({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_408 = __VLS_407({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_407));
let __VLS_410;
let __VLS_411;
const __VLS_412 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialog = false;
            // @ts-ignore
            [dialog,];
        } });
const { default: __VLS_413 } = __VLS_409.slots;
var __VLS_409;
const __VLS_414 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_415 = __VLS_asFunctionalComponent(__VLS_414, new __VLS_414({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_416 = __VLS_415({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_415));
let __VLS_418;
let __VLS_419;
const __VLS_420 = ({ click: {} },
    { onClick: (__VLS_ctx.save) });
const { default: __VLS_421 } = __VLS_417.slots;
// @ts-ignore
[save,];
var __VLS_417;
var __VLS_399;
var __VLS_109;
var __VLS_104;
const __VLS_422 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_423 = __VLS_asFunctionalComponent(__VLS_422, new __VLS_422({
    modelValue: (__VLS_ctx.repsDialog),
    maxWidth: "860",
}));
const __VLS_424 = __VLS_423({
    modelValue: (__VLS_ctx.repsDialog),
    maxWidth: "860",
}, ...__VLS_functionalComponentArgsRest(__VLS_423));
const { default: __VLS_426 } = __VLS_425.slots;
// @ts-ignore
[repsDialog,];
const __VLS_427 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_428 = __VLS_asFunctionalComponent(__VLS_427, new __VLS_427({}));
const __VLS_429 = __VLS_428({}, ...__VLS_functionalComponentArgsRest(__VLS_428));
const { default: __VLS_431 } = __VLS_430.slots;
const __VLS_432 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({}));
const __VLS_434 = __VLS_433({}, ...__VLS_functionalComponentArgsRest(__VLS_433));
const { default: __VLS_436 } = __VLS_435.slots;
(__VLS_ctx.repsEditing ? "Editar representante" : "Novo representante");
// @ts-ignore
[repsEditing,];
var __VLS_435;
const __VLS_437 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_438 = __VLS_asFunctionalComponent(__VLS_437, new __VLS_437({}));
const __VLS_439 = __VLS_438({}, ...__VLS_functionalComponentArgsRest(__VLS_438));
const { default: __VLS_441 } = __VLS_440.slots;
const __VLS_442 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_443 = __VLS_asFunctionalComponent(__VLS_442, new __VLS_442({
    ...{ 'onSubmit': {} },
}));
const __VLS_444 = __VLS_443({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_443));
let __VLS_446;
let __VLS_447;
const __VLS_448 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.saveRep) });
const { default: __VLS_449 } = __VLS_445.slots;
// @ts-ignore
[saveRep,];
const __VLS_450 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_451 = __VLS_asFunctionalComponent(__VLS_450, new __VLS_450({
    dense: true,
}));
const __VLS_452 = __VLS_451({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_451));
const { default: __VLS_454 } = __VLS_453.slots;
const __VLS_455 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_456 = __VLS_asFunctionalComponent(__VLS_455, new __VLS_455({
    cols: "12",
    md: "8",
}));
const __VLS_457 = __VLS_456({
    cols: "12",
    md: "8",
}, ...__VLS_functionalComponentArgsRest(__VLS_456));
const { default: __VLS_459 } = __VLS_458.slots;
const __VLS_460 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
    modelValue: (__VLS_ctx.repsForm.nome_completo),
    errorMessages: (__VLS_ctx.repsFieldErrors.nome_completo),
    label: "Nome completo",
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) ||
            'Nome é obrigatório',
    ]),
}));
const __VLS_462 = __VLS_461({
    modelValue: (__VLS_ctx.repsForm.nome_completo),
    errorMessages: (__VLS_ctx.repsFieldErrors.nome_completo),
    label: "Nome completo",
    rules: ([
        (v) => (!!v && String(v).trim().length > 0) ||
            'Nome é obrigatório',
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_461));
// @ts-ignore
[repsForm, repsFieldErrors,];
var __VLS_458;
const __VLS_465 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_466 = __VLS_asFunctionalComponent(__VLS_465, new __VLS_465({
    cols: "12",
    md: "4",
}));
const __VLS_467 = __VLS_466({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_466));
const { default: __VLS_469 } = __VLS_468.slots;
const __VLS_470 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_471 = __VLS_asFunctionalComponent(__VLS_470, new __VLS_470({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.cpf),
    errorMessages: (__VLS_ctx.repsFieldErrors.cpf),
    label: "CPF",
}));
const __VLS_472 = __VLS_471({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.cpf),
    errorMessages: (__VLS_ctx.repsFieldErrors.cpf),
    label: "CPF",
}, ...__VLS_functionalComponentArgsRest(__VLS_471));
let __VLS_474;
let __VLS_475;
const __VLS_476 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.repsForm.cpf = __VLS_ctx.formatCPF(__VLS_ctx.repsForm.cpf || '');
            // @ts-ignore
            [formatCPF, repsForm, repsForm, repsForm, repsFieldErrors,];
        } });
var __VLS_473;
var __VLS_468;
const __VLS_478 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_479 = __VLS_asFunctionalComponent(__VLS_478, new __VLS_478({
    cols: "12",
    md: "4",
}));
const __VLS_480 = __VLS_479({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_479));
const { default: __VLS_482 } = __VLS_481.slots;
const __VLS_483 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_484 = __VLS_asFunctionalComponent(__VLS_483, new __VLS_483({
    modelValue: (__VLS_ctx.repsForm.rg),
    label: "RG",
}));
const __VLS_485 = __VLS_484({
    modelValue: (__VLS_ctx.repsForm.rg),
    label: "RG",
}, ...__VLS_functionalComponentArgsRest(__VLS_484));
// @ts-ignore
[repsForm,];
var __VLS_481;
const __VLS_488 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_489 = __VLS_asFunctionalComponent(__VLS_488, new __VLS_488({
    cols: "12",
    md: "4",
}));
const __VLS_490 = __VLS_489({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_489));
const { default: __VLS_492 } = __VLS_491.slots;
const __VLS_493 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_494 = __VLS_asFunctionalComponent(__VLS_493, new __VLS_493({
    modelValue: (__VLS_ctx.repsForm.orgao_expedidor),
    label: "Órgão expedidor",
}));
const __VLS_495 = __VLS_494({
    modelValue: (__VLS_ctx.repsForm.orgao_expedidor),
    label: "Órgão expedidor",
}, ...__VLS_functionalComponentArgsRest(__VLS_494));
// @ts-ignore
[repsForm,];
var __VLS_491;
const __VLS_498 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_499 = __VLS_asFunctionalComponent(__VLS_498, new __VLS_498({
    cols: "12",
    md: "4",
}));
const __VLS_500 = __VLS_499({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_499));
const { default: __VLS_502 } = __VLS_501.slots;
const __VLS_503 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_504 = __VLS_asFunctionalComponent(__VLS_503, new __VLS_503({
    modelValue: (__VLS_ctx.repsForm.nacionalidade),
    label: "Nacionalidade",
}));
const __VLS_505 = __VLS_504({
    modelValue: (__VLS_ctx.repsForm.nacionalidade),
    label: "Nacionalidade",
}, ...__VLS_functionalComponentArgsRest(__VLS_504));
// @ts-ignore
[repsForm,];
var __VLS_501;
const __VLS_508 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
    cols: "12",
    md: "4",
}));
const __VLS_510 = __VLS_509({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_509));
const { default: __VLS_512 } = __VLS_511.slots;
const __VLS_513 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_514 = __VLS_asFunctionalComponent(__VLS_513, new __VLS_513({
    modelValue: (__VLS_ctx.repsForm.estado_civil),
    label: "Estado civil",
}));
const __VLS_515 = __VLS_514({
    modelValue: (__VLS_ctx.repsForm.estado_civil),
    label: "Estado civil",
}, ...__VLS_functionalComponentArgsRest(__VLS_514));
// @ts-ignore
[repsForm,];
var __VLS_511;
const __VLS_518 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_519 = __VLS_asFunctionalComponent(__VLS_518, new __VLS_518({
    cols: "12",
    md: "4",
}));
const __VLS_520 = __VLS_519({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_519));
const { default: __VLS_522 } = __VLS_521.slots;
const __VLS_523 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_524 = __VLS_asFunctionalComponent(__VLS_523, new __VLS_523({
    modelValue: (__VLS_ctx.repsForm.profissao),
    label: "Profissão",
}));
const __VLS_525 = __VLS_524({
    modelValue: (__VLS_ctx.repsForm.profissao),
    label: "Profissão",
}, ...__VLS_functionalComponentArgsRest(__VLS_524));
// @ts-ignore
[repsForm,];
var __VLS_521;
const __VLS_528 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
    cols: "12",
    md: "4",
}));
const __VLS_530 = __VLS_529({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_529));
const { default: __VLS_532 } = __VLS_531.slots;
const __VLS_533 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_534 = __VLS_asFunctionalComponent(__VLS_533, new __VLS_533({
    modelValue: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    color: "secondary",
    hideDetails: true,
    label: "Usar o mesmo endereço do cliente",
}));
const __VLS_535 = __VLS_534({
    modelValue: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    color: "secondary",
    hideDetails: true,
    label: "Usar o mesmo endereço do cliente",
}, ...__VLS_functionalComponentArgsRest(__VLS_534));
// @ts-ignore
[repsForm,];
var __VLS_531;
const __VLS_538 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_539 = __VLS_asFunctionalComponent(__VLS_538, new __VLS_538({
    cols: "12",
    md: "3",
}));
const __VLS_540 = __VLS_539({
    cols: "12",
    md: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_539));
const { default: __VLS_542 } = __VLS_541.slots;
const __VLS_543 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_544 = __VLS_asFunctionalComponent(__VLS_543, new __VLS_543({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.cep),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "CEP",
}));
const __VLS_545 = __VLS_544({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.cep),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "CEP",
}, ...__VLS_functionalComponentArgsRest(__VLS_544));
let __VLS_547;
let __VLS_548;
const __VLS_549 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.repsForm.cep = __VLS_ctx.formatCEP(__VLS_ctx.repsForm.cep || '');
            // @ts-ignore
            [repsForm, repsForm, repsForm, repsForm, formatCEP,];
        } });
var __VLS_546;
var __VLS_541;
const __VLS_551 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_552 = __VLS_asFunctionalComponent(__VLS_551, new __VLS_551({
    cols: "12",
    md: "5",
}));
const __VLS_553 = __VLS_552({
    cols: "12",
    md: "5",
}, ...__VLS_functionalComponentArgsRest(__VLS_552));
const { default: __VLS_555 } = __VLS_554.slots;
const __VLS_556 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
    modelValue: (__VLS_ctx.repsForm.logradouro),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Logradouro",
}));
const __VLS_558 = __VLS_557({
    modelValue: (__VLS_ctx.repsForm.logradouro),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Logradouro",
}, ...__VLS_functionalComponentArgsRest(__VLS_557));
// @ts-ignore
[repsForm, repsForm,];
var __VLS_554;
const __VLS_561 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_562 = __VLS_asFunctionalComponent(__VLS_561, new __VLS_561({
    cols: "12",
    md: "2",
}));
const __VLS_563 = __VLS_562({
    cols: "12",
    md: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_562));
const { default: __VLS_565 } = __VLS_564.slots;
const __VLS_566 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_567 = __VLS_asFunctionalComponent(__VLS_566, new __VLS_566({
    modelValue: (__VLS_ctx.repsForm.numero),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Número",
}));
const __VLS_568 = __VLS_567({
    modelValue: (__VLS_ctx.repsForm.numero),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Número",
}, ...__VLS_functionalComponentArgsRest(__VLS_567));
// @ts-ignore
[repsForm, repsForm,];
var __VLS_564;
const __VLS_571 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_572 = __VLS_asFunctionalComponent(__VLS_571, new __VLS_571({
    cols: "12",
    md: "4",
}));
const __VLS_573 = __VLS_572({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_572));
const { default: __VLS_575 } = __VLS_574.slots;
const __VLS_576 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
    modelValue: (__VLS_ctx.repsForm.bairro),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Bairro",
}));
const __VLS_578 = __VLS_577({
    modelValue: (__VLS_ctx.repsForm.bairro),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Bairro",
}, ...__VLS_functionalComponentArgsRest(__VLS_577));
// @ts-ignore
[repsForm, repsForm,];
var __VLS_574;
const __VLS_581 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_582 = __VLS_asFunctionalComponent(__VLS_581, new __VLS_581({
    cols: "12",
    md: "4",
}));
const __VLS_583 = __VLS_582({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_582));
const { default: __VLS_585 } = __VLS_584.slots;
const __VLS_586 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_587 = __VLS_asFunctionalComponent(__VLS_586, new __VLS_586({
    modelValue: (__VLS_ctx.repsForm.cidade),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Cidade",
}));
const __VLS_588 = __VLS_587({
    modelValue: (__VLS_ctx.repsForm.cidade),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "Cidade",
}, ...__VLS_functionalComponentArgsRest(__VLS_587));
// @ts-ignore
[repsForm, repsForm,];
var __VLS_584;
const __VLS_591 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_592 = __VLS_asFunctionalComponent(__VLS_591, new __VLS_591({
    cols: "12",
    md: "2",
}));
const __VLS_593 = __VLS_592({
    cols: "12",
    md: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_592));
const { default: __VLS_595 } = __VLS_594.slots;
const __VLS_596 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.uf),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "UF",
    maxlength: "2",
}));
const __VLS_598 = __VLS_597({
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.repsForm.uf),
    disabled: (__VLS_ctx.repsForm.usa_endereco_do_cliente),
    label: "UF",
    maxlength: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_597));
let __VLS_600;
let __VLS_601;
const __VLS_602 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.repsForm.uf = (__VLS_ctx.repsForm.uf || '').toUpperCase();
            // @ts-ignore
            [repsForm, repsForm, repsForm, repsForm,];
        } });
var __VLS_599;
var __VLS_594;
var __VLS_453;
var __VLS_445;
var __VLS_440;
const __VLS_604 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_605 = __VLS_asFunctionalComponent(__VLS_604, new __VLS_604({}));
const __VLS_606 = __VLS_605({}, ...__VLS_functionalComponentArgsRest(__VLS_605));
const { default: __VLS_608 } = __VLS_607.slots;
const __VLS_609 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_610 = __VLS_asFunctionalComponent(__VLS_609, new __VLS_609({}));
const __VLS_611 = __VLS_610({}, ...__VLS_functionalComponentArgsRest(__VLS_610));
const __VLS_614 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_615 = __VLS_asFunctionalComponent(__VLS_614, new __VLS_614({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_616 = __VLS_615({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_615));
let __VLS_618;
let __VLS_619;
const __VLS_620 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.repsDialog = false;
            // @ts-ignore
            [repsDialog,];
        } });
const { default: __VLS_621 } = __VLS_617.slots;
var __VLS_617;
const __VLS_622 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_623 = __VLS_asFunctionalComponent(__VLS_622, new __VLS_622({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_624 = __VLS_623({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_623));
let __VLS_626;
let __VLS_627;
const __VLS_628 = ({ click: {} },
    { onClick: (__VLS_ctx.saveRep) });
const { default: __VLS_629 } = __VLS_625.slots;
// @ts-ignore
[saveRep,];
var __VLS_625;
var __VLS_607;
var __VLS_430;
var __VLS_425;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            search: search,
            page: page,
            itemsPerPage: itemsPerPage,
            sortBy: sortBy,
            dialog: dialog,
            editing: editing,
            form: form,
            cepLoading: cepLoading,
            cepStatus: cepStatus,
            goContas: goContas,
            formatCPF: formatCPF,
            formatCEP: formatCEP,
            rules: rules,
            fieldErrors: fieldErrors,
            lookupCEP: lookupCEP,
            openCreate: openCreate,
            openEdit: openEdit,
            save: save,
            remove: remove,
            formatDate: formatDate,
            headers: headers,
            repsDialog: repsDialog,
            repsEditing: repsEditing,
            repsForm: repsForm,
            repsFieldErrors: repsFieldErrors,
            openRepCreate: openRepCreate,
            openRepEdit: openRepEdit,
            saveRep: saveRep,
            removeRep: removeRep,
            usarEnderecoDoCliente: usarEnderecoDoCliente,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
