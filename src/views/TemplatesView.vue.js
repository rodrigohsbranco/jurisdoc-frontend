import { computed, onMounted, reactive, ref } from 'vue';
import { useTemplatesStore, } from '@/stores/templates';
const templates = useTemplatesStore();
// =============================
// Tabela
// =============================
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref([
    { key: 'name', order: 'asc' },
]);
const headers = [
    { title: 'Nome', key: 'name' },
    { title: 'Arquivo', key: 'file' },
    { title: 'Ativo', key: 'active' },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];
// =============================
// Criar/editar
// =============================
const dialogUpsert = ref(false);
const editing = ref(null);
const form = reactive({
    name: '',
    active: true,
    file: null,
});
function openCreate() {
    editing.value = null;
    form.name = '';
    form.active = true;
    form.file = null;
    dialogUpsert.value = true;
}
function openEdit(item) {
    editing.value = item;
    form.name = item.name;
    form.active = item.active;
    form.file = null;
    dialogUpsert.value = true;
}
async function saveUpsert() {
    try {
        if (!form.name.trim())
            throw new Error('Informe o nome do template.');
        if (!editing.value && !form.file)
            throw new Error('Selecione o arquivo .docx.');
        await (editing.value
            ? templates.update(editing.value.id, {
                name: form.name.trim(),
                active: form.active,
                ...(form.file ? { file: form.file } : {}),
            })
            : templates.create({
                name: form.name.trim(),
                file: form.file,
                active: form.active,
            }));
        dialogUpsert.value = false;
    }
    catch (error_) {
        // store já preenche lastError
        console.error(error_);
    }
}
function onPickFile(e) {
    const files = e.target.files;
    form.file = files && files.length > 0 ? files[0] : null;
}
// =============================
// Remover
// =============================
async function removeTemplate(item) {
    if (!confirm(`Excluir o template "${item.name}"?`))
        return;
    try {
        await templates.remove(item.id);
    }
    catch (error_) {
        console.error(error_);
    }
}
// =============================
// Campos
// =============================
const dialogFields = ref(false);
const fieldsLoading = ref(false);
const fieldsOf = ref(null);
const fieldsOfItem = ref(null);
async function openFields(item) {
    fieldsLoading.value = true;
    fieldsOfItem.value = item;
    fieldsOf.value = null;
    dialogFields.value = true;
    try {
        fieldsOf.value = await templates.fetchFields(item.id, { force: true });
    }
    catch (error_) {
        console.error(error_);
    }
    finally {
        fieldsLoading.value = false;
    }
}
// =============================
// Render
// =============================
const dialogRender = ref(false);
const renderItem = ref(null);
const renderFields = ref([]);
const renderContext = ref({});
const renderFilename = ref('');
const rendering = ref(false);
// Caso queira ativar no futuro
// async function openRender (item: TemplateItem) {
//   try {
//     const f = await templates.fetchFields(item.id)
//     if (f.syntax && f.syntax.toLowerCase().includes('angle')) {
//       templates.lastError =
//         'Este template ainda usa << >>. Atualize para {{ }} antes de gerar.'
//       return
//     }
//     renderItem.value = item
//     renderFields.value = f.fields
//     renderContext.value = {}
//     renderFilename.value = `${item.name}.docx`
//     dialogRender.value = true
//   } catch (e) {
//     console.error(e)
//   }
// }
async function doRender() {
    if (!renderItem.value)
        return;
    rendering.value = true;
    try {
        const result = await templates.render(renderItem.value.id, {
            context: renderContext.value,
            filename: renderFilename.value.trim() || undefined,
        });
        templates.downloadRendered(result);
        dialogRender.value = false;
    }
    catch (error_) {
        console.error(error_);
    }
    finally {
        rendering.value = false;
    }
}
// =============================
// Computed & inicialização
// =============================
const loadingList = computed(() => templates.loadingList);
const error = computed(() => templates.lastError);
const items = computed(() => templates.items);
async function load() {
    await templates.fetch({ page: 1, page_size: itemsPerPage.value });
}
onMounted(load);
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
    prependIcon: "mdi-file-word",
}));
const __VLS_23 = __VLS_22({
    ...{ 'onClick': {} },
    color: "primary",
    prependIcon: "mdi-file-word",
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
    loading: (__VLS_ctx.loadingList),
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
    loading: (__VLS_ctx.loadingList),
    loadingText: "Carregando...",
    search: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_55));
const { default: __VLS_58 } = __VLS_57.slots;
// @ts-ignore
[search, itemsPerPage, page, sortBy, headers, items, loadingList,];
{
    const { 'item.file': __VLS_59 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_59);
    const __VLS_60 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        href: (item.file),
        prependIcon: "mdi-download",
        rel: "noopener",
        size: "small",
        target: "_blank",
        variant: "text",
    }));
    const __VLS_62 = __VLS_61({
        href: (item.file),
        prependIcon: "mdi-download",
        rel: "noopener",
        size: "small",
        target: "_blank",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    const { default: __VLS_64 } = __VLS_63.slots;
    var __VLS_63;
}
{
    const { 'item.active': __VLS_65 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_65);
    const __VLS_66 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    VChip;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
        color: (item.active ? 'secondary' : undefined),
        size: "small",
        variant: "elevated",
    }));
    const __VLS_68 = __VLS_67({
        color: (item.active ? 'secondary' : undefined),
        size: "small",
        variant: "elevated",
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    const { default: __VLS_70 } = __VLS_69.slots;
    (item.active ? "Ativo" : "Inativo");
    var __VLS_69;
}
{
    const { 'item.actions': __VLS_71 } = __VLS_57.slots;
    const [{ item }] = __VLS_getSlotParameters(__VLS_71);
    const __VLS_72 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_74 = __VLS_73({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    let __VLS_76;
    let __VLS_77;
    const __VLS_78 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openFields(item);
                // @ts-ignore
                [openFields,];
            } });
    const { default: __VLS_79 } = __VLS_75.slots;
    const __VLS_80 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        icon: "mdi-code-braces",
    }));
    const __VLS_82 = __VLS_81({
        icon: "mdi-code-braces",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    var __VLS_75;
    const __VLS_85 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent(__VLS_85, new __VLS_85({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_87 = __VLS_86({
        ...{ 'onClick': {} },
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    let __VLS_89;
    let __VLS_90;
    const __VLS_91 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.openEdit(item);
                // @ts-ignore
                [openEdit,];
            } });
    const { default: __VLS_92 } = __VLS_88.slots;
    const __VLS_93 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
        icon: "mdi-pencil",
    }));
    const __VLS_95 = __VLS_94({
        icon: "mdi-pencil",
    }, ...__VLS_functionalComponentArgsRest(__VLS_94));
    var __VLS_88;
    const __VLS_98 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }));
    const __VLS_100 = __VLS_99({
        ...{ 'onClick': {} },
        color: "error",
        icon: true,
        size: "small",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    let __VLS_102;
    let __VLS_103;
    const __VLS_104 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.removeTemplate(item);
                // @ts-ignore
                [removeTemplate,];
            } });
    const { default: __VLS_105 } = __VLS_101.slots;
    const __VLS_106 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
        icon: "mdi-delete",
    }));
    const __VLS_108 = __VLS_107({
        icon: "mdi-delete",
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    var __VLS_101;
}
{
    const { 'no-data': __VLS_111 } = __VLS_57.slots;
    const __VLS_112 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_114 = __VLS_113({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    const { default: __VLS_116 } = __VLS_115.slots;
    var __VLS_115;
}
var __VLS_57;
var __VLS_47;
var __VLS_32;
const __VLS_117 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({
    modelValue: (__VLS_ctx.dialogUpsert),
    maxWidth: "720",
}));
const __VLS_119 = __VLS_118({
    modelValue: (__VLS_ctx.dialogUpsert),
    maxWidth: "720",
}, ...__VLS_functionalComponentArgsRest(__VLS_118));
const { default: __VLS_121 } = __VLS_120.slots;
// @ts-ignore
[dialogUpsert,];
const __VLS_122 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({}));
const __VLS_124 = __VLS_123({}, ...__VLS_functionalComponentArgsRest(__VLS_123));
const { default: __VLS_126 } = __VLS_125.slots;
const __VLS_127 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({}));
const __VLS_129 = __VLS_128({}, ...__VLS_functionalComponentArgsRest(__VLS_128));
const { default: __VLS_131 } = __VLS_130.slots;
(__VLS_ctx.editing ? "Editar template" : "Novo template");
// @ts-ignore
[editing,];
var __VLS_130;
const __VLS_132 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
const { default: __VLS_136 } = __VLS_135.slots;
const __VLS_137 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
    ...{ 'onSubmit': {} },
}));
const __VLS_139 = __VLS_138({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_138));
let __VLS_141;
let __VLS_142;
const __VLS_143 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.saveUpsert) });
const { default: __VLS_144 } = __VLS_140.slots;
// @ts-ignore
[saveUpsert,];
const __VLS_145 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent(__VLS_145, new __VLS_145({
    dense: true,
}));
const __VLS_147 = __VLS_146({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_146));
const { default: __VLS_149 } = __VLS_148.slots;
const __VLS_150 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
    cols: "12",
    md: "8",
}));
const __VLS_152 = __VLS_151({
    cols: "12",
    md: "8",
}, ...__VLS_functionalComponentArgsRest(__VLS_151));
const { default: __VLS_154 } = __VLS_153.slots;
const __VLS_155 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
    modelValue: (__VLS_ctx.form.name),
    label: "Nome",
    required: true,
}));
const __VLS_157 = __VLS_156({
    modelValue: (__VLS_ctx.form.name),
    label: "Nome",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_156));
// @ts-ignore
[form,];
var __VLS_153;
const __VLS_160 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    cols: "12",
    md: "4",
}));
const __VLS_162 = __VLS_161({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
const { default: __VLS_164 } = __VLS_163.slots;
const __VLS_165 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
VSwitch;
// @ts-ignore
const __VLS_166 = __VLS_asFunctionalComponent(__VLS_165, new __VLS_165({
    modelValue: (__VLS_ctx.form.active),
    color: "secondary",
    hideDetails: true,
    label: "Ativo",
}));
const __VLS_167 = __VLS_166({
    modelValue: (__VLS_ctx.form.active),
    color: "secondary",
    hideDetails: true,
    label: "Ativo",
}, ...__VLS_functionalComponentArgsRest(__VLS_166));
// @ts-ignore
[form,];
var __VLS_163;
const __VLS_170 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_171 = __VLS_asFunctionalComponent(__VLS_170, new __VLS_170({
    cols: "12",
}));
const __VLS_172 = __VLS_171({
    cols: "12",
}, ...__VLS_functionalComponentArgsRest(__VLS_171));
const { default: __VLS_174 } = __VLS_173.slots;
const __VLS_175 = {}.VFileInput;
/** @type {[typeof __VLS_components.VFileInput, typeof __VLS_components.vFileInput, ]} */ ;
// @ts-ignore
VFileInput;
// @ts-ignore
const __VLS_176 = __VLS_asFunctionalComponent(__VLS_175, new __VLS_175({
    ...{ 'onChange': {} },
    accept: ".docx",
    hint: (__VLS_ctx.editing
        ? 'Envie para substituir o arquivo atual (opcional).'
        : ''),
    label: "Arquivo (.docx)",
    persistentHint: true,
    prependIcon: "mdi-file-word",
}));
const __VLS_177 = __VLS_176({
    ...{ 'onChange': {} },
    accept: ".docx",
    hint: (__VLS_ctx.editing
        ? 'Envie para substituir o arquivo atual (opcional).'
        : ''),
    label: "Arquivo (.docx)",
    persistentHint: true,
    prependIcon: "mdi-file-word",
}, ...__VLS_functionalComponentArgsRest(__VLS_176));
let __VLS_179;
let __VLS_180;
const __VLS_181 = ({ change: {} },
    { onChange: (__VLS_ctx.onPickFile) });
// @ts-ignore
[editing, onPickFile,];
var __VLS_178;
var __VLS_173;
var __VLS_148;
var __VLS_140;
var __VLS_135;
const __VLS_183 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_184 = __VLS_asFunctionalComponent(__VLS_183, new __VLS_183({}));
const __VLS_185 = __VLS_184({}, ...__VLS_functionalComponentArgsRest(__VLS_184));
const { default: __VLS_187 } = __VLS_186.slots;
const __VLS_188 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({}));
const __VLS_190 = __VLS_189({}, ...__VLS_functionalComponentArgsRest(__VLS_189));
const __VLS_193 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_194 = __VLS_asFunctionalComponent(__VLS_193, new __VLS_193({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_195 = __VLS_194({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_194));
let __VLS_197;
let __VLS_198;
const __VLS_199 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialogUpsert = false;
            // @ts-ignore
            [dialogUpsert,];
        } });
const { default: __VLS_200 } = __VLS_196.slots;
var __VLS_196;
const __VLS_201 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
    ...{ 'onClick': {} },
    color: "primary",
}));
const __VLS_203 = __VLS_202({
    ...{ 'onClick': {} },
    color: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_202));
let __VLS_205;
let __VLS_206;
const __VLS_207 = ({ click: {} },
    { onClick: (__VLS_ctx.saveUpsert) });
const { default: __VLS_208 } = __VLS_204.slots;
// @ts-ignore
[saveUpsert,];
var __VLS_204;
var __VLS_186;
var __VLS_125;
var __VLS_120;
const __VLS_209 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_210 = __VLS_asFunctionalComponent(__VLS_209, new __VLS_209({
    modelValue: (__VLS_ctx.dialogFields),
    maxWidth: "760",
}));
const __VLS_211 = __VLS_210({
    modelValue: (__VLS_ctx.dialogFields),
    maxWidth: "760",
}, ...__VLS_functionalComponentArgsRest(__VLS_210));
const { default: __VLS_213 } = __VLS_212.slots;
// @ts-ignore
[dialogFields,];
const __VLS_214 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_215 = __VLS_asFunctionalComponent(__VLS_214, new __VLS_214({}));
const __VLS_216 = __VLS_215({}, ...__VLS_functionalComponentArgsRest(__VLS_215));
const { default: __VLS_218 } = __VLS_217.slots;
const __VLS_219 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_220 = __VLS_asFunctionalComponent(__VLS_219, new __VLS_219({
    ...{ class: "d-flex align-center" },
}));
const __VLS_221 = __VLS_220({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_220));
const { default: __VLS_223 } = __VLS_222.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-1" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-body-2 text-medium-emphasis" },
});
(__VLS_ctx.fieldsOfItem?.name);
(__VLS_ctx.fieldsOf?.syntax || "—");
// @ts-ignore
[fieldsOfItem, fieldsOf,];
var __VLS_222;
const __VLS_224 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({}));
const __VLS_226 = __VLS_225({}, ...__VLS_functionalComponentArgsRest(__VLS_225));
const { default: __VLS_228 } = __VLS_227.slots;
if (__VLS_ctx.fieldsOf?.syntax &&
    __VLS_ctx.fieldsOf.syntax.toLowerCase().includes('angle')) {
    // @ts-ignore
    [fieldsOf, fieldsOf,];
    const __VLS_229 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_230 = __VLS_asFunctionalComponent(__VLS_229, new __VLS_229({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }));
    const __VLS_231 = __VLS_230({
        ...{ class: "mb-4" },
        type: "warning",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_230));
    const { default: __VLS_233 } = __VLS_232.slots;
    __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
    __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
    ("{");
    ("}");
    var __VLS_232;
}
if (__VLS_ctx.fieldsLoading) {
    // @ts-ignore
    [fieldsLoading,];
    const __VLS_234 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    VSkeletonLoader;
    // @ts-ignore
    const __VLS_235 = __VLS_asFunctionalComponent(__VLS_234, new __VLS_234({
        type: "table",
    }));
    const __VLS_236 = __VLS_235({
        type: "table",
    }, ...__VLS_functionalComponentArgsRest(__VLS_235));
}
else {
    if (!__VLS_ctx.fieldsOf || __VLS_ctx.fieldsOf.fields.length === 0) {
        // @ts-ignore
        [fieldsOf, fieldsOf,];
        const __VLS_239 = {}.VAlert;
        /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
        // @ts-ignore
        VAlert;
        // @ts-ignore
        const __VLS_240 = __VLS_asFunctionalComponent(__VLS_239, new __VLS_239({
            type: "info",
            variant: "tonal",
        }));
        const __VLS_241 = __VLS_240({
            type: "info",
            variant: "tonal",
        }, ...__VLS_functionalComponentArgsRest(__VLS_240));
        const { default: __VLS_243 } = __VLS_242.slots;
        var __VLS_242;
    }
    else {
        const __VLS_244 = {}.VTable;
        /** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
        // @ts-ignore
        VTable;
        // @ts-ignore
        const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
            density: "comfortable",
        }));
        const __VLS_246 = __VLS_245({
            density: "comfortable",
        }, ...__VLS_functionalComponentArgsRest(__VLS_245));
        const { default: __VLS_248 } = __VLS_247.slots;
        __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
        __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
        for (const [f] of __VLS_getVForSourceType((__VLS_ctx.fieldsOf.fields))) {
            // @ts-ignore
            [fieldsOf,];
            __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
                key: (f.name),
            });
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            (f.raw);
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            __VLS_asFunctionalElement(__VLS_elements.code, __VLS_elements.code)({});
            (f.name);
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
            (f.type);
        }
        var __VLS_247;
    }
}
var __VLS_227;
const __VLS_249 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_250 = __VLS_asFunctionalComponent(__VLS_249, new __VLS_249({}));
const __VLS_251 = __VLS_250({}, ...__VLS_functionalComponentArgsRest(__VLS_250));
const { default: __VLS_253 } = __VLS_252.slots;
const __VLS_254 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_255 = __VLS_asFunctionalComponent(__VLS_254, new __VLS_254({}));
const __VLS_256 = __VLS_255({}, ...__VLS_functionalComponentArgsRest(__VLS_255));
const __VLS_259 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_260 = __VLS_asFunctionalComponent(__VLS_259, new __VLS_259({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_261 = __VLS_260({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_260));
let __VLS_263;
let __VLS_264;
const __VLS_265 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialogFields = false;
            // @ts-ignore
            [dialogFields,];
        } });
const { default: __VLS_266 } = __VLS_262.slots;
var __VLS_262;
var __VLS_252;
var __VLS_217;
var __VLS_212;
const __VLS_267 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
VDialog;
// @ts-ignore
const __VLS_268 = __VLS_asFunctionalComponent(__VLS_267, new __VLS_267({
    modelValue: (__VLS_ctx.dialogRender),
    maxWidth: "840",
}));
const __VLS_269 = __VLS_268({
    modelValue: (__VLS_ctx.dialogRender),
    maxWidth: "840",
}, ...__VLS_functionalComponentArgsRest(__VLS_268));
const { default: __VLS_271 } = __VLS_270.slots;
// @ts-ignore
[dialogRender,];
const __VLS_272 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({}));
const __VLS_274 = __VLS_273({}, ...__VLS_functionalComponentArgsRest(__VLS_273));
const { default: __VLS_276 } = __VLS_275.slots;
const __VLS_277 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({}));
const __VLS_279 = __VLS_278({}, ...__VLS_functionalComponentArgsRest(__VLS_278));
const { default: __VLS_281 } = __VLS_280.slots;
var __VLS_280;
const __VLS_282 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_283 = __VLS_asFunctionalComponent(__VLS_282, new __VLS_282({}));
const __VLS_284 = __VLS_283({}, ...__VLS_functionalComponentArgsRest(__VLS_283));
const { default: __VLS_286 } = __VLS_285.slots;
const __VLS_287 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_288 = __VLS_asFunctionalComponent(__VLS_287, new __VLS_287({
    ...{ 'onSubmit': {} },
}));
const __VLS_289 = __VLS_288({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_288));
let __VLS_291;
let __VLS_292;
const __VLS_293 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.doRender) });
const { default: __VLS_294 } = __VLS_290.slots;
// @ts-ignore
[doRender,];
const __VLS_295 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_296 = __VLS_asFunctionalComponent(__VLS_295, new __VLS_295({
    modelValue: (__VLS_ctx.renderFilename),
    ...{ class: "mb-4" },
    label: "Nome do arquivo (.docx)",
}));
const __VLS_297 = __VLS_296({
    modelValue: (__VLS_ctx.renderFilename),
    ...{ class: "mb-4" },
    label: "Nome do arquivo (.docx)",
}, ...__VLS_functionalComponentArgsRest(__VLS_296));
// @ts-ignore
[renderFilename,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-subtitle-2 mb-2" },
});
const __VLS_300 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
    dense: true,
}));
const __VLS_302 = __VLS_301({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_301));
const { default: __VLS_304 } = __VLS_303.slots;
for (const [f] of __VLS_getVForSourceType((__VLS_ctx.renderFields))) {
    // @ts-ignore
    [renderFields,];
    const __VLS_305 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_306 = __VLS_asFunctionalComponent(__VLS_305, new __VLS_305({
        cols: "12",
        md: "6",
    }));
    const __VLS_307 = __VLS_306({
        cols: "12",
        md: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_306));
    const { default: __VLS_309 } = __VLS_308.slots;
    const __VLS_310 = ((f.type === 'bool' ? 'v-switch' : 'v-text-field'));
    // @ts-ignore
    const __VLS_311 = __VLS_asFunctionalComponent(__VLS_310, new __VLS_310({
        modelValue: (__VLS_ctx.renderContext[f.name]),
        hideDetails: (f.type === 'bool'),
        label: (f.raw || f.name),
        type: (f.type === 'int' ? 'number' : 'text'),
    }));
    const __VLS_312 = __VLS_311({
        modelValue: (__VLS_ctx.renderContext[f.name]),
        hideDetails: (f.type === 'bool'),
        label: (f.raw || f.name),
        type: (f.type === 'int' ? 'number' : 'text'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_311));
    // @ts-ignore
    [renderContext,];
    var __VLS_308;
}
var __VLS_303;
var __VLS_290;
var __VLS_285;
const __VLS_315 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
VCardActions;
// @ts-ignore
const __VLS_316 = __VLS_asFunctionalComponent(__VLS_315, new __VLS_315({}));
const __VLS_317 = __VLS_316({}, ...__VLS_functionalComponentArgsRest(__VLS_316));
const { default: __VLS_319 } = __VLS_318.slots;
const __VLS_320 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_321 = __VLS_asFunctionalComponent(__VLS_320, new __VLS_320({}));
const __VLS_322 = __VLS_321({}, ...__VLS_functionalComponentArgsRest(__VLS_321));
const __VLS_325 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_326 = __VLS_asFunctionalComponent(__VLS_325, new __VLS_325({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_327 = __VLS_326({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_326));
let __VLS_329;
let __VLS_330;
const __VLS_331 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.dialogRender = false;
            // @ts-ignore
            [dialogRender,];
        } });
const { default: __VLS_332 } = __VLS_328.slots;
var __VLS_328;
const __VLS_333 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_334 = __VLS_asFunctionalComponent(__VLS_333, new __VLS_333({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rendering),
}));
const __VLS_335 = __VLS_334({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rendering),
}, ...__VLS_functionalComponentArgsRest(__VLS_334));
let __VLS_337;
let __VLS_338;
const __VLS_339 = ({ click: {} },
    { onClick: (__VLS_ctx.doRender) });
const { default: __VLS_340 } = __VLS_336.slots;
// @ts-ignore
[doRender, rendering,];
var __VLS_336;
var __VLS_318;
var __VLS_275;
var __VLS_270;
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
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            search: search,
            page: page,
            itemsPerPage: itemsPerPage,
            sortBy: sortBy,
            headers: headers,
            dialogUpsert: dialogUpsert,
            editing: editing,
            form: form,
            openCreate: openCreate,
            openEdit: openEdit,
            saveUpsert: saveUpsert,
            onPickFile: onPickFile,
            removeTemplate: removeTemplate,
            dialogFields: dialogFields,
            fieldsLoading: fieldsLoading,
            fieldsOf: fieldsOf,
            fieldsOfItem: fieldsOfItem,
            openFields: openFields,
            dialogRender: dialogRender,
            renderFields: renderFields,
            renderContext: renderContext,
            renderFilename: renderFilename,
            rendering: rendering,
            doRender: doRender,
            loadingList: loadingList,
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
