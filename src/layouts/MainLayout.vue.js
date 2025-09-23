import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
const drawer = ref(true);
const rail = ref(false); // modo estreito (retraído)
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const navItems = [
    { title: 'Dashboard', icon: 'mdi-view-dashboard', to: { name: 'dashboard' } },
    { title: 'Usuários', icon: 'mdi-account-cog', to: { name: 'usuarios' } },
    { title: 'Clientes', icon: 'mdi-account-group', to: { name: 'clientes' } },
    { title: 'Templates', icon: 'mdi-file-word', to: { name: 'templates' } },
    { title: 'Petições', icon: 'mdi-file-document', to: { name: 'peticoes' } },
    { title: 'Relatórios', icon: 'mdi-chart-bar', to: { name: 'reports' } },
];
function logout() {
    auth.logout(router);
}
// ÚNICO controle: hambúrguer
function toggleNav() {
    if (!drawer.value) {
        drawer.value = true;
        return;
    }
    rail.value = !rail.value;
}
const pageTitle = computed(() => {
    return (route.meta?.title || route.name || 'Application');
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.VApp;
/** @type {[typeof __VLS_components.VApp, typeof __VLS_components.vApp, typeof __VLS_components.VApp, typeof __VLS_components.vApp, ]} */ ;
// @ts-ignore
VApp;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
const { default: __VLS_5 } = __VLS_3.slots;
const __VLS_6 = {}.VNavigationDrawer;
/** @type {[typeof __VLS_components.VNavigationDrawer, typeof __VLS_components.vNavigationDrawer, typeof __VLS_components.VNavigationDrawer, typeof __VLS_components.vNavigationDrawer, ]} */ ;
// @ts-ignore
VNavigationDrawer;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    modelValue: (__VLS_ctx.drawer),
    app: true,
    ...{ class: "text-white" },
    color: "primary",
    elevation: "2",
    rail: (__VLS_ctx.rail),
}));
const __VLS_8 = __VLS_7({
    modelValue: (__VLS_ctx.drawer),
    app: true,
    ...{ class: "text-white" },
    color: "primary",
    elevation: "2",
    rail: (__VLS_ctx.rail),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_10 } = __VLS_9.slots;
// @ts-ignore
[drawer, rail,];
const __VLS_11 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
VListItem;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    ...{ class: "py-4" },
}));
const __VLS_13 = __VLS_12({
    ...{ class: "py-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_15 } = __VLS_14.slots;
{
    const { prepend: __VLS_16 } = __VLS_14.slots;
    const __VLS_17 = {}.VAvatar;
    /** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
    // @ts-ignore
    VAvatar;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        size: "40",
    }));
    const __VLS_19 = __VLS_18({
        size: "40",
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    const { default: __VLS_21 } = __VLS_20.slots;
    const __VLS_22 = {}.VImg;
    /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
    // @ts-ignore
    VImg;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
        alt: "ALR",
        cover: true,
        src: "@/assets/logo-alr.jpg",
    }));
    const __VLS_24 = __VLS_23({
        alt: "ALR",
        cover: true,
        src: "@/assets/logo-alr.jpg",
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    var __VLS_20;
}
const __VLS_27 = {}.VListItemTitle;
/** @type {[typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, ]} */ ;
// @ts-ignore
VListItemTitle;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
    ...{ class: "font-weight-bold" },
}));
const __VLS_29 = __VLS_28({
    ...{ class: "font-weight-bold" },
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
const { default: __VLS_31 } = __VLS_30.slots;
var __VLS_30;
var __VLS_14;
const __VLS_32 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
VDivider;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    opacity: "0.2",
}));
const __VLS_34 = __VLS_33({
    opacity: "0.2",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_37 = {}.VList;
/** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
// @ts-ignore
VList;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    ...{ class: "mt-2" },
    density: "comfortable",
    nav: true,
}));
const __VLS_39 = __VLS_38({
    ...{ class: "mt-2" },
    density: "comfortable",
    nav: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
const { default: __VLS_41 } = __VLS_40.slots;
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.navItems))) {
    // @ts-ignore
    [navItems,];
    const __VLS_42 = {}.VListItem;
    /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
    // @ts-ignore
    VListItem;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
        key: (item.title),
        active: (__VLS_ctx.route.name === item.to?.name),
        color: "secondary",
        prependIcon: (item.icon),
        rounded: "lg",
        to: (item.to),
    }));
    const __VLS_44 = __VLS_43({
        key: (item.title),
        active: (__VLS_ctx.route.name === item.to?.name),
        color: "secondary",
        prependIcon: (item.icon),
        rounded: "lg",
        to: (item.to),
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    const { default: __VLS_46 } = __VLS_45.slots;
    // @ts-ignore
    [route,];
    const __VLS_47 = {}.VListItemTitle;
    /** @type {[typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, ]} */ ;
    // @ts-ignore
    VListItemTitle;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({}));
    const __VLS_49 = __VLS_48({}, ...__VLS_functionalComponentArgsRest(__VLS_48));
    const { default: __VLS_51 } = __VLS_50.slots;
    (item.title);
    var __VLS_50;
    var __VLS_45;
}
var __VLS_40;
{
    const { append: __VLS_52 } = __VLS_9.slots;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "px-4 pb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-caption mb-2" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.rail) }, null, null);
    // @ts-ignore
    [rail, vShow,];
    __VLS_asFunctionalElement(__VLS_elements.strong, __VLS_elements.strong)({});
    (__VLS_ctx.auth.username);
    // @ts-ignore
    [auth,];
    const __VLS_53 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    VBtn;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
        ...{ 'onClick': {} },
        block: true,
        color: "secondary",
        variant: "elevated",
    }));
    const __VLS_55 = __VLS_54({
        ...{ 'onClick': {} },
        block: true,
        color: "secondary",
        variant: "elevated",
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
    let __VLS_57;
    let __VLS_58;
    const __VLS_59 = ({ click: {} },
        { onClick: (__VLS_ctx.logout) });
    const { default: __VLS_60 } = __VLS_56.slots;
    // @ts-ignore
    [logout,];
    const __VLS_61 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    VIcon;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
        icon: "mdi-logout",
        start: true,
    }));
    const __VLS_63 = __VLS_62({
        icon: "mdi-logout",
        start: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    var __VLS_56;
}
var __VLS_9;
const __VLS_66 = {}.VAppBar;
/** @type {[typeof __VLS_components.VAppBar, typeof __VLS_components.vAppBar, typeof __VLS_components.VAppBar, typeof __VLS_components.vAppBar, ]} */ ;
// @ts-ignore
VAppBar;
// @ts-ignore
const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
    app: true,
    color: "surface",
    elevation: "1",
    flat: true,
}));
const __VLS_68 = __VLS_67({
    app: true,
    color: "surface",
    elevation: "1",
    flat: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_67));
const { default: __VLS_70 } = __VLS_69.slots;
const __VLS_71 = {}.VAppBarNavIcon;
/** @type {[typeof __VLS_components.VAppBarNavIcon, typeof __VLS_components.vAppBarNavIcon, ]} */ ;
// @ts-ignore
VAppBarNavIcon;
// @ts-ignore
const __VLS_72 = __VLS_asFunctionalComponent(__VLS_71, new __VLS_71({
    ...{ 'onClick': {} },
}));
const __VLS_73 = __VLS_72({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_72));
let __VLS_75;
let __VLS_76;
const __VLS_77 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleNav) });
// @ts-ignore
[toggleNav,];
var __VLS_74;
const __VLS_79 = {}.VToolbarTitle;
/** @type {[typeof __VLS_components.VToolbarTitle, typeof __VLS_components.vToolbarTitle, typeof __VLS_components.VToolbarTitle, typeof __VLS_components.vToolbarTitle, ]} */ ;
// @ts-ignore
VToolbarTitle;
// @ts-ignore
const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({}));
const __VLS_81 = __VLS_80({}, ...__VLS_functionalComponentArgsRest(__VLS_80));
const { default: __VLS_83 } = __VLS_82.slots;
(__VLS_ctx.pageTitle);
// @ts-ignore
[pageTitle,];
var __VLS_82;
const __VLS_84 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
VSpacer;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
const __VLS_89 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_90 = __VLS_asFunctionalComponent(__VLS_89, new __VLS_89({
    icon: true,
    variant: "text",
}));
const __VLS_91 = __VLS_90({
    icon: true,
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_90));
const { default: __VLS_93 } = __VLS_92.slots;
const __VLS_94 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
    icon: "mdi-bell-outline",
}));
const __VLS_96 = __VLS_95({
    icon: "mdi-bell-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_95));
var __VLS_92;
const __VLS_99 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({
    icon: true,
    variant: "text",
}));
const __VLS_101 = __VLS_100({
    icon: true,
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_100));
const { default: __VLS_103 } = __VLS_102.slots;
const __VLS_104 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
VIcon;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    icon: "mdi-help-circle-outline",
}));
const __VLS_106 = __VLS_105({
    icon: "mdi-help-circle-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
var __VLS_102;
var __VLS_69;
const __VLS_109 = {}.VMain;
/** @type {[typeof __VLS_components.VMain, typeof __VLS_components.vMain, typeof __VLS_components.VMain, typeof __VLS_components.vMain, ]} */ ;
// @ts-ignore
VMain;
// @ts-ignore
const __VLS_110 = __VLS_asFunctionalComponent(__VLS_109, new __VLS_109({}));
const __VLS_111 = __VLS_110({}, ...__VLS_functionalComponentArgsRest(__VLS_110));
const { default: __VLS_113 } = __VLS_112.slots;
const __VLS_114 = {}.VContainer;
/** @type {[typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, ]} */ ;
// @ts-ignore
VContainer;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
    ...{ class: "py-6" },
    fluid: true,
}));
const __VLS_116 = __VLS_115({
    ...{ class: "py-6" },
    fluid: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
const { default: __VLS_118 } = __VLS_117.slots;
const __VLS_119 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({}));
const __VLS_121 = __VLS_120({}, ...__VLS_functionalComponentArgsRest(__VLS_120));
var __VLS_117;
var __VLS_112;
const __VLS_124 = {}.VFooter;
/** @type {[typeof __VLS_components.VFooter, typeof __VLS_components.vFooter, typeof __VLS_components.VFooter, typeof __VLS_components.vFooter, ]} */ ;
// @ts-ignore
VFooter;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    app: true,
    color: "surface",
    elevation: "1",
}));
const __VLS_126 = __VLS_125({
    app: true,
    color: "surface",
    elevation: "1",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
const { default: __VLS_128 } = __VLS_127.slots;
const __VLS_129 = {}.VContainer;
/** @type {[typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, ]} */ ;
// @ts-ignore
VContainer;
// @ts-ignore
const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
    ...{ class: "py-2 text-caption" },
}));
const __VLS_131 = __VLS_130({
    ...{ class: "py-2 text-caption" },
}, ...__VLS_functionalComponentArgsRest(__VLS_130));
const { default: __VLS_133 } = __VLS_132.slots;
(new Date().getFullYear());
var __VLS_132;
var __VLS_127;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            drawer: drawer,
            rail: rail,
            route: route,
            auth: auth,
            navItems: navItems,
            logout: logout,
            toggleNav: toggleNav,
            pageTitle: pageTitle,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
