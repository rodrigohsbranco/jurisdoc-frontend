import { computed, onMounted } from 'vue';
import { useClientesStore } from '@/stores/clientes';
import { usePeticoesStore } from '@/stores/peticoes';
import { useTemplatesStore } from '@/stores/templates';
// ---------- stores ----------
const clientes = useClientesStore();
const peticoes = usePeticoesStore();
const templates = useTemplatesStore();
// ---------- carregar dados ----------
async function loadDashboard() {
    // Clientes: últimos cadastrados (e já nos dá count)
    await clientes.fetchList({ page: 1, page_size: 5, ordering: '-criado_em' });
    // Petições: últimas criadas (e já nos dá count)
    await peticoes.fetch({ page: 1, page_size: 5, ordering: '-created_at' });
    // Templates: só precisamos da contagem
    // (seu store de templates já existia; usamos page_size=1 p/ economizar)
    await templates.fetch({ page: 1, page_size: 1 });
}
onMounted(loadDashboard);
// ---------- KPIs (valores reais) ----------
const kpis = computed(() => {
    const list = [
        {
            label: 'Clientes',
            value: clientes.count || 0,
            icon: 'mdi-account-group',
            color: 'primary',
        },
        {
            label: 'Petições',
            value: peticoes.count || 0,
            icon: 'mdi-file-document',
            color: 'secondary',
        },
        {
            label: 'Templates',
            // alguns stores não expõem count; caímos no length como fallback
            value: templates.count ?? templates.items.length ?? 0,
            icon: 'mdi-file-word',
            color: 'indigo',
        },
        // {
        //   label: 'Pendências',
        //   value: 0,
        //   icon: 'mdi-alert-circle',
        //   color: 'warning',
        // },
    ];
    return list;
});
// ---------- ações rápidas ----------
const quickActions = [
    {
        label: 'Novo Cliente',
        icon: 'mdi-account-plus',
        color: 'primary',
        to: { name: 'clientes' },
    },
    {
        label: 'Nova Petição',
        icon: 'mdi-file-plus',
        color: 'secondary',
        to: { name: 'peticoes' },
    },
    {
        label: 'Novo Template',
        icon: 'mdi-file-word',
        color: 'indigo',
        to: { name: 'templates' },
    },
    {
        label: 'Relatórios',
        icon: 'mdi-chart-bar',
        color: 'success',
        to: { name: 'reports' },
    },
];
// ---------- helpers ----------
function rt(dateIso) {
    if (!dateIso)
        return '';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime()))
        return '';
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
    const sec = 1000;
    const min = 60 * sec;
    const hour = 60 * min;
    const day = 24 * hour;
    if (abs < 30 * sec)
        return 'agora';
    if (abs < hour)
        return rtf.format(Math.round(diff / min), 'minute');
    if (abs < day)
        return rtf.format(Math.round(diff / hour), 'hour');
    return rtf.format(Math.round(diff / day), 'day');
}
function clienteNome(clienteId, fallback) {
    const c = clientes.items.find(x => x.id === Number(clienteId));
    return c?.nome_completo || fallback || `#${clienteId ?? ''}`;
}
const recentActivities = computed(() => {
    const events = [];
    // Petições criadas
    for (const p of peticoes.items) {
        if (p.created_at) {
            events.push({
                icon: 'mdi-file-document',
                title: 'Petição criada',
                subtitle: `${clienteNome(p.cliente, p.cliente_nome || null)} — ${rt(p.created_at)}`,
                when: p.created_at,
            });
        }
        // Petições atualizadas
        if (p.updated_at) {
            events.push({
                icon: 'mdi-pencil',
                title: 'Petição atualizada',
                subtitle: `${clienteNome(p.cliente, p.cliente_nome || null)} — ${rt(p.updated_at)}`,
                when: p.updated_at,
            });
        }
    }
    // Novos clientes
    for (const c of clientes.items) {
        if (c.criado_em) {
            events.push({
                icon: 'mdi-account-plus',
                title: 'Novo cliente',
                subtitle: `${c.nome_completo} — ${rt(c.criado_em)}`,
                when: c.criado_em,
            });
        }
    }
    // Ordena por data desc e limita
    return events
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 8);
});
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
const __VLS_6 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ class: "mb-4" },
    dense: true,
}));
const __VLS_8 = __VLS_7({
    ...{ class: "mb-4" },
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_10 } = __VLS_9.slots;
for (const [k] of __VLS_getVForSourceType((__VLS_ctx.kpis))) {
    // @ts-ignore
    [kpis,];
    const __VLS_11 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
        key: (k.label),
        cols: "12",
        md: "4",
        sm: "6",
    }));
    const __VLS_13 = __VLS_12({
        key: (k.label),
        cols: "12",
        md: "4",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    const { default: __VLS_15 } = __VLS_14.slots;
    const __VLS_16 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    VCard;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ class: "text-white rounded-xl" },
        color: (k.color),
        elevation: "2",
        variant: "flat",
    }));
    const __VLS_18 = __VLS_17({
        ...{ class: "text-white rounded-xl" },
        color: (k.color),
        elevation: "2",
        variant: "flat",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    const { default: __VLS_20 } = __VLS_19.slots;
    const __VLS_21 = {}.VCardItem;
    /** @type {[typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, typeof __VLS_components.VCardItem, typeof __VLS_components.vCardItem, ]} */ ;
    // @ts-ignore
    VCardItem;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({}));
    const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
    const { default: __VLS_25 } = __VLS_24.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "d-flex align-center justify-space-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption opacity-80" },
    });
    (k.label);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-h5 font-weight-bold" },
    });
    (k.value);
    const __VLS_26 = {}.VAvatar;
    /** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
    // @ts-ignore
    VAvatar;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
        ...{ class: "bg-white bg-opacity-20" },
        size: "40",
    }));
    const __VLS_28 = __VLS_27({
        ...{ class: "bg-white bg-opacity-20" },
        size: "40",
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    const { default: __VLS_30 } = __VLS_29.slots;
    const __VLS_31 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
        color: "white",
        icon: (k.icon),
        size: "26",
    }));
    const __VLS_33 = __VLS_32({
        color: "white",
        icon: (k.icon),
        size: "26",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    var __VLS_29;
    var __VLS_24;
    var __VLS_19;
    var __VLS_14;
}
var __VLS_9;
const __VLS_36 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    dense: true,
}));
const __VLS_38 = __VLS_37({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const { default: __VLS_40 } = __VLS_39.slots;
const __VLS_41 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    cols: "12",
    md: "8",
}));
const __VLS_43 = __VLS_42({
    cols: "12",
    md: "8",
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
const { default: __VLS_45 } = __VLS_44.slots;
const __VLS_46 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_48 = __VLS_47({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
const { default: __VLS_50 } = __VLS_49.slots;
const __VLS_51 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({
    ...{ class: "d-flex align-center" },
}));
const __VLS_53 = __VLS_52({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_52));
const { default: __VLS_55 } = __VLS_54.slots;
const __VLS_56 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ class: "mr-2" },
    icon: "mdi-flash",
}));
const __VLS_58 = __VLS_57({
    ...{ class: "mr-2" },
    icon: "mdi-flash",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
var __VLS_54;
const __VLS_61 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({}));
const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
const { default: __VLS_65 } = __VLS_64.slots;
const __VLS_66 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
VRow;
// @ts-ignore
const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
    dense: true,
}));
const __VLS_68 = __VLS_67({
    dense: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_67));
const { default: __VLS_70 } = __VLS_69.slots;
for (const [a] of __VLS_getVForSourceType((__VLS_ctx.quickActions))) {
    // @ts-ignore
    [quickActions,];
    const __VLS_71 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    VCol;
    // @ts-ignore
    const __VLS_72 = __VLS_asFunctionalComponent(__VLS_71, new __VLS_71({
        key: (a.label),
        cols: "12",
        md: "6",
        sm: "6",
    }));
    const __VLS_73 = __VLS_72({
        key: (a.label),
        cols: "12",
        md: "6",
        sm: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_72));
    const { default: __VLS_75 } = __VLS_74.slots;
    const __VLS_76 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        block: true,
        ...{ class: "text-none py-6" },
        color: (a.color),
        size: "large",
        to: (a.to),
        variant: "tonal",
    }));
    const __VLS_78 = __VLS_77({
        block: true,
        ...{ class: "text-none py-6" },
        color: (a.color),
        size: "large",
        to: (a.to),
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    const { default: __VLS_80 } = __VLS_79.slots;
    const __VLS_81 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({
        icon: (a.icon),
        start: true,
    }));
    const __VLS_83 = __VLS_82({
        icon: (a.icon),
        start: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    (a.label);
    var __VLS_79;
    var __VLS_74;
}
var __VLS_69;
var __VLS_64;
var __VLS_49;
var __VLS_44;
const __VLS_86 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
VCol;
// @ts-ignore
const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
    cols: "12",
    md: "4",
}));
const __VLS_88 = __VLS_87({
    cols: "12",
    md: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_87));
const { default: __VLS_90 } = __VLS_89.slots;
const __VLS_91 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
    ...{ class: "rounded-xl" },
    elevation: "2",
}));
const __VLS_93 = __VLS_92({
    ...{ class: "rounded-xl" },
    elevation: "2",
}, ...__VLS_functionalComponentArgsRest(__VLS_92));
const { default: __VLS_95 } = __VLS_94.slots;
const __VLS_96 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
VCardTitle;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    ...{ class: "d-flex align-center" },
}));
const __VLS_98 = __VLS_97({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
const { default: __VLS_100 } = __VLS_99.slots;
const __VLS_101 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
    ...{ class: "mr-2" },
    icon: "mdi-history",
}));
const __VLS_103 = __VLS_102({
    ...{ class: "mr-2" },
    icon: "mdi-history",
}, ...__VLS_functionalComponentArgsRest(__VLS_102));
var __VLS_99;
const __VLS_106 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
VDivider;
// @ts-ignore
const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({}));
const __VLS_108 = __VLS_107({}, ...__VLS_functionalComponentArgsRest(__VLS_107));
if (__VLS_ctx.recentActivities.length > 0) {
    // @ts-ignore
    [recentActivities,];
    const __VLS_111 = {}.VList;
    /** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
    // @ts-ignore
    VList;
    // @ts-ignore
    const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({}));
    const __VLS_113 = __VLS_112({}, ...__VLS_functionalComponentArgsRest(__VLS_112));
    const { default: __VLS_115 } = __VLS_114.slots;
    for (const [ev, i] of __VLS_getVForSourceType((__VLS_ctx.recentActivities))) {
        // @ts-ignore
        [recentActivities,];
        const __VLS_116 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        VListItem;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            key: (i),
            subtitle: (ev.subtitle),
            title: (ev.title),
        }));
        const __VLS_118 = __VLS_117({
            key: (i),
            subtitle: (ev.subtitle),
            title: (ev.title),
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        const { default: __VLS_120 } = __VLS_119.slots;
        {
            const { prepend: __VLS_121 } = __VLS_119.slots;
            const __VLS_122 = {}.VAvatar;
            /** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
            // @ts-ignore
            VAvatar;
            // @ts-ignore
            const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({
                ...{ class: "mr-2" },
                color: "primary",
                size: "28",
                variant: "tonal",
            }));
            const __VLS_124 = __VLS_123({
                ...{ class: "mr-2" },
                color: "primary",
                size: "28",
                variant: "tonal",
            }, ...__VLS_functionalComponentArgsRest(__VLS_123));
            const { default: __VLS_126 } = __VLS_125.slots;
            const __VLS_127 = {}.VIcon;
            /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
            // @ts-ignore
            VIcon;
            // @ts-ignore
            const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
                icon: (ev.icon),
                size: "18",
            }));
            const __VLS_129 = __VLS_128({
                icon: (ev.icon),
                size: "18",
            }, ...__VLS_functionalComponentArgsRest(__VLS_128));
            var __VLS_125;
        }
        var __VLS_119;
    }
    var __VLS_114;
}
else {
    const __VLS_132 = {}.VSheet;
    /** @type {[typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, typeof __VLS_components.VSheet, typeof __VLS_components.vSheet, ]} */ ;
    // @ts-ignore
    VSheet;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }));
    const __VLS_134 = __VLS_133({
        ...{ class: "pa-6 text-center text-medium-emphasis" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    const { default: __VLS_136 } = __VLS_135.slots;
    var __VLS_135;
}
var __VLS_94;
var __VLS_89;
var __VLS_39;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-space-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-opacity-20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-none']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            kpis: kpis,
            quickActions: quickActions,
            recentActivities: recentActivities,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
