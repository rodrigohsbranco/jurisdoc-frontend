import api from '@/services/api'

export type ClausulaPadrao = {
  texto: string
  atualizado_em: string | null
  atualizado_por_nome: string | null
}

export type ClausulaUF = {
  id: number
  uf: string
  tipo_acao: string
  texto: string
  atualizado_em: string | null
  atualizado_por_nome: string | null
}

export type ClausulaResolved = {
  uf: string
  tipos_acao?: string[]
  texto: string
  fonte: 'uf_tipo' | 'uf' | 'padrao' | 'snapshot'
}

const PADRAO_URL = '/api/kits/clausula-porcentagem/padrao/'
const UFS_URL = '/api/kits/clausula-porcentagem/ufs/'

export async function getPadrao (): Promise<ClausulaPadrao> {
  const { data } = await api.get<ClausulaPadrao>(PADRAO_URL)
  return data
}

export async function updatePadrao (texto: string): Promise<ClausulaPadrao> {
  const { data } = await api.patch<ClausulaPadrao>(PADRAO_URL, { texto })
  return data
}

export async function listUfs (): Promise<ClausulaUF[]> {
  const { data } = await api.get<ClausulaUF[]>(UFS_URL)
  return Array.isArray(data) ? data : []
}

export async function createUf (payload: { uf: string; tipo_acao?: string; texto: string }): Promise<ClausulaUF> {
  const { data } = await api.post<ClausulaUF>(UFS_URL, payload)
  return data
}

export async function updateUf (id: number, payload: Partial<{ uf: string; tipo_acao: string; texto: string }>): Promise<ClausulaUF> {
  const { data } = await api.patch<ClausulaUF>(`${UFS_URL}${id}/`, payload)
  return data
}

export async function deleteUf (id: number): Promise<void> {
  await api.delete(`${UFS_URL}${id}/`)
}

export async function resolve (uf: string, tiposAcao: string[] = []): Promise<ClausulaResolved> {
  const params: Record<string, string> = { uf }
  if (tiposAcao.length) params.tipos_acao = tiposAcao.join(',')
  const { data } = await api.get<ClausulaResolved>(`${UFS_URL}resolve/`, { params })
  return data
}

export async function snapshotKit (kitId: number, persist = true): Promise<ClausulaResolved & { ja_persistido: boolean }> {
  const url = `/api/kits/${kitId}/clausula-snapshot/`
  const { data } = persist ? await api.post(url) : await api.get(url)
  return data
}
