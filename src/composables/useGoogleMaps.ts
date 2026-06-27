import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

// Promise em escopo de módulo: o SDK do Google Maps carrega uma única vez,
// mesmo com múltiplas instâncias do componente de mapa.
let mapsPromise: Promise<any> | null = null

export function useGoogleMaps () {
  function loadMaps (): Promise<any> {
    if (mapsPromise) return mapsPromise

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
    if (!apiKey) {
      return Promise.reject(
        new Error('Chave do Google Maps não configurada (VITE_GOOGLE_MAPS_API_KEY).'),
      )
    }

    // API funcional do @googlemaps/js-api-loader v2 (a classe Loader foi removida).
    setOptions({ apiKey, version: 'weekly' })
    mapsPromise = importLibrary('maps')
      .then(() => (window as any).google.maps)
      .catch(err => {
        // Permite nova tentativa numa próxima montagem
        mapsPromise = null
        console.error('[useGoogleMaps] Falha ao carregar o Google Maps:', err)
        throw err
      })

    return mapsPromise
  }

  return { loadMaps }
}
