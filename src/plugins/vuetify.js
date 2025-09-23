import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
// src/plugins/vuetify.ts
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
// Paleta baseada na sua logo
const alrTheme = {
    dark: false,
    colors: {
        primary: '#0F2B46', // azul institucional
        secondary: '#CDA660', // dourado
        surface: '#FFFFFF',
        background: '#F7F9FC',
        info: '#1976D2',
        success: '#2E7D32',
        warning: '#ED6C02',
        error: '#D32F2F',
    },
};
export default createVuetify({
    theme: {
        defaultTheme: 'alrTheme',
        themes: { alrTheme },
    },
    icons: {
        defaultSet: 'mdi',
        aliases,
        sets: { mdi },
    },
});
