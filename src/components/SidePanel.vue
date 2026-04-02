<script setup lang="ts">
defineProps<{
  modelValue: boolean
  width?: number | string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    class="side-panel"
    location="right"
    temporary
    :width="width ?? 560"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="side-panel-layout">
      <!-- Header -->
      <div class="side-panel-header pa-5 pb-4">
        <slot name="header" />
      </div>

      <v-divider />

      <!-- Conteúdo scrollável -->
      <div class="side-panel-content px-5 pb-5 pt-6">
        <slot />
      </div>

      <!-- Footer fixo -->
      <div class="side-panel-footer">
        <v-divider />
        <div class="d-flex align-center justify-end ga-2 pa-4">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<style scoped>
.side-panel {
  position: fixed !important;
  height: 100vh !important;
  top: 0 !important;
  z-index: 2100 !important;
}

.side-panel-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.side-panel-header {
  flex-shrink: 0;
}

.side-panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.side-panel-footer {
  flex-shrink: 0;
}
</style>

<style>
/* Inputs dentro do SidePanel: compactos e com espaçamento reduzido */
.side-panel-content .v-input {
  --v-input-control-height: 40px;
}

.side-panel-content .v-text-field .v-field,
.side-panel-content .v-select .v-field,
.side-panel-content .v-combobox .v-field,
.side-panel-content .v-autocomplete .v-field,
.side-panel-content .v-file-input .v-field,
.side-panel-content .v-textarea .v-field {
  --v-field-padding-start: 12px;
  --v-field-padding-end: 12px;
  --v-field-padding-top: 6px;
  --v-field-padding-bottom: 6px;
  min-height: 40px;
  font-size: 0.875rem;
}

.side-panel-content .v-input--density-default {
  --v-input-control-height: 40px;
}

.side-panel-content .v-input:not(.v-input--error) .v-messages {
  min-height: 0;
}

.side-panel-content .v-input .v-input__details {
  min-height: 18px;
  padding-top: 2px;
}

.side-panel-content .v-row.v-row--dense > .v-col {
  padding-top: 2px;
  padding-bottom: 2px;
}

.side-panel-content .v-label {
  font-size: 0.8125rem;
}

/* Garante que dropdowns/menus dentro do SidePanel fiquem acima dele */
.v-overlay-container .v-overlay.v-menu,
.v-overlay-container .v-overlay.v-select__menu {
  z-index: 2200 !important;
}

/* Espaçamento entre tabs e conteúdo dos tabs */
.side-panel-content .v-tabs {
  margin-left: -20px;
  margin-right: -20px;
  margin-top: -8px;
}

.side-panel-content .v-tabs-window-item > .v-form,
.side-panel-content .v-tabs-window-item > div {
  padding-top: 16px;
}
</style>
