<script setup lang="ts">
const modelValue = defineModel<boolean>({ default: false })

const props = withDefaults(defineProps<{
  title?: string
  message?: string
  confirmText?: string
  confirmColor?: string
  cancelText?: string
  icon?: string
}>(), {
  title: 'Confirmar',
  message: 'Tem certeza que deseja continuar?',
  confirmText: 'Confirmar',
  confirmColor: 'error',
  cancelText: 'Cancelar',
  icon: 'mdi-alert-circle-outline',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function onConfirm() {
  emit('confirm')
  modelValue.value = false
}

function onCancel() {
  emit('cancel')
  modelValue.value = false
}
</script>

<template>
  <v-dialog v-model="modelValue" max-width="440" persistent>
    <v-card class="pa-2">
      <v-card-text class="text-center pt-6 pb-2">
        <v-avatar :color="confirmColor" size="56" variant="tonal" class="mb-4">
          <v-icon :icon="icon" size="28" />
        </v-avatar>
        <h3 class="text-h6 font-weight-bold mb-2">{{ title }}</h3>
        <p class="text-body-2 text-medium-emphasis">{{ message }}</p>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="onCancel">{{ cancelText }}</v-btn>
        <v-btn :color="confirmColor" variant="elevated" @click="onConfirm">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
