import api, { fetchAllPages } from '@/services/api'
import type { KitAcao, KitStatus } from '@/types/kits'

// ── Tipos da API ──

export interface KitListItem {
  id: number
  cliente: number
  cliente_nome: string
  cliente_cpf: string
  criado_por: number
  criado_por_nome: string
  status: KitStatus
  total_acoes: number
  criado_em: string
  atualizado_em: string
}

export interface KitDetail {
  id: number
  cliente: number
  cliente_detail: Record<string, any>
  criado_por: number
  criado_por_nome: string
  status: KitStatus
  acoes: AcaoAPI[]
  documentos: DocumentoAPI[]
  criado_em: string
  atualizado_em: string
}

export interface AcaoAPI {
  id?: number
  kit?: number
  tipo_acao: string
  nome_banco: string
  banco_outro: string
  numero_contrato: string
  tarifa_questionada: string
  tipo_seguro: string
  tipo_contribuicao: string
  historico_emprestimo?: string
  historico_credito?: string
  extrato_bancario?: string
}

export interface DocumentoAPI {
  id: number
  kit: number
  tipo: string
  arquivo: string
  gerado_em: string
}

// ── API calls ──

const BASE = '/api/kits/'

export async function listKits (params?: Record<string, any>): Promise<KitListItem[]> {
  return fetchAllPages<KitListItem>(BASE, { params })
}

export async function getKit (id: number): Promise<KitDetail> {
  const { data } = await api.get<KitDetail>(`${BASE}${id}/`)
  return data
}

export async function createKit (clienteId: number): Promise<KitDetail> {
  const { data } = await api.post<KitDetail>(BASE, { cliente: clienteId })
  return data
}

export async function updateKit (id: number, payload: Record<string, any>): Promise<KitDetail> {
  const { data } = await api.patch<KitDetail>(`${BASE}${id}/`, payload)
  return data
}

export async function deleteKit (id: number): Promise<void> {
  await api.delete(`${BASE}${id}/`)
}

// ── Ações ──

export async function listAcoes (kitId: number): Promise<AcaoAPI[]> {
  const { data } = await api.get<AcaoAPI[]>(`${BASE}${kitId}/acoes/`)
  return Array.isArray(data) ? data : (data as any).results ?? []
}

export async function createAcao (kitId: number, acao: Partial<KitAcao>): Promise<AcaoAPI> {
  const { data } = await api.post<AcaoAPI>(`${BASE}${kitId}/acoes/`, acaoToAPI(acao))
  return data
}

export async function updateAcao (kitId: number, acaoId: number, acao: Partial<KitAcao>): Promise<AcaoAPI> {
  const { data } = await api.patch<AcaoAPI>(`${BASE}${kitId}/acoes/${acaoId}/`, acaoToAPI(acao))
  return data
}

export async function deleteAcao (kitId: number, acaoId: number): Promise<void> {
  await api.delete(`${BASE}${kitId}/acoes/${acaoId}/`)
}

// ── Status ──

export async function finalizarKit (id: number): Promise<KitDetail> {
  const { data } = await api.post<KitDetail>(`${BASE}${id}/finalizar/`)
  return data
}

export async function assinarKit (id: number): Promise<KitDetail> {
  const { data } = await api.post<KitDetail>(`${BASE}${id}/assinar/`)
  return data
}

export async function mudarStatus (id: number, status: KitStatus): Promise<KitDetail> {
  const { data } = await api.post<KitDetail>(`${BASE}${id}/mudar-status/`, { status })
  return data
}

// ── Helpers ──

function acaoToAPI (acao: Partial<KitAcao>): Record<string, any> {
  return {
    tipo_acao: acao.tipoAcao || '',
    nome_banco: acao.nomeBanco || '',
    banco_outro: acao.bancoOutro || '',
    numero_contrato: acao.numeroContrato || '',
    tarifa_questionada: acao.tarifaQuestionada || '',
    tipo_seguro: acao.tipoSeguro || '',
    tipo_contribuicao: acao.tipoContribuicao || '',
  }
}

export function acaoFromAPI (a: AcaoAPI): KitAcao {
  return {
    nomeBanco: a.nome_banco,
    bancoOutro: a.banco_outro,
    tipoAcao: a.tipo_acao as any,
    numeroContrato: a.numero_contrato,
    tarifaQuestionada: a.tarifa_questionada,
    tipoSeguro: a.tipo_seguro,
    tipoContribuicao: a.tipo_contribuicao,
    historicoEmprestimoUrl: a.historico_emprestimo || '',
    historicoCreditoUrl: a.historico_credito || '',
    extratoBancarioUrl: a.extrato_bancario || '',
  }
}
