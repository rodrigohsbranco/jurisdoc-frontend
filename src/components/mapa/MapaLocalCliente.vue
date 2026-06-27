<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGoogleMaps } from '@/composables/useGoogleMaps'
import { useSnackbar } from '@/composables/useSnackbar'

const props = withDefaults(defineProps<{
  latitude: number | null
  longitude: number | null
  readonly?: boolean
  height?: string
}>(), {
  readonly: false,
  height: '360px',
})

const emit = defineEmits<{
  (e: 'update:latitude', value: number | null): void
  (e: 'update:longitude', value: number | null): void
}>()

const { loadMaps } = useGoogleMaps()
const { showError } = useSnackbar()

// Centro padrão: Brasil (usado quando ainda não há coordenadas)
const DEFAULT_CENTER = { lat: -14.235, lng: -51.925 }
const DEFAULT_ZOOM = 4
const MARKER_ZOOM = 16

const mapEl = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadError = ref(false)
const locating = ref(false)

let maps: any = null
let map: any = null
let marker: any = null

const isSecure = typeof window !== 'undefined' && window.isSecureContext

function setMarker (lat: number, lng: number) {
  if (!maps || !map) return
  if (!marker) {
    marker = new maps.Marker({
      map,
      position: { lat, lng },
      draggable: !props.readonly,
    })
    if (!props.readonly) {
      marker.addListener('dragend', (ev: any) => {
        emitCoords(ev.latLng.lat(), ev.latLng.lng())
      })
    }
  } else {
    marker.setPosition({ lat, lng })
  }
}

function emitCoords (lat: number, lng: number) {
  emit('update:latitude', Number(lat.toFixed(7)))
  emit('update:longitude', Number(lng.toFixed(7)))
}

function clearLocal () {
  if (marker) {
    marker.setMap(null)
    marker = null
  }
  emit('update:latitude', null)
  emit('update:longitude', null)
  if (map) {
    map.setCenter(DEFAULT_CENTER)
    map.setZoom(DEFAULT_ZOOM)
  }
}

function usarMinhaLocalizacao () {
  if (!isSecure || !('geolocation' in navigator)) {
    showError('Geolocalização exige conexão segura (HTTPS).')
    return
  }
  locating.value = true

  const onSuccess = (pos: GeolocationPosition) => {
    locating.value = false
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    setMarker(lat, lng)
    map?.setCenter({ lat, lng })
    map?.setZoom(MARKER_ZOOM)
    emitCoords(lat, lng)
  }

  const onError = (err: GeolocationPositionError) => {
    // Fallback: tenta novamente com baixa precisão antes de desistir
    if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
      navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
        enableHighAccuracy: false,
        timeout: 15000,
      })
      return
    }
    onFinalError(err)
  }

  const onFinalError = (err: GeolocationPositionError) => {
    locating.value = false
    const msg = err.code === err.PERMISSION_DENIED
      ? 'Permissão de localização negada.'
      : err.code === err.POSITION_UNAVAILABLE
        ? 'Localização indisponível no momento.'
        : 'Tempo esgotado ao obter localização.'
    showError(msg)
  }

  navigator.geolocation.getCurrentPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
  })
}

async function initMap () {
  try {
    maps = await loadMaps()
    if (!mapEl.value) return
    const hasCoords = props.latitude != null && props.longitude != null
    map = new maps.Map(mapEl.value, {
      center: hasCoords ? { lat: props.latitude!, lng: props.longitude! } : DEFAULT_CENTER,
      zoom: hasCoords ? MARKER_ZOOM : DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    if (hasCoords) setMarker(props.latitude!, props.longitude!)

    if (!props.readonly) {
      map.addListener('click', (ev: any) => {
        const lat = ev.latLng.lat()
        const lng = ev.latLng.lng()
        setMarker(lat, lng)
        emitCoords(lat, lng)
      })
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// Sincroniza o marker quando as coords mudam por fora (carregar kit, limpar etc.)
watch(() => [props.latitude, props.longitude], ([lat, lng]) => {
  if (!map || !maps) return
  if (lat != null && lng != null) {
    setMarker(lat as number, lng as number)
  } else if (marker) {
    marker.setMap(null)
    marker = null
  }
})

onMounted(initMap)
onBeforeUnmount(() => {
  if (marker) marker.setMap(null)
  marker = null
  map = null
})
</script>

<template>
  <div class="mapa-local">
    <div v-if="!readonly" class="d-flex flex-wrap ga-2 mb-2">
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-crosshairs-gps"
        :loading="locating"
        :disabled="loadError || !isSecure"
        @click="usarMinhaLocalizacao"
      >
        Usar minha localização atual
      </v-btn>
      <v-btn
        v-if="latitude != null && longitude != null"
        color="error"
        variant="text"
        prepend-icon="mdi-map-marker-off-outline"
        @click="clearLocal"
      >
        Limpar local
      </v-btn>
    </div>

    <v-alert
      v-if="!isSecure && !readonly"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2"
      text="O botão de localização atual requer HTTPS. Você ainda pode marcar o ponto clicando no mapa."
    />

    <v-alert
      v-if="loadError"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-2"
      text="Não foi possível carregar o mapa. Verifique a conexão ou a chave do Google Maps. As coordenadas abaixo continuam editáveis manualmente."
    />

    <div v-if="!loadError" class="map-wrapper" :style="{ height }">
      <div v-if="loading" class="map-loading">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <div ref="mapEl" class="map-canvas" />
    </div>

    <div class="d-flex flex-wrap ga-3 mt-3">
      <v-text-field
        :model-value="latitude"
        label="Latitude"
        type="number"
        variant="outlined"
        density="compact"
        hide-details
        style="max-width: 200px"
        :readonly="readonly"
        @update:model-value="emit('update:latitude', $event === '' || $event == null ? null : Number($event))"
      />
      <v-text-field
        :model-value="longitude"
        label="Longitude"
        type="number"
        variant="outlined"
        density="compact"
        hide-details
        style="max-width: 200px"
        :readonly="readonly"
        @update:model-value="emit('update:longitude', $event === '' || $event == null ? null : Number($event))"
      />
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
.map-canvas {
  width: 100%;
  height: 100%;
}
.map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  background: rgba(255, 255, 255, 0.6);
}
</style>
