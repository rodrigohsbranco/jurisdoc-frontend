import { computed, onMounted, reactive, ref } from 'vue';
import { useRelatoriosStore } from '@/stores/relatorios';
import { useTemplatesStore } from '@/stores/templates';
const rel = useRelatoriosStore();
const templates = useTemplatesStore();
// ----- Filtros -----
const filters = reactive({
    bucket: 'day',
    date_from: '',
    date_to: '',
});
// inicia com últimos 30 dias
function setDefaultRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    filters.date_to = to.toISOString().slice(0, 10);
    filters.date_from = from.toISOString().slice(0, 10);
}
setDefaultRange();
const bucketItems = [
    { title: 'Dia', value: 'day' },
    { title: 'Semana', value: 'week' },
    { title: 'Mês', value: 'month' },
];
// maior uso para normalizar a barra de progresso
const maxTemplateCount = computed(() => Math.max(...(rel.templatesUsage?.map(x => x.count) ?? [0]), 1));
// ----- Carregamento inicial -----
async function fetchAll() {
    await Promise.all([
        rel.fetchTimeSeries(filters),
        rel.fetchTemplatesUsage({
            top: 10,
            date_from: filters.date_from,
            date_to: filters.date_to,
        }),
        rel.fetchDataQuality(),
        // carregar alguns templates p/ selects (seu store suporta active: true)
        templates
            .fetch?.({ page: 1, page_size: 100, active: true })
            .catch(() => { }),
    ]);
}
onMounted(fetchAll);
// ----- KPIs somados no período -----
const totalClientes = computed(() => (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.clientes || 0), 0));
const totalPeticoesCriadas = computed(() => (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.peticoes_criadas || 0), 0));
const totalPeticoesAtualizadas = computed(() => (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.peticoes_atualizadas || 0), 0));
// ----- Dados para sparklines -----
const sparkClientes = computed(() => (rel.timeseries?.series ?? []).map(p => p.clientes));
const sparkPCriadas = computed(() => (rel.timeseries?.series ?? []).map(p => p.peticoes_criadas));
const sparkPAtualizadas = computed(() => (rel.timeseries?.series ?? []).map(p => p.peticoes_atualizadas));
// ----- Tab control -----
const tab = ref('overview');
// ----- Exportação -----
const exportForm = reactive({
    date_from: filters.date_from,
    date_to: filters.date_to,
    template: undefined,
    clienteId: undefined,
});
function templateItems() {
    return templates.items.map(t => ({ title: t.name, value: Number(t.id) }));
}
async function doRefresh() {
    await fetchAll();
    // sincroniza export range com filtros
    exportForm.date_from = filters.date_from;
    exportForm.date_to = filters.date_to;
}
function pct(part, total) {
    if (!total)
        return 0;
    return Math.round((part / total) * 100);
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
    loading: (__VLS_ctx.rel.loading.timeseries ||
        __VLS_ctx.rel.loading.templates ||
        __VLS_ctx.rel.loading.quality),
    prependIcon: "mdi-refresh",
}));
const __VLS_23 = __VLS_22({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rel.loading.timeseries ||
        __VLS_ctx.rel.loading.templates ||
        __VLS_ctx.rel.loading.quality),
    prependIcon: "mdi-refresh",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_25;
let __VLS_26;
const __VLS_27 = ({ click: {} },
    { onClick: (__VLS_ctx.doRefresh) });
const { default: __VLS_28 } = __VLS_24.slots;
// @ts-ignore
[rel, rel, rel, doRefresh,];
var __VLS_24;
var __VLS_14;
const __VLS_29 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({}));
const __VLS_31 = __VLS_30({}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const { default: __VLS_33 } = __VLS_32.slots;
const __VLS_34 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    dense: true,
}));
const __VLS_36 = __VLS_35({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
const { default: __VLS_38 } = __VLS_37.slots;
const __VLS_39 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent(__VLS_39, new __VLS_39({
    cols: "12",
    sm: "3",
}));
const __VLS_41 = __VLS_40({
    cols: "12",
    sm: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_40));
const { default: __VLS_43 } = __VLS_42.slots;
const __VLS_44 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
VSelect;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.filters.bucket),
    density: "comfortable",
    hideDetails: true,
    items: (__VLS_ctx.bucketItems),
    label: "Agrupar por",
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.filters.bucket),
    density: "comfortable",
    hideDetails: true,
    items: (__VLS_ctx.bucketItems),
    label: "Agrupar por",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
// @ts-ignore
[filters, bucketItems,];
var __VLS_42;
const __VLS_49 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    cols: "12",
    sm: "3",
}));
const __VLS_51 = __VLS_50({
    cols: "12",
    sm: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
const { default: __VLS_53 } = __VLS_52.slots;
const __VLS_54 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
    modelValue: (__VLS_ctx.filters.date_from),
    density: "comfortable",
    hideDetails: true,
    label: "Início",
    type: "date",
}));
const __VLS_56 = __VLS_55({
    modelValue: (__VLS_ctx.filters.date_from),
    density: "comfortable",
    hideDetails: true,
    label: "Início",
    type: "date",
}, ...__VLS_functionalComponentArgsRest(__VLS_55));
// @ts-ignore
[filters,];
var __VLS_52;
const __VLS_59 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({
    cols: "12",
    sm: "3",
}));
const __VLS_61 = __VLS_60({
    cols: "12",
    sm: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_60));
const { default: __VLS_63 } = __VLS_62.slots;
const __VLS_64 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.filters.date_to),
    density: "comfortable",
    hideDetails: true,
    label: "Fim",
    type: "date",
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.filters.date_to),
    density: "comfortable",
    hideDetails: true,
    label: "Fim",
    type: "date",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
// @ts-ignore
[filters,];
var __VLS_62;
const __VLS_69 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
    ...{ class: "d-flex align-end" },
    cols: "12",
    sm: "3",
}));
const __VLS_71 = __VLS_70({
    ...{ class: "d-flex align-end" },
    cols: "12",
    sm: "3",
}, ...__VLS_functionalComponentArgsRest(__VLS_70));
const { default: __VLS_73 } = __VLS_72.slots;
const __VLS_74 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
    ...{ 'onClick': {} },
    block: true,
    color: "secondary",
}));
const __VLS_76 = __VLS_75({
    ...{ 'onClick': {} },
    block: true,
    color: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_75));
let __VLS_78;
let __VLS_79;
const __VLS_80 = ({ click: {} },
    { onClick: (__VLS_ctx.doRefresh) });
const { default: __VLS_81 } = __VLS_77.slots;
// @ts-ignore
[doRefresh,];
var __VLS_77;
var __VLS_72;
var __VLS_37;
if (__VLS_ctx.rel.hasError) {
    // @ts-ignore
    [rel,];
    const __VLS_82 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
        ...{ class: "mt-3" },
        type: "error",
        variant: "tonal",
    }));
    const __VLS_84 = __VLS_83({
        ...{ class: "mt-3" },
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    const { default: __VLS_86 } = __VLS_85.slots;
    (__VLS_ctx.rel.error);
    // @ts-ignore
    [rel,];
    var __VLS_85;
}
var __VLS_32;
var __VLS_9;
const __VLS_87 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
    ...{ class: "mb-4" },
    dense: true,
}));
const __VLS_89 = __VLS_88({
    ...{ class: "mb-4" },
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_88));
const { default: __VLS_91 } = __VLS_90.slots;
const __VLS_92 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    cols: "12",
    sm: "4",
}));
const __VLS_94 = __VLS_93({
    cols: "12",
    sm: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
const { default: __VLS_96 } = __VLS_95.slots;
const __VLS_97 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_99 = __VLS_98({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_98));
const { default: __VLS_101 } = __VLS_100.slots;
const __VLS_102 = {}.VCardItem;
/** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
// @ts-ignore
VCardItem;
// @ts-ignore
const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({}));
const __VLS_104 = __VLS_103({}, ...__VLS_functionalComponentArgsRest(__VLS_103));
const { default: __VLS_106 } = __VLS_105.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center justify-space-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-caption text-medium-emphasis" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-h5 font-weight-bold" },
});
(__VLS_ctx.totalClientes);
// @ts-ignore
[totalClientes,];
const __VLS_107 = {}.VAvatar;
/** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
// @ts-ignore
VAvatar;
// @ts-ignore
const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
    color: "primary",
    size: "40",
    variant: "tonal",
}));
const __VLS_109 = __VLS_108({
    color: "primary",
    size: "40",
    variant: "tonal",
}, ...__VLS_functionalComponentArgsRest(__VLS_108));
const { default: __VLS_111 } = __VLS_110.slots;
const __VLS_112 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    icon: "mdi-account-group",
}));
const __VLS_114 = __VLS_113({
    icon: "mdi-account-group",
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
var __VLS_110;
var __VLS_105;
const __VLS_117 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent(__VLS_117, new __VLS_117({}));
const __VLS_119 = __VLS_118({}, ...__VLS_functionalComponentArgsRest(__VLS_118));
const { default: __VLS_121 } = __VLS_120.slots;
const __VLS_122 = {}.VSparkline;
/** @type {[typeof __VLS_components.VSparkline, typeof __VLS_components.vSparkline, ]} */ ;
// @ts-ignore
VSparkline;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
    autoDraw: true,
    value: (__VLS_ctx.sparkClientes),
}));
const __VLS_124 = __VLS_123({
    autoDraw: true,
    value: (__VLS_ctx.sparkClientes),
}, ...__VLS_functionalComponentArgsRest(__VLS_123));
// @ts-ignore
[sparkClientes,];
var __VLS_120;
var __VLS_100;
var __VLS_95;
const __VLS_127 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
    cols: "12",
    sm: "4",
}));
const __VLS_129 = __VLS_128({
    cols: "12",
    sm: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_128));
const { default: __VLS_131 } = __VLS_130.slots;
const __VLS_132 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_134 = __VLS_133({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
const { default: __VLS_136 } = __VLS_135.slots;
const __VLS_137 = {}.VCardItem;
/** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
// @ts-ignore
VCardItem;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({}));
const __VLS_139 = __VLS_138({}, ...__VLS_functionalComponentArgsRest(__VLS_138));
const { default: __VLS_141 } = __VLS_140.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center justify-space-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-caption text-medium-emphasis" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-h5 font-weight-bold" },
});
(__VLS_ctx.totalPeticoesCriadas);
// @ts-ignore
[totalPeticoesCriadas,];
const __VLS_142 = {}.VAvatar;
/** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
// @ts-ignore
VAvatar;
// @ts-ignore
const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({
    color: "secondary",
    size: "40",
    variant: "tonal",
}));
const __VLS_144 = __VLS_143({
    color: "secondary",
    size: "40",
    variant: "tonal",
}, ...__VLS_functionalComponentArgsRest(__VLS_143));
const { default: __VLS_146 } = __VLS_145.slots;
const __VLS_147 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
    icon: "mdi-file-document",
}));
const __VLS_149 = __VLS_148({
    icon: "mdi-file-document",
}, ...__VLS_functionalComponentArgsRest(__VLS_148));
var __VLS_145;
var __VLS_140;
const __VLS_152 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({}));
const __VLS_154 = __VLS_153({}, ...__VLS_functionalComponentArgsRest(__VLS_153));
const { default: __VLS_156 } = __VLS_155.slots;
const __VLS_157 = {}.VSparkline;
/** @type {[typeof __VLS_components.VSparkline, typeof __VLS_components.vSparkline, ]} */ ;
// @ts-ignore
VSparkline;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({
    autoDraw: true,
    value: (__VLS_ctx.sparkPCriadas),
}));
const __VLS_159 = __VLS_158({
    autoDraw: true,
    value: (__VLS_ctx.sparkPCriadas),
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
// @ts-ignore
[sparkPCriadas,];
var __VLS_155;
var __VLS_135;
var __VLS_130;
const __VLS_162 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_163 = __VLS_asFunctionalComponent(__VLS_162, new __VLS_162({
    cols: "12",
    sm: "4",
}));
const __VLS_164 = __VLS_163({
    cols: "12",
    sm: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_163));
const { default: __VLS_166 } = __VLS_165.slots;
const __VLS_167 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_168 = __VLS_asFunctionalComponent(__VLS_167, new __VLS_167({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_169 = __VLS_168({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_168));
const { default: __VLS_171 } = __VLS_170.slots;
const __VLS_172 = {}.VCardItem;
/** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
// @ts-ignore
VCardItem;
// @ts-ignore
const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({}));
const __VLS_174 = __VLS_173({}, ...__VLS_functionalComponentArgsRest(__VLS_173));
const { default: __VLS_176 } = __VLS_175.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "d-flex align-center justify-space-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-caption text-medium-emphasis" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-h5 font-weight-bold" },
});
(__VLS_ctx.totalPeticoesAtualizadas);
// @ts-ignore
[totalPeticoesAtualizadas,];
const __VLS_177 = {}.VAvatar;
/** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
// @ts-ignore
VAvatar;
// @ts-ignore
const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
    color: "indigo",
    size: "40",
    variant: "tonal",
}));
const __VLS_179 = __VLS_178({
    color: "indigo",
    size: "40",
    variant: "tonal",
}, ...__VLS_functionalComponentArgsRest(__VLS_178));
const { default: __VLS_181 } = __VLS_180.slots;
const __VLS_182 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_183 = __VLS_asFunctionalComponent(__VLS_182, new __VLS_182({
    icon: "mdi-pencil",
}));
const __VLS_184 = __VLS_183({
    icon: "mdi-pencil",
}, ...__VLS_functionalComponentArgsRest(__VLS_183));
var __VLS_180;
var __VLS_175;
const __VLS_187 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_188 = __VLS_asFunctionalComponent(__VLS_187, new __VLS_187({}));
const __VLS_189 = __VLS_188({}, ...__VLS_functionalComponentArgsRest(__VLS_188));
const { default: __VLS_191 } = __VLS_190.slots;
const __VLS_192 = {}.VSparkline;
/** @type {[typeof __VLS_components.VSparkline, typeof __VLS_components.vSparkline, ]} */ ;
// @ts-ignore
VSparkline;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
    autoDraw: true,
    value: (__VLS_ctx.sparkPAtualizadas),
}));
const __VLS_194 = __VLS_193({
    autoDraw: true,
    value: (__VLS_ctx.sparkPAtualizadas),
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
// @ts-ignore
[sparkPAtualizadas,];
var __VLS_190;
var __VLS_170;
var __VLS_165;
var __VLS_90;
const __VLS_197 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_198 = __VLS_asFunctionalComponent(__VLS_197, new __VLS_197({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_199 = __VLS_198({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_198));
const { default: __VLS_201 } = __VLS_200.slots;
const __VLS_202 = {}.VTabs;
/** @type {[typeof __VLS_components.VTabs, typeof __VLS_components.vTabs, typeof __VLS_components.VTabs, typeof __VLS_components.vTabs, ]} */ ;
// @ts-ignore
VTabs;
// @ts-ignore
const __VLS_203 = __VLS_asFunctionalComponent(__VLS_202, new __VLS_202({
    modelValue: (__VLS_ctx.tab),
    bgColor: "transparent",
    sliderColor: "primary",
}));
const __VLS_204 = __VLS_203({
    modelValue: (__VLS_ctx.tab),
    bgColor: "transparent",
    sliderColor: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_203));
const { default: __VLS_206 } = __VLS_205.slots;
// @ts-ignore
[tab,];
const __VLS_207 = {}.VTab;
/** @type {[typeof __VLS_components.VTab, typeof __VLS_components.vTab, typeof __VLS_components.VTab, typeof __VLS_components.vTab, ]} */ ;
// @ts-ignore
VTab;
// @ts-ignore
const __VLS_208 = __VLS_asFunctionalComponent(__VLS_207, new __VLS_207({
    value: "overview",
}));
const __VLS_209 = __VLS_208({
    value: "overview",
}, ...__VLS_functionalComponentArgsRest(__VLS_208));
const { default: __VLS_211 } = __VLS_210.slots;
const __VLS_212 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
    icon: "mdi-chart-line",
    start: true,
}));
const __VLS_214 = __VLS_213({
    icon: "mdi-chart-line",
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_213));
var __VLS_210;
const __VLS_217 = {}.VTab;
/** @type {[typeof __VLS_components.VTab, typeof __VLS_components.vTab, typeof __VLS_components.VTab, typeof __VLS_components.vTab, ]} */ ;
// @ts-ignore
VTab;
// @ts-ignore
const __VLS_218 = __VLS_asFunctionalComponent(__VLS_217, new __VLS_217({
    value: "templates",
}));
const __VLS_219 = __VLS_218({
    value: "templates",
}, ...__VLS_functionalComponentArgsRest(__VLS_218));
const { default: __VLS_221 } = __VLS_220.slots;
const __VLS_222 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_223 = __VLS_asFunctionalComponent(__VLS_222, new __VLS_222({
    icon: "mdi-file-word",
    start: true,
}));
const __VLS_224 = __VLS_223({
    icon: "mdi-file-word",
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_223));
var __VLS_220;
const __VLS_227 = {}.VTab;
/** @type {[typeof __VLS_components.VTab, typeof __VLS_components.vTab, typeof __VLS_components.VTab, typeof __VLS_components.vTab, ]} */ ;
// @ts-ignore
VTab;
// @ts-ignore
const __VLS_228 = __VLS_asFunctionalComponent(__VLS_227, new __VLS_227({
    value: "quality",
}));
const __VLS_229 = __VLS_228({
    value: "quality",
}, ...__VLS_functionalComponentArgsRest(__VLS_228));
const { default: __VLS_231 } = __VLS_230.slots;
const __VLS_232 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
    icon: "mdi-clipboard-check",
    start: true,
}));
const __VLS_234 = __VLS_233({
    icon: "mdi-clipboard-check",
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_233));
var __VLS_230;
const __VLS_237 = {}.VTab;
/** @type {[typeof __VLS_components.VTab, typeof __VLS_components.vTab, typeof __VLS_components.VTab, typeof __VLS_components.vTab, ]} */ ;
// @ts-ignore
VTab;
// @ts-ignore
const __VLS_238 = __VLS_asFunctionalComponent(__VLS_237, new __VLS_237({
    value: "export",
}));
const __VLS_239 = __VLS_238({
    value: "export",
}, ...__VLS_functionalComponentArgsRest(__VLS_238));
const { default: __VLS_241 } = __VLS_240.slots;
const __VLS_242 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_243 = __VLS_asFunctionalComponent(__VLS_242, new __VLS_242({
    icon: "mdi-download",
    start: true,
}));
const __VLS_244 = __VLS_243({
    icon: "mdi-download",
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_243));
var __VLS_240;
var __VLS_205;
const __VLS_247 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
VDivider;
// @ts-ignore
const __VLS_248 = __VLS_asFunctionalComponent(__VLS_247, new __VLS_247({}));
const __VLS_249 = __VLS_248({}, ...__VLS_functionalComponentArgsRest(__VLS_248));
const __VLS_252 = {}.VWindow;
/** @type {[typeof __VLS_components.VWindow, typeof __VLS_components.vWindow, typeof __VLS_components.VWindow, typeof __VLS_components.vWindow, ]} */ ;
// @ts-ignore
VWindow;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.tab),
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.tab),
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
const { default: __VLS_256 } = __VLS_255.slots;
// @ts-ignore
[tab,];
const __VLS_257 = {}.VWindowItem;
/** @type {[typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, ]} */ ;
// @ts-ignore
VWindowItem;
// @ts-ignore
const __VLS_258 = __VLS_asFunctionalComponent(__VLS_257, new __VLS_257({
    value: "overview",
}));
const __VLS_259 = __VLS_258({
    value: "overview",
}, ...__VLS_functionalComponentArgsRest(__VLS_258));
const { default: __VLS_261 } = __VLS_260.slots;
const __VLS_262 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_263 = __VLS_asFunctionalComponent(__VLS_262, new __VLS_262({}));
const __VLS_264 = __VLS_263({}, ...__VLS_functionalComponentArgsRest(__VLS_263));
const { default: __VLS_266 } = __VLS_265.slots;
if (__VLS_ctx.rel.loading.timeseries) {
    // @ts-ignore
    [rel,];
    const __VLS_267 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    VSkeletonLoader;
    // @ts-ignore
    const __VLS_268 = __VLS_asFunctionalComponent(__VLS_267, new __VLS_267({
        type: "table",
    }));
    const __VLS_269 = __VLS_268({
        type: "table",
    }, ...__VLS_functionalComponentArgsRest(__VLS_268));
}
else {
    const __VLS_272 = {}.VDataTable;
    /** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
    // @ts-ignore
    VDataTable;
    // @ts-ignore
    const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
        ...{ class: "rounded-lg" },
        density: "comfortable",
        headers: ([
            { title: 'Período', key: 'period' },
            { title: 'Clientes', key: 'clientes' },
            { title: 'Petições criadas', key: 'peticoes_criadas' },
            { title: 'Petições atualizadas', key: 'peticoes_atualizadas' },
        ]),
        itemKey: "period",
        items: (__VLS_ctx.rel.timeseries?.series ?? []),
    }));
    const __VLS_274 = __VLS_273({
        ...{ class: "rounded-lg" },
        density: "comfortable",
        headers: ([
            { title: 'Período', key: 'period' },
            { title: 'Clientes', key: 'clientes' },
            { title: 'Petições criadas', key: 'peticoes_criadas' },
            { title: 'Petições atualizadas', key: 'peticoes_atualizadas' },
        ]),
        itemKey: "period",
        items: (__VLS_ctx.rel.timeseries?.series ?? []),
    }, ...__VLS_functionalComponentArgsRest(__VLS_273));
    // @ts-ignore
    [rel,];
}
var __VLS_265;
var __VLS_260;
const __VLS_277 = {}.VWindowItem;
/** @type {[typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, ]} */ ;
// @ts-ignore
VWindowItem;
// @ts-ignore
const __VLS_278 = __VLS_asFunctionalComponent(__VLS_277, new __VLS_277({
    value: "templates",
}));
const __VLS_279 = __VLS_278({
    value: "templates",
}, ...__VLS_functionalComponentArgsRest(__VLS_278));
const { default: __VLS_281 } = __VLS_280.slots;
const __VLS_282 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_283 = __VLS_asFunctionalComponent(__VLS_282, new __VLS_282({}));
const __VLS_284 = __VLS_283({}, ...__VLS_functionalComponentArgsRest(__VLS_283));
const { default: __VLS_286 } = __VLS_285.slots;
if (__VLS_ctx.rel.loading.templates) {
    // @ts-ignore
    [rel,];
    const __VLS_287 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    VSkeletonLoader;
    // @ts-ignore
    const __VLS_288 = __VLS_asFunctionalComponent(__VLS_287, new __VLS_287({
        type: "table",
    }));
    const __VLS_289 = __VLS_288({
        type: "table",
    }, ...__VLS_functionalComponentArgsRest(__VLS_288));
}
else {
    const __VLS_292 = {}.VDataTable;
    /** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
    // @ts-ignore
    VDataTable;
    // @ts-ignore
    const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
        ...{ class: "rounded-lg" },
        density: "comfortable",
        headers: ([
            { title: 'Template', key: 'template' },
            { title: 'Uso', key: 'count' },
            { title: 'Indicador', key: 'bar', sortable: false },
        ]),
        itemKey: "template_id",
        items: (__VLS_ctx.rel.templatesUsage),
    }));
    const __VLS_294 = __VLS_293({
        ...{ class: "rounded-lg" },
        density: "comfortable",
        headers: ([
            { title: 'Template', key: 'template' },
            { title: 'Uso', key: 'count' },
            { title: 'Indicador', key: 'bar', sortable: false },
        ]),
        itemKey: "template_id",
        items: (__VLS_ctx.rel.templatesUsage),
    }, ...__VLS_functionalComponentArgsRest(__VLS_293));
    const { default: __VLS_296 } = __VLS_295.slots;
    // @ts-ignore
    [rel,];
    {
        const { 'item.bar': __VLS_297 } = __VLS_295.slots;
        const [{ item }] = __VLS_getSlotParameters(__VLS_297);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "d-flex align-center" },
            ...{ style: {} },
        });
        const __VLS_298 = {}.VProgressLinear;
        /** @type {[typeof __VLS_components.VProgressLinear, typeof __VLS_components.vProgressLinear, ]} */ ;
        // @ts-ignore
        VProgressLinear;
        // @ts-ignore
        const __VLS_299 = __VLS_asFunctionalComponent(__VLS_298, new __VLS_298({
            ...{ class: "flex-grow-1" },
            color: (item.count === __VLS_ctx.maxTemplateCount ? 'success' : 'primary'),
            height: "10",
            modelValue: ((item.count / __VLS_ctx.maxTemplateCount) * 100),
            rounded: true,
        }));
        const __VLS_300 = __VLS_299({
            ...{ class: "flex-grow-1" },
            color: (item.count === __VLS_ctx.maxTemplateCount ? 'success' : 'primary'),
            height: "10",
            modelValue: ((item.count / __VLS_ctx.maxTemplateCount) * 100),
            rounded: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_299));
        // @ts-ignore
        [maxTemplateCount, maxTemplateCount,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-caption" },
        });
        (Math.round((item.count / __VLS_ctx.maxTemplateCount) * 100));
        // @ts-ignore
        [maxTemplateCount,];
    }
    var __VLS_295;
}
var __VLS_285;
var __VLS_280;
const __VLS_303 = {}.VWindowItem;
/** @type {[typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, ]} */ ;
// @ts-ignore
VWindowItem;
// @ts-ignore
const __VLS_304 = __VLS_asFunctionalComponent(__VLS_303, new __VLS_303({
    value: "quality",
}));
const __VLS_305 = __VLS_304({
    value: "quality",
}, ...__VLS_functionalComponentArgsRest(__VLS_304));
const { default: __VLS_307 } = __VLS_306.slots;
const __VLS_308 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({}));
const __VLS_310 = __VLS_309({}, ...__VLS_functionalComponentArgsRest(__VLS_309));
const { default: __VLS_312 } = __VLS_311.slots;
if (__VLS_ctx.rel.loading.quality) {
    // @ts-ignore
    [rel,];
    const __VLS_313 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    VSkeletonLoader;
    // @ts-ignore
    const __VLS_314 = __VLS_asFunctionalComponent(__VLS_313, new __VLS_313({
        type: "card",
    }));
    const __VLS_315 = __VLS_314({
        type: "card",
    }, ...__VLS_functionalComponentArgsRest(__VLS_314));
}
else {
    const __VLS_318 = {}.VRow;
    /** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
    // @ts-ignore
    VRow;
    // @ts-ignore
    const __VLS_319 = __VLS_asFunctionalComponent(__VLS_318, new __VLS_318({
        dense: true,
    }));
    const __VLS_320 = __VLS_319({
        dense: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_319));
    const { default: __VLS_322 } = __VLS_321.slots;
    const __VLS_323 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_324 = __VLS_asFunctionalComponent(__VLS_323, new __VLS_323({
        cols: "12",
        md: "3",
        sm: "6",
    }));
    const __VLS_325 = __VLS_324({
        cols: "12",
        md: "3",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_324));
    const { default: __VLS_327 } = __VLS_326.slots;
    const __VLS_328 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    VCard;
    // @ts-ignore
    const __VLS_329 = __VLS_asFunctionalComponent(__VLS_328, new __VLS_328({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }));
    const __VLS_330 = __VLS_329({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }, ...__VLS_functionalComponentArgsRest(__VLS_329));
    const { default: __VLS_332 } = __VLS_331.slots;
    const __VLS_333 = {}.VCardItem;
    /** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
    // @ts-ignore
    VCardItem;
    // @ts-ignore
    const __VLS_334 = __VLS_asFunctionalComponent(__VLS_333, new __VLS_333({}));
    const __VLS_335 = __VLS_334({}, ...__VLS_functionalComponentArgsRest(__VLS_334));
    const { default: __VLS_337 } = __VLS_336.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-h5 font-weight-bold" },
    });
    (__VLS_ctx.rel.dataQuality?.total_clientes ?? 0);
    // @ts-ignore
    [rel,];
    var __VLS_336;
    var __VLS_331;
    var __VLS_326;
    const __VLS_338 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_339 = __VLS_asFunctionalComponent(__VLS_338, new __VLS_338({
        cols: "12",
        md: "3",
        sm: "6",
    }));
    const __VLS_340 = __VLS_339({
        cols: "12",
        md: "3",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_339));
    const { default: __VLS_342 } = __VLS_341.slots;
    const __VLS_343 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    VCard;
    // @ts-ignore
    const __VLS_344 = __VLS_asFunctionalComponent(__VLS_343, new __VLS_343({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }));
    const __VLS_345 = __VLS_344({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }, ...__VLS_functionalComponentArgsRest(__VLS_344));
    const { default: __VLS_347 } = __VLS_346.slots;
    const __VLS_348 = {}.VCardItem;
    /** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
    // @ts-ignore
    VCardItem;
    // @ts-ignore
    const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({}));
    const __VLS_350 = __VLS_349({}, ...__VLS_functionalComponentArgsRest(__VLS_349));
    const { default: __VLS_352 } = __VLS_351.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-h5 font-weight-bold" },
    });
    (__VLS_ctx.rel.dataQuality?.sem_cpf ?? 0);
    // @ts-ignore
    [rel,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    (__VLS_ctx.pct(__VLS_ctx.rel.dataQuality?.sem_cpf ?? 0, __VLS_ctx.rel.dataQuality?.total_clientes ?? 0));
    // @ts-ignore
    [rel, rel, pct,];
    var __VLS_351;
    var __VLS_346;
    var __VLS_341;
    const __VLS_353 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_354 = __VLS_asFunctionalComponent(__VLS_353, new __VLS_353({
        cols: "12",
        md: "3",
        sm: "6",
    }));
    const __VLS_355 = __VLS_354({
        cols: "12",
        md: "3",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_354));
    const { default: __VLS_357 } = __VLS_356.slots;
    const __VLS_358 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    VCard;
    // @ts-ignore
    const __VLS_359 = __VLS_asFunctionalComponent(__VLS_358, new __VLS_358({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }));
    const __VLS_360 = __VLS_359({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }, ...__VLS_functionalComponentArgsRest(__VLS_359));
    const { default: __VLS_362 } = __VLS_361.slots;
    const __VLS_363 = {}.VCardItem;
    /** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
    // @ts-ignore
    VCardItem;
    // @ts-ignore
    const __VLS_364 = __VLS_asFunctionalComponent(__VLS_363, new __VLS_363({}));
    const __VLS_365 = __VLS_364({}, ...__VLS_functionalComponentArgsRest(__VLS_364));
    const { default: __VLS_367 } = __VLS_366.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-h5 font-weight-bold" },
    });
    (__VLS_ctx.rel.dataQuality?.sem_endereco ?? 0);
    // @ts-ignore
    [rel,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    (__VLS_ctx.pct(__VLS_ctx.rel.dataQuality?.sem_endereco ?? 0, __VLS_ctx.rel.dataQuality?.total_clientes ?? 0));
    // @ts-ignore
    [rel, rel, pct,];
    var __VLS_366;
    var __VLS_361;
    var __VLS_356;
    const __VLS_368 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
        cols: "12",
        md: "3",
        sm: "6",
    }));
    const __VLS_370 = __VLS_369({
        cols: "12",
        md: "3",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_369));
    const { default: __VLS_372 } = __VLS_371.slots;
    const __VLS_373 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    VCard;
    // @ts-ignore
    const __VLS_374 = __VLS_asFunctionalComponent(__VLS_373, new __VLS_373({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }));
    const __VLS_375 = __VLS_374({
        ...{ class: "rounded-xl" },
        elevation: "1",
    }, ...__VLS_functionalComponentArgsRest(__VLS_374));
    const { default: __VLS_377 } = __VLS_376.slots;
    const __VLS_378 = {}.VCardItem;
    /** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
    // @ts-ignore
    VCardItem;
    // @ts-ignore
    const __VLS_379 = __VLS_asFunctionalComponent(__VLS_378, new __VLS_378({}));
    const __VLS_380 = __VLS_379({}, ...__VLS_functionalComponentArgsRest(__VLS_379));
    const { default: __VLS_382 } = __VLS_381.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-h5 font-weight-bold" },
    });
    (__VLS_ctx.rel.dataQuality?.com_conta_principal ?? 0);
    // @ts-ignore
    [rel,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-caption text-medium-emphasis" },
    });
    (__VLS_ctx.pct(__VLS_ctx.rel.dataQuality?.com_conta_principal ?? 0, __VLS_ctx.rel.dataQuality?.total_clientes ?? 0));
    // @ts-ignore
    [rel, rel, pct,];
    var __VLS_381;
    var __VLS_376;
    var __VLS_371;
    var __VLS_321;
}
var __VLS_311;
var __VLS_306;
const __VLS_383 = {}.VWindowItem;
/** @type {[typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, typeof __VLS_components.VWindowItem, typeof __VLS_components.vWindowItem, ]} */ ;
// @ts-ignore
VWindowItem;
// @ts-ignore
const __VLS_384 = __VLS_asFunctionalComponent(__VLS_383, new __VLS_383({
    value: "export",
}));
const __VLS_385 = __VLS_384({
    value: "export",
}, ...__VLS_functionalComponentArgsRest(__VLS_384));
const { default: __VLS_387 } = __VLS_386.slots;
const __VLS_388 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({}));
const __VLS_390 = __VLS_389({}, ...__VLS_functionalComponentArgsRest(__VLS_389));
const { default: __VLS_392 } = __VLS_391.slots;
const __VLS_393 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_394 = __VLS_asFunctionalComponent(__VLS_393, new __VLS_393({
    dense: true,
}));
const __VLS_395 = __VLS_394({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_394));
const { default: __VLS_397 } = __VLS_396.slots;
const __VLS_398 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_399 = __VLS_asFunctionalComponent(__VLS_398, new __VLS_398({
    cols: "12",
    md: "3",
    sm: "6",
}));
const __VLS_400 = __VLS_399({
    cols: "12",
    md: "3",
    sm: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_399));
const { default: __VLS_402 } = __VLS_401.slots;
const __VLS_403 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_404 = __VLS_asFunctionalComponent(__VLS_403, new __VLS_403({
    modelValue: (__VLS_ctx.exportForm.date_from),
    density: "comfortable",
    hideDetails: true,
    label: "Início",
    type: "date",
}));
const __VLS_405 = __VLS_404({
    modelValue: (__VLS_ctx.exportForm.date_from),
    density: "comfortable",
    hideDetails: true,
    label: "Início",
    type: "date",
}, ...__VLS_functionalComponentArgsRest(__VLS_404));
// @ts-ignore
[exportForm,];
var __VLS_401;
const __VLS_408 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
    cols: "12",
    md: "3",
    sm: "6",
}));
const __VLS_410 = __VLS_409({
    cols: "12",
    md: "3",
    sm: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_409));
const { default: __VLS_412 } = __VLS_411.slots;
const __VLS_413 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_414 = __VLS_asFunctionalComponent(__VLS_413, new __VLS_413({
    modelValue: (__VLS_ctx.exportForm.date_to),
    density: "comfortable",
    hideDetails: true,
    label: "Fim",
    type: "date",
}));
const __VLS_415 = __VLS_414({
    modelValue: (__VLS_ctx.exportForm.date_to),
    density: "comfortable",
    hideDetails: true,
    label: "Fim",
    type: "date",
}, ...__VLS_functionalComponentArgsRest(__VLS_414));
// @ts-ignore
[exportForm,];
var __VLS_411;
const __VLS_418 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_419 = __VLS_asFunctionalComponent(__VLS_418, new __VLS_418({
    cols: "12",
    md: "3",
    sm: "6",
}));
const __VLS_420 = __VLS_419({
    cols: "12",
    md: "3",
    sm: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_419));
const { default: __VLS_422 } = __VLS_421.slots;
const __VLS_423 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
VSelect;
// @ts-ignore
const __VLS_424 = __VLS_asFunctionalComponent(__VLS_423, new __VLS_423({
    modelValue: (__VLS_ctx.exportForm.template),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    items: (__VLS_ctx.templateItems()),
    label: "Template (opcional)",
}));
const __VLS_425 = __VLS_424({
    modelValue: (__VLS_ctx.exportForm.template),
    clearable: true,
    density: "comfortable",
    hideDetails: true,
    items: (__VLS_ctx.templateItems()),
    label: "Template (opcional)",
}, ...__VLS_functionalComponentArgsRest(__VLS_424));
// @ts-ignore
[exportForm, templateItems,];
var __VLS_421;
const __VLS_428 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_429 = __VLS_asFunctionalComponent(__VLS_428, new __VLS_428({
    cols: "12",
    md: "3",
    sm: "6",
}));
const __VLS_430 = __VLS_429({
    cols: "12",
    md: "3",
    sm: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_429));
const { default: __VLS_432 } = __VLS_431.slots;
const __VLS_433 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_434 = __VLS_asFunctionalComponent(__VLS_433, new __VLS_433({
    modelValue: (__VLS_ctx.exportForm.clienteId),
    modelModifiers: { number: true, },
    density: "comfortable",
    hideDetails: true,
    label: "Cliente ID (opcional)",
    min: "1",
    type: "number",
}));
const __VLS_435 = __VLS_434({
    modelValue: (__VLS_ctx.exportForm.clienteId),
    modelModifiers: { number: true, },
    density: "comfortable",
    hideDetails: true,
    label: "Cliente ID (opcional)",
    min: "1",
    type: "number",
}, ...__VLS_functionalComponentArgsRest(__VLS_434));
// @ts-ignore
[exportForm,];
var __VLS_431;
var __VLS_396;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-3 d-flex gap-2" },
});
const __VLS_438 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_439 = __VLS_asFunctionalComponent(__VLS_438, new __VLS_438({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rel.loading.export),
    prependIcon: "mdi-download",
}));
const __VLS_440 = __VLS_439({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.rel.loading.export),
    prependIcon: "mdi-download",
}, ...__VLS_functionalComponentArgsRest(__VLS_439));
let __VLS_442;
let __VLS_443;
const __VLS_444 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.rel.exportPetitionsCSV({
                date_from: __VLS_ctx.exportForm.date_from || undefined,
                date_to: __VLS_ctx.exportForm.date_to || undefined,
                template: __VLS_ctx.exportForm.template || undefined,
                cliente: __VLS_ctx.exportForm.clienteId || undefined,
            });
            // @ts-ignore
            [rel, rel, exportForm, exportForm, exportForm, exportForm,];
        } });
const { default: __VLS_445 } = __VLS_441.slots;
var __VLS_441;
const __VLS_446 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_447 = __VLS_asFunctionalComponent(__VLS_446, new __VLS_446({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_448 = __VLS_447({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_447));
let __VLS_450;
let __VLS_451;
const __VLS_452 = ({ click: {} },
    { onClick: (() => {
            __VLS_ctx.exportForm.template = undefined;
            __VLS_ctx.exportForm.clienteId = undefined;
        }) });
const { default: __VLS_453 } = __VLS_449.slots;
// @ts-ignore
[exportForm, exportForm,];
var __VLS_449;
var __VLS_391;
var __VLS_386;
var __VLS_255;
var __VLS_200;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            rel: rel,
            filters: filters,
            bucketItems: bucketItems,
            maxTemplateCount: maxTemplateCount,
            totalClientes: totalClientes,
            totalPeticoesCriadas: totalPeticoesCriadas,
            totalPeticoesAtualizadas: totalPeticoesAtualizadas,
            sparkClientes: sparkClientes,
            sparkPCriadas: sparkPCriadas,
            sparkPAtualizadas: sparkPAtualizadas,
            tab: tab,
            exportForm: exportForm,
            templateItems: templateItems,
            doRefresh: doRefresh,
            pct: pct,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
