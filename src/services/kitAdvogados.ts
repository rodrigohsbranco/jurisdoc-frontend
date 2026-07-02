import api from '@/services/api'

export type AdvogadoSnapshot = {
  id: number
  nome_completo: string
  is_socio: boolean
  numero_oab: string
  oab_uf: string
  oab_fonte: 'uf_cliente' | 'fallback_sc' | 'fallback_primeira' | 'pendente'
  nacionalidade: string
  estado_civil: string
  profissao: string
  genero: string
  escritorio_nome: string
  escritorio_cnpj: string
  escritorio_endereco: string
  unidade_apoio_nome: string
  unidade_apoio_endereco: string
}

export type SugeridosResponse = {
  advogados_ids: number[]
  uf_cliente: string
}

export type SnapshotResponse = {
  advogados_snapshot: AdvogadoSnapshot[]
}

export type SaveSnapshotResponse = {
  advogados_snapshot: AdvogadoSnapshot[]
  warnings: string[]
}

export async function getSugeridos (kitId: number): Promise<SugeridosResponse> {
  const { data } = await api.get<SugeridosResponse>(`/api/kits/${kitId}/advogados/sugeridos/`)
  return data
}

export async function getSnapshot (kitId: number): Promise<SnapshotResponse> {
  const { data } = await api.get<SnapshotResponse>(`/api/kits/${kitId}/advogados/`)
  return data
}

export async function saveSnapshot (kitId: number, advogados_ids: number[]): Promise<SaveSnapshotResponse> {
  const { data } = await api.post<SaveSnapshotResponse>(
    `/api/kits/${kitId}/advogados/`,
    { advogados_ids },
  )
  return data
}
