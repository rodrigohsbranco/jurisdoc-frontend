import { onMounted, ref } from 'vue';
import { createUser, deleteUser, listUsers, setUserPassword, updateUser, } from '@/services/users';
// estado básico
const loading = ref(false);
const items = ref([]);
const error = ref('');
// busca e paginação/ordenação (tudo client-side)
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref([
    { key: 'username', order: 'asc' },
]);
// diálogos
const dialog = ref(false);
const editing = ref(null);
const form = ref({
    is_admin: false,
    is_active: true,
});
const pwdDialog = ref(false);
const pwdTarget = ref(null);
const newPassword = ref('');
// cabeçalhos (simples; sem tipagem avançada)
const headers = [
    { title: 'Usuário', key: 'username' },
    { title: 'Nome', key: 'first_name' },
    { title: 'Sobrenome', key: 'last_name' },
    { title: 'Email', key: 'email' },
    { title: 'Admin', key: 'is_admin', sortable: true },
    { title: 'Ativo', key: 'is_active', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];
// carregar todos os usuários (uma vez) — simples e eficiente para volumes modestos
async function fetchUsers() {
    loading.value = true;
    error.value = '';
    try {
        // pega bastante de uma vez; se um dia crescer muito, voltamos ao server-side
        const data = await listUsers({ page: 1, page_size: 1000 });
        items.value = data.results;
    }
    catch (error_) {
        error.value = error_?.response?.data?.detail || 'Falha ao carregar usuários.';
    }
    finally {
        loading.value = false;
    }
}
onMounted(fetchUsers);
function openCreate() {
    editing.value = null;
    form.value = {
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        is_admin: false,
        is_active: true,
        password: '',
    };
    dialog.value = true;
}
function openEdit(u) {
    editing.value = u;
    // não carregamos senha existente
    form.value = { ...u, password: undefined };
    dialog.value = true;
}
async function save() {
    try {
        if (editing.value) {
            // editando
            const { password, ...rest } = form.value;
            await updateUser(editing.value.id, rest);
            // atualiza lista localmente
            const idx = items.value.findIndex(i => i.id === editing.value.id);
            if (idx !== -1)
                items.value[idx] = { ...items.value[idx], ...rest };
        }
        else {
            // criando (senha obrigatória)
            if (!form.value.password || form.value.password.length < 6) {
                throw new Error('Senha mínima de 6 caracteres.');
            }
            const created = await createUser(form.value);
            items.value.unshift(created); // coloca no topo
        }
        dialog.value = false;
    }
    catch (error_) {
        error.value = error_?.response?.data?.detail || error_?.message || 'Erro ao salvar.';
    }
}
async function remove(u) {
    try {
        await deleteUser(u.id);
        items.value = items.value.filter(i => i.id !== u.id);
    }
    catch (error_) {
        error.value = error_?.response?.data?.detail || 'Não foi possível excluir.';
    }
}
function openSetPassword(u) {
    pwdTarget.value = u;
    newPassword.value = '';
    pwdDialog.value = true;
}
async function applyPassword() {
    if (!pwdTarget.value)
        return;
    if (newPassword.value.length < 6) {
        error.value = 'Senha mínima de 6 caracteres.';
        return;
    }
    try {
        await setUserPassword(pwdTarget.value.id, newPassword.value);
        pwdDialog.value = false;
    }
    catch (error_) {
        error.value = error_?.response?.data?.detail || 'Falha ao alterar senha.';
    }
}
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
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
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
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
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
    items: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
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
    items: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const { default: __VLS_53 } = __VLS_52.slots;
// @ts-ignore
[search, itemsPerPage, page, sortBy, headers, items, loading,];
{
    const { 'item.is_admin': __VLS_54 } = __VLS_52.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_54);
    const __VLS_55 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    VChip;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
        color: (item.is_admin ? 'secondary' : undefined),
        size: "small",
        variant: "tonal",
    }));
    const __VLS_57 = __VLS_56({
        color: (item.is_admin ? 'secondary' : undefined),
        size: "small",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    const { default: __VLS_59 } = __VLS_58.slots;
    (item.is_admin ? "Admin" : "—");
    var __VLS_58;
}
{
    const { 'item.is_active': __VLS_60 } = __VLS_52.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_60);
    const __VLS_61 = {}.VSwitch;
    /** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
    // @ts-ignore
    VSwitch;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
        ...{ 'onUpdate:modelValue': {} },
        color: "success",
        density: "compact",
        hideDetails: true,
        modelValue: (item.is_active),
    }));
    const __VLS_63 = __VLS_62({
        ...{ 'onUpdate:modelValue': {} },
        color: "success",
        density: "compact",
        hideDetails: true,
        modelValue: (item.is_active),
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = ({ 'update:modelValue': {} },
        { 'onUpdate:modelValue': ((val) => {
                __VLS_ctx.updateUser(item.id, { is_active: !!val })
                    .then(() => {
                    item.is_active = !!val;
                })
                    .catch(() => {
                    /* volta visual se falhar */
                });
            }) });
    // @ts-ignore
    [updateUser,];
    var __VLS_64;
}
{
    const { 'item.actions': __VLS_69 } = __VLS_52.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_69);
    const __VLS_70 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_72 = __VLS_71({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    let __VLS_74;
    let __VLS_75;
    const __VLS_76 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openEdit(item);
                // @ts-ignore
                [openEdit,];
            } });
    const { default: __VLS_77 } = __VLS_73.slots;
    const __VLS_78 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
        icon: "mdi-pencil",
    }));
    const __VLS_80 = __VLS_79({
        icon: "mdi-pencil",
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    var __VLS_73;
    const __VLS_83 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
        ...{ 'onClick': {} },
        color: "indigo",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_85 = __VLS_84({
        ...{ 'onClick': {} },
        color: "indigo",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    let __VLS_87;
    let __VLS_88;
    const __VLS_89 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openSetPassword(item);
                // @ts-ignore
                [openSetPassword,];
            } });
    const { default: __VLS_90 } = __VLS_86.slots;
    const __VLS_91 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
        icon: "mdi-lock-reset",
    }));
    const __VLS_93 = __VLS_92({
        icon: "mdi-lock-reset",
    }, ...__VLS_functionalComponentArgsRest(__VLS_92));
    var __VLS_86;
    const __VLS_96 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    const __VLS_102 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.remove(item);
                // @ts-ignore
                [remove,];
            } });
    const { default: __VLS_103 } = __VLS_99.slots;
    const __VLS_104 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        icon: "mdi-delete",
    }));
    const __VLS_106 = __VLS_105({
        icon: "mdi-delete",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    var __VLS_99;
}
{
    const { 'no-data': __VLS_109 } = __VLS_52.slots;
    const __VLS_110 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_112 = __VLS_111({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    const { default: __VLS_114 } = __VLS_113.slots;
    var __VLS_113;
}
var __VLS_52;
var __VLS_42;
var __VLS_9;
const __VLS_115 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "560",
}));
const __VLS_117 = __VLS_116({
    modelValue: (__VLS_ctx.dialog),
    maxWidth: "560",
}, ...__VLS_functionalComponentArgsRest(__VLS_116));
const { default: __VLS_119 } = __VLS_118.slots;
// @ts-ignore
[dialog,];
const __VLS_120 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({}));
const __VLS_122 = __VLS_121({}, ...__VLS_functionalComponentArgsRest(__VLS_121));
const { default: __VLS_124 } = __VLS_123.slots;
const __VLS_125 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({}));
const __VLS_127 = __VLS_126({}, ...__VLS_functionalComponentArgsRest(__VLS_126));
const { default: __VLS_129 } = __VLS_128.slots;
(__VLS_ctx.editing ? "Editar usuário" : "Novo usuário");
// @ts-ignore
[editing,];
var __VLS_128;
const __VLS_130 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent(__VLS_130, new __VLS_130({}));
const __VLS_132 = __VLS_131({}, ...__VLS_functionalComponentArgsRest(__VLS_131));
const { default: __VLS_134 } = __VLS_133.slots;
const __VLS_135 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({
    ...{ 'onSubmit': {} },
}));
const __VLS_137 = __VLS_136({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_136));
let __VLS_139;
let __VLS_140;
const __VLS_141 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.save) });
const { default: __VLS_142 } = __VLS_138.slots;
// @ts-ignore
[save,];
const __VLS_143 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
    modelValue: (__VLS_ctx.form.username),
    label: "Usuário",
    required: true,
}));
const __VLS_145 = __VLS_144({
    modelValue: (__VLS_ctx.form.username),
    label: "Usuário",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_144));
// @ts-ignore
[form,];
const __VLS_148 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
    modelValue: (__VLS_ctx.form.first_name),
    label: "Nome",
}));
const __VLS_150 = __VLS_149({
    modelValue: (__VLS_ctx.form.first_name),
    label: "Nome",
}, ...__VLS_functionalComponentArgsRest(__VLS_149));
// @ts-ignore
[form,];
const __VLS_153 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_154 = __VLS_asFunctionalComponent(__VLS_153, new __VLS_153({
    modelValue: (__VLS_ctx.form.last_name),
    label: "Sobrenome",
}));
const __VLS_155 = __VLS_154({
    modelValue: (__VLS_ctx.form.last_name),
    label: "Sobrenome",
}, ...__VLS_functionalComponentArgsRest(__VLS_154));
// @ts-ignore
[form,];
const __VLS_158 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_159 = __VLS_asFunctionalComponent(__VLS_158, new __VLS_158({
    modelValue: (__VLS_ctx.form.email),
    label: "Email",
    type: "email",
}));
const __VLS_160 = __VLS_159({
    modelValue: (__VLS_ctx.form.email),
    label: "Email",
    type: "email",
}, ...__VLS_functionalComponentArgsRest(__VLS_159));
// @ts-ignore
[form,];
const __VLS_163 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_164 = __VLS_asFunctionalComponent(__VLS_163, new __VLS_163({
    modelValue: (__VLS_ctx.form.is_admin),
    color: "secondary",
    label: "Administrador",
}));
const __VLS_165 = __VLS_164({
    modelValue: (__VLS_ctx.form.is_admin),
    color: "secondary",
    label: "Administrador",
}, ...__VLS_functionalComponentArgsRest(__VLS_164));
// @ts-ignore
[form,];
const __VLS_168 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
    modelValue: (__VLS_ctx.form.is_active),
    color: "success",
    label: "Ativo",
}));
const __VLS_170 = __VLS_169({
    modelValue: (__VLS_ctx.form.is_active),
    color: "success",
    label: "Ativo",
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
// @ts-ignore
[form,];
if (!__VLS_ctx.editing) {
    // @ts-ignore
    [editing,];
    const __VLS_173 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    VTextField;
    // @ts-ignore
    const __VLS_174 = __VLS_asFunctionalComponent(__VLS_173, new __VLS_173({
        modelValue: (__VLS_ctx.form.password),
        label: "Senha",
        required: true,
        rules: ([(v) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']),
        type: "password",
    }));
    const __VLS_175 = __VLS_174({
        modelValue: (__VLS_ctx.form.password),
        label: "Senha",
        required: true,
        rules: ([(v) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']),
        type: "password",
    }, ...__VLS_functionalComponentArgsRest(__VLS_174));
    // @ts-ignore
    [form,];
}
var __VLS_138;
var __VLS_133;
const __VLS_178 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({}));
const __VLS_180 = __VLS_179({}, ...__VLS_functionalComponentArgsRest(__VLS_179));
const { default: __VLS_182 } = __VLS_181.slots;
const __VLS_183 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_184 = __VLS_asFunctionalComponent(__VLS_183, new __VLS_183({}));
const __VLS_185 = __VLS_184({}, ...__VLS_functionalComponentArgsRest(__VLS_184));
const __VLS_188 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_190 = __VLS_189({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
let __VLS_192;
let __VLS_193;
const __VLS_194 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialog = false;
            // @ts-ignore
            [dialog,];
        } });
const { default: __VLS_195 } = __VLS_191.slots;
var __VLS_191;
const __VLS_196 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_198 = __VLS_197({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_197));
let __VLS_200;
let __VLS_201;
const __VLS_202 = ({ click: {} },
    { onClick: (__VLS_ctx.save) });
const { default: __VLS_203 } = __VLS_199.slots;
// @ts-ignore
[save,];
var __VLS_199;
var __VLS_181;
var __VLS_123;
var __VLS_118;
const __VLS_204 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.pwdDialog),
    maxWidth: "480",
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.pwdDialog),
    maxWidth: "480",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
const { default: __VLS_208 } = __VLS_207.slots;
// @ts-ignore
[pwdDialog,];
const __VLS_209 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_210 = __VLS_asFunctionalComponent(__VLS_209, new __VLS_209({}));
const __VLS_211 = __VLS_210({}, ...__VLS_functionalComponentArgsRest(__VLS_210));
const { default: __VLS_213 } = __VLS_212.slots;
const __VLS_214 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_215 = __VLS_asFunctionalComponent(__VLS_214, new __VLS_214({}));
const __VLS_216 = __VLS_215({}, ...__VLS_functionalComponentArgsRest(__VLS_215));
const { default: __VLS_218 } = __VLS_217.slots;
var __VLS_217;
const __VLS_219 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_220 = __VLS_asFunctionalComponent(__VLS_219, new __VLS_219({}));
const __VLS_221 = __VLS_220({}, ...__VLS_functionalComponentArgsRest(__VLS_220));
const { default: __VLS_223 } = __VLS_222.slots;
const __VLS_224 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
    modelValue: (__VLS_ctx.newPassword),
    label: "Nova senha",
    type: "password",
}));
const __VLS_226 = __VLS_225({
    modelValue: (__VLS_ctx.newPassword),
    label: "Nova senha",
    type: "password",
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
// @ts-ignore
[newPassword,];
var __VLS_222;
const __VLS_229 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_230 = __VLS_asFunctionalComponent(__VLS_229, new __VLS_229({}));
const __VLS_231 = __VLS_230({}, ...__VLS_functionalComponentArgsRest(__VLS_230));
const { default: __VLS_233 } = __VLS_232.slots;
const __VLS_234 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_235 = __VLS_asFunctionalComponent(__VLS_234, new __VLS_234({}));
const __VLS_236 = __VLS_235({}, ...__VLS_functionalComponentArgsRest(__VLS_235));
const __VLS_239 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_240 = __VLS_asFunctionalComponent(__VLS_239, new __VLS_239({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_241 = __VLS_240({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_240));
let __VLS_243;
let __VLS_244;
const __VLS_245 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.pwdDialog = false;
            // @ts-ignore
            [pwdDialog,];
        } });
const { default: __VLS_246 } = __VLS_242.slots;
var __VLS_242;
const __VLS_247 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_248 = __VLS_asFunctionalComponent(__VLS_247, new __VLS_247({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_249 = __VLS_248({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_248));
let __VLS_251;
let __VLS_252;
const __VLS_253 = ({ click: {} },
    { onClick: (__VLS_ctx.applyPassword) });
const { default: __VLS_254 } = __VLS_250.slots;
// @ts-ignore
[applyPassword,];
var __VLS_250;
var __VLS_232;
var __VLS_212;
var __VLS_207;
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
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            updateUser: updateUser,
            loading: loading,
            items: items,
            error: error,
            search: search,
            page: page,
            itemsPerPage: itemsPerPage,
            sortBy: sortBy,
            dialog: dialog,
            editing: editing,
            form: form,
            pwdDialog: pwdDialog,
            newPassword: newPassword,
            headers: headers,
            openCreate: openCreate,
            openEdit: openEdit,
            save: save,
            remove: remove,
            openSetPassword: openSetPassword,
            applyPassword: applyPassword,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
