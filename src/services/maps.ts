import api from './api'

export interface PlacePrediction {
  description: string
  place_id: string
}

export interface PlaceDetails {
  endereco_formatado: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  latitude: number | null
  longitude: number | null
}

/**
 * Sugestões de endereço via proxy do backend (Google Places).
 * O backend adiciona a chave + Referer permitido para a chave restrita funcionar em produção.
 */
export async function placesAutocomplete(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const { data } = await api.get<{ predictions: PlacePrediction[] }>(
    '/api/maps/places/autocomplete/',
    { params: { input, sessiontoken: sessionToken } },
  )
  return data?.predictions ?? []
}

/** Detalhes de um place_id: endereço quebrado em campos + lat/long. */
export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  const { data } = await api.get<PlaceDetails>('/api/maps/places/details/', {
    params: { place_id: placeId, sessiontoken: sessionToken },
  })
  return data
}

/** Gera um token de sessão (agrupa autocomplete+details p/ cobrança da Google). */
export function novaSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
