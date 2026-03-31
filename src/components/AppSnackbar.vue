<script setup lang="ts">
import { useSnackbar } from '@/composables/useSnackbar'

const { visible, message, color, timeout } = useSnackbar()
</script>

<template>
  <v-snackbar
    v-model="visible"
    :color="color"
    :timeout="timeout"
    location="top right"
  >
    {{ message }}
    <template #actions>
      <v-btn variant="text" @click="visible = false">
        Fechar
      </v-btn>
    </template>
  </v-snackbar>
</template>
