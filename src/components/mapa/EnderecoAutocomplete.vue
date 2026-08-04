<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  novaSessionToken,
  placeDetails,
  placesAutocomplete,
  type PlaceDetails,
  type PlacePrediction,
} from '@/services/maps'

const emit = defineEmits<{ (e: 'select', detalhes: PlaceDetails): void }>()

const { showError } = useSnackbar()

const query = ref('')
const predictions = ref<PlacePrediction[]>([])
const loading = ref(false)
const sessionToken = ref(novaSessionToken())

let debounce: ReturnType<typeof setTimeout> | undefined

watch(query, (valor) => {
  if (debounce) clearTimeout(debounce)
  const termo = (valor || '').trim()
  if (termo.length < 3) {
    predictions.value = []
    return
  }
  debounce = setTimeout(() => buscar(termo), 350)
})

async function buscar(termo: string) {
  loading.value = true
  try {
    predictions.value = await placesAutocomplete(termo, sessionToken.value)
  } catch {
    predictions.value = []
    showError('Não foi possível buscar o endereço agora. Tente novamente.')
  } finally {
    loading.value = false
  }
}

async function selecionar(prediction: PlacePrediction | null) {
  if (!prediction?.place_id) return
  loading.value = true
  try {
    const detalhes = await placeDetails(prediction.place_id, sessionToken.value)
    emit('select', detalhes)
  } catch {
    showError('Não foi possível carregar os detalhes do endereço.')
  } finally {
    loading.value = false
    // Encerra a sessão de cobrança e limpa o campo para uma nova busca.
    sessionToken.value = novaSessionToken()
    predictions.value = []
    query.value = ''
  }
}
</script>

<template>
  <v-autocomplete
    :items="predictions"
    item-title="description"
    return-object
    no-filter
    :loading="loading"
    :model-value="null"
    hide-details="auto"
    hide-no-data
    clearable
    class="compact-input"
    density="compact"
    variant="outlined"
    prepend-inner-icon="mdi-map-search-outline"
    placeholder="Digite o endereço para buscar (ex: Av. Paulista, 1000, São Paulo)"
    :menu-props="{ maxHeight: 320 }"
    @update:search="query = $event"
    @update:model-value="selecionar"
  />
</template>
