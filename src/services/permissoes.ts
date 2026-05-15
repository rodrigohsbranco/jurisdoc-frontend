import api, { fetchAllPages } from '@/services/api'

export type Capacidade = {
  id: number
  codigo: string
  recurso: string
  acao: string
  descricao: string
  categoria: string
}

export type CapacidadesAgrupadas = Array<{
  categoria: string
  recursos: Array<{
    recurso: string
    acoes: Array<{
      id: number
      codigo: string
      acao: string
      descricao: string
    }>
  }>
}>

export type Permissao = {
  id: number
  nome: string
  descricao: string
  capacidades: number[]
  capacidades_detalhe?: Capacidade[]
  usuarios_count?: number
  criado_em?: string
  atualizado_em?: string
}

export type PermissaoLeve = {
  id: number
  nome: string
  descricao: string
}

const BASE = '/api/permissoes/permissoes/'
const CAPS_BASE = '/api/permissoes/capacidades/'

export async function listPermissoes (params: { search?: string; ordering?: string } = {}) {
  return await fetchAllPages<Permissao>(BASE, { params: { ...params, page_size: 100 } })
}

export async function getPermissao (id: number) {
  const { data } = await api.get<Permissao>(`${BASE}${id}/`)
  return data
}

export async function createPermissao (payload: Partial<Permissao>) {
  const { data } = await api.post<Permissao>(BASE, payload)
  return data
}

export async function updatePermissao (id: number, payload: Partial<Permissao>) {
  const { data } = await api.patch<Permissao>(`${BASE}${id}/`, payload)
  return data
}

export async function deletePermissao (id: number) {
  await api.delete(`${BASE}${id}/`)
}

export async function listCapacidades () {
  const { data } = await api.get<Capacidade[]>(CAPS_BASE)
  return Array.isArray(data) ? data : []
}

export async function getCapacidadesAgrupadas () {
  const { data } = await api.get<CapacidadesAgrupadas>(`${CAPS_BASE}agrupadas/`)
  return data
}
