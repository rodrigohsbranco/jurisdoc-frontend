import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

const alrTheme = {
  dark: false,
  colors: {
    primary: '#0F2B46',
    secondary: '#CDA660',
    surface: '#FFFFFF',
    background: '#F7F9FC',
    info: '#1976D2',
    success: '#2E7D32',
    warning: '#ED6C02',
    error: '#D32F2F',
  },
}

export default createVuetify({
  defaults: {
    VCard: {
      rounded: 'lg',
      elevation: 1,
    },
    VBtn: {
      rounded: 'lg',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VCombobox: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VAutocomplete: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VFileInput: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VSwitch: {
      color: 'secondary',
      hideDetails: true,
      inset: true,
    },
    VDataTable: {
      itemsPerPage: 10,
      itemsPerPageOptions: [
        { value: 10, title: '10' },
        { value: 20, title: '20' },
        { value: 50, title: '50' },
        { value: 100, title: '100' },
        { value: -1, title: 'Todos' },
      ],
      hover: true,
    },
    VDialog: {
      transition: 'dialog-bottom-transition',
    },
    VAlert: {
      variant: 'tonal',
      rounded: 'lg',
      border: 'start',
    },
    VChip: {
      rounded: 'lg',
      size: 'small',
    },
  },
  theme: {
    defaultTheme: 'alrTheme',
    themes: { alrTheme },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
})
