import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import bg from '@/assets/bg-login.jpg'; // <= coloque sua imagem em src/assets/bg-login.jpg
import { useAuthStore } from '@/stores/auth';
const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
// background inline (garante resolução correta do path pelo bundler)
const bgCss = computed(() => ({
    backgroundImage: `url(${bg})`,
}));
// Regras Vuetify (retornam true ou string com a mensagem)
const rules = {
    required: (v) => (!!v && v.trim().length > 0) || 'Campo obrigatório',
    minUser: (v) => v?.trim().length >= 3 || 'Mínimo de 3 caracteres',
    minPass: (v) => v?.length >= 6 || 'Mínimo de 6 caracteres',
};
const canSubmit = computed(() => !!username.value.trim() && password.value.length >= 6 && !loading.value);
function normalizeUser(u) {
    return u.trim();
}
function mapError(e) {
    const status = e?.response?.status;
    const detail = e?.response?.data?.detail;
    if (detail)
        return String(detail);
    if (status === 401)
        return 'Usuário ou senha inválidos.';
    if (status === 403)
        return 'Acesso negado.';
    if (!e?.response)
        return 'Não foi possível conectar à API. Verifique se o backend está no ar.';
    return 'Falha no login. Verifique as credenciais.';
}
async function onSubmit() {
    if (!canSubmit.value)
        return;
    error.value = '';
    loading.value = true;
    try {
        await auth.login(normalizeUser(username.value), password.value);
        const redirect = route.query.redirect || '/';
        router.replace(redirect);
    }
    catch (error_) {
        error.value = mapError(error_);
    }
    finally {
        password.value = '';
        loading.value = false;
    }
}
onMounted(() => {
    if (auth.isAuthenticated) {
        const redirect = route.query.redirect || '/';
        router.replace(redirect);
    }
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
const __VLS_6 = {}.VMain;
/** @type {[typeof __VLS_components.VMain, typeof __VLS_components.vMain, typeof __VLS_components.VMain, typeof __VLS_components.vMain, ]} */ ;
// @ts-ignore
VMain;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ class: "login-main d-flex align-center justify-center" },
}));
const __VLS_8 = __VLS_7({
    ...{ class: "login-main d-flex align-center justify-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_10 } = __VLS_9.slots;
__VLS_asFunctionalElement(__VLS_elements.div)({
    ...{ class: "login-bg" },
    ...{ style: (__VLS_ctx.bgCss) },
});
// @ts-ignore
[bgCss,];
__VLS_asFunctionalElement(__VLS_elements.div)({
    ...{ class: "login-scrim" },
});
const __VLS_11 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
VCard;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    ...{ class: "login-card rounded-xl" },
    elevation: "8",
    width: "420",
}));
const __VLS_13 = __VLS_12({
    ...{ class: "login-card rounded-xl" },
    elevation: "8",
    width: "420",
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_15 } = __VLS_14.slots;
const __VLS_16 = {}.VToolbar;
/** @type {[typeof __VLS_components.VToolbar, typeof __VLS_components.vToolbar, typeof __VLS_components.VToolbar, typeof __VLS_components.vToolbar, ]} */ ;
// @ts-ignore
VToolbar;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    color: "transparent",
    flat: true,
}));
const __VLS_18 = __VLS_17({
    color: "transparent",
    flat: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const { default: __VLS_20 } = __VLS_19.slots;
const __VLS_21 = {}.VToolbarTitle;
/** @type {[typeof __VLS_components.VToolbarTitle, typeof __VLS_components.vToolbarTitle, typeof __VLS_components.VToolbarTitle, typeof __VLS_components.vToolbarTitle, ]} */ ;
// @ts-ignore
VToolbarTitle;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({}));
const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const { default: __VLS_25 } = __VLS_24.slots;
var __VLS_24;
var __VLS_19;
const __VLS_26 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
VCardText;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({}));
const __VLS_28 = __VLS_27({}, ...__VLS_functionalComponentArgsRest(__VLS_27));
const { default: __VLS_30 } = __VLS_29.slots;
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    const __VLS_31 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    VAlert;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
        ...{ class: "mb-4" },
        density: "comfortable",
        type: "error",
        variant: "tonal",
    }));
    const __VLS_33 = __VLS_32({
        ...{ class: "mb-4" },
        density: "comfortable",
        type: "error",
        variant: "tonal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    const { default: __VLS_35 } = __VLS_34.slots;
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
    var __VLS_34;
}
const __VLS_36 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
VForm;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ 'onSubmit': {} },
}));
const __VLS_38 = __VLS_37({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_40;
let __VLS_41;
const __VLS_42 = ({ submit: {} },
    { onSubmit: (__VLS_ctx.onSubmit) });
const { default: __VLS_43 } = __VLS_39.slots;
// @ts-ignore
[onSubmit,];
const __VLS_44 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.username),
    modelModifiers: { trim: true, },
    autocomplete: "username",
    density: "comfortable",
    label: "Usuário",
    required: true,
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minUser]),
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.username),
    modelModifiers: { trim: true, },
    autocomplete: "username",
    density: "comfortable",
    label: "Usuário",
    required: true,
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minUser]),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
// @ts-ignore
[username, rules, rules,];
const __VLS_49 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
VTextField;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
    ...{ 'onClick:appendInner': {} },
    modelValue: (__VLS_ctx.password),
    appendInnerIcon: (__VLS_ctx.showPassword ? 'mdi-eye-off' : 'mdi-eye'),
    autocomplete: "current-password",
    density: "comfortable",
    label: "Senha",
    required: true,
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minPass]),
    type: (__VLS_ctx.showPassword ? 'text' : 'password'),
}));
const __VLS_51 = __VLS_50({
    ...{ 'onClick:appendInner': {} },
    modelValue: (__VLS_ctx.password),
    appendInnerIcon: (__VLS_ctx.showPassword ? 'mdi-eye-off' : 'mdi-eye'),
    autocomplete: "current-password",
    density: "comfortable",
    label: "Senha",
    required: true,
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minPass]),
    type: (__VLS_ctx.showPassword ? 'text' : 'password'),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
let __VLS_53;
let __VLS_54;
const __VLS_55 = ({ 'click:appendInner': {} },
    { 'onClick:appendInner': (...[$event]) => {
            __VLS_ctx.showPassword = !__VLS_ctx.showPassword;
            // @ts-ignore
            [rules, rules, password, showPassword, showPassword, showPassword, showPassword,];
        } });
var __VLS_52;
const __VLS_57 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
VBtn;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    block: true,
    ...{ class: "mt-2" },
    color: "primary",
    disabled: (!__VLS_ctx.canSubmit),
    loading: (__VLS_ctx.loading),
    type: "submit",
}));
const __VLS_59 = __VLS_58({
    block: true,
    ...{ class: "mt-2" },
    color: "primary",
    disabled: (!__VLS_ctx.canSubmit),
    loading: (__VLS_ctx.loading),
    type: "submit",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
const { default: __VLS_61 } = __VLS_60.slots;
// @ts-ignore
[canSubmit, loading,];
var __VLS_60;
var __VLS_39;
var __VLS_29;
var __VLS_14;
var __VLS_9;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['login-main']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['login-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['login-scrim']} */ ;
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            username: username,
            password: password,
            showPassword: showPassword,
            loading: loading,
            error: error,
            bgCss: bgCss,
            rules: rules,
            canSubmit: canSubmit,
            onSubmit: onSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
    },
});
; /* PartiallyEnd: #4569/main.vue */
