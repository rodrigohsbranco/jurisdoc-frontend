import api, { fetchAllPages, type PaginatedResponse } from '@/services/api'
import type { KitAcao, KitStatus, KitTipo, UploadedDoc } from '@/types/kits'

export interface KitListItem {
  id: number
  tipo: KitTipo
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
  tipo: KitTipo
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
  tarifa_questionada_outro: string
  tipo_seguro: string
  tipo_contribuicao: string
  historico_emprestimo?: string
  historico_credito?: string
  extrato_bancario?: string
  historico_emprestimo_arquivos?: UploadedDoc[]
  historico_credito_arquivos?: UploadedDoc[]
  extrato_bancario_arquivos?: UploadedDoc[]
}

export interface DocumentoAPI {
  id: number
  kit: number
  tipo: string
  arquivo: string
  gerado_em: string
}

const BASE = '/api/kits/'

export interface KitStats {
  total: number
  rascunho: number
  em_andamento: number
  pendentes: number
  assinados: number
}

export async function listKits (params?: Record<string, any>): Promise<PaginatedResponse<KitListItem>> {
  const { data } = await api.get<PaginatedResponse<KitListItem>>(BASE, { params })
  return data
}

export async function listAllKits (params?: Record<string, any>): Promise<KitListItem[]> {
  return fetchAllPages<KitListItem>(BASE, { params })
}

export async function fetchKitStats (): Promise<KitStats> {
  const { data } = await api.get<KitStats>(`${BASE}stats/`)
  return data
}

export async function getKit (id: number): Promise<KitDetail> {
  const { data } = await api.get<KitDetail>(`${BASE}${id}/`)
  return data
}

export async function createKit (clienteId: number, tipo: KitTipo = 'bancario'): Promise<KitDetail> {
  const { data } = await api.post<KitDetail>(BASE, { cliente: clienteId, tipo })
  return data
}

export async function updateKit (id: number, payload: Record<string, any>): Promise<KitDetail> {
  const { data } = await api.patch<KitDetail>(`${BASE}${id}/`, payload)
  return data
}

export async function deleteKit (id: number): Promise<void> {
  await api.delete(`${BASE}${id}/`)
}

export async function listAcoes (kitId: number): Promise<AcaoAPI[]> {
  const { data } = await api.get<AcaoAPI[]>(`${BASE}${kitId}/acoes/`)
  return Array.isArray(data) ? data : (data as any).results ?? []
}

export async function createAcao (kitId: number, acao: Partial<KitAcao>): Promise<AcaoAPI> {
  const { data } = await api.post<AcaoAPI>(`${BASE}${kitId}/acoes/`, acaoToFormData(acao), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateAcao (kitId: number, acaoId: number, acao: Partial<KitAcao>): Promise<AcaoAPI> {
  const { data } = await api.patch<AcaoAPI>(`${BASE}${kitId}/acoes/${acaoId}/`, acaoToFormData(acao), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteAcao (kitId: number, acaoId: number): Promise<void> {
  await api.delete(`${BASE}${kitId}/acoes/${acaoId}/`)
}

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

function appendList (fd: FormData, key: string, values: string[]) {
  values.forEach(value => fd.append(key, value))
}

function acaoToFormData (acao: Partial<KitAcao>): FormData {
  const fd = new FormData()
  fd.append('tipo_acao', acao.tipoAcao || '')
  fd.append('nome_banco', acao.nomeBanco || '')
  fd.append('banco_outro', acao.bancoOutro || '')
  fd.append('numero_contrato', acao.numeroContrato || '')
  fd.append('tarifa_questionada', acao.tarifaQuestionada || '')
  fd.append('tarifa_questionada_outro', acao.tarifaQuestionadaOutro || '')
  fd.append('tipo_seguro', acao.tipoSeguro || '')
  fd.append('tipo_contribuicao', acao.tipoContribuicao || '')
  fd.append('historico_emprestimo_sync', '1')
  fd.append('historico_credito_sync', '1')
  fd.append('extrato_bancario_sync', '1')

  appendList(fd, 'historico_emprestimo_keep_paths', (acao.historicoEmprestimoArquivos || []).map(doc => doc.path))
  appendList(fd, 'historico_credito_keep_paths', (acao.historicoCreditoArquivos || []).map(doc => doc.path))
  appendList(fd, 'extrato_bancario_keep_paths', (acao.extratoBancarioArquivos || []).map(doc => doc.path))

  for (const file of acao.historicoEmprestimoFiles || []) fd.append('historico_emprestimo_files', file)
  for (const file of acao.historicoCreditoFiles || []) fd.append('historico_credito_files', file)
  for (const file of acao.extratoBancarioFiles || []) fd.append('extrato_bancario_files', file)

  return fd
}

function normalizeDocs (docs?: UploadedDoc[]): UploadedDoc[] {
  return Array.isArray(docs) ? docs : []
}

export function acaoFromAPI (a: AcaoAPI): KitAcao {
  return {
    nomeBanco: a.nome_banco,
    bancoOutro: a.banco_outro,
    tipoAcao: a.tipo_acao as any,
    numeroContrato: a.numero_contrato,
    tarifaQuestionada: a.tarifa_questionada,
    tarifaQuestionadaOutro: a.tarifa_questionada_outro,
    tipoSeguro: a.tipo_seguro,
    tipoContribuicao: a.tipo_contribuicao,
    historicoEmprestimoArquivos: normalizeDocs(a.historico_emprestimo_arquivos),
    historicoEmprestimoFiles: [],
    historicoCreditoArquivos: normalizeDocs(a.historico_credito_arquivos),
    historicoCreditoFiles: [],
    extratoBancarioArquivos: normalizeDocs(a.extrato_bancario_arquivos),
    extratoBancarioFiles: [],
  }
}
