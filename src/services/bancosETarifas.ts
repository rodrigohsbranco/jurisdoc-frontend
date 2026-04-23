import api from '@/services/api'

export interface BancoKit {
  id: number
  nome: string
  ativo: boolean
  ordem: number
}

export interface TarifaKit {
  id: number
  nome: string
  ativo: boolean
  ordem: number
}

const BANCOS_BASE = '/api/bancos-kit/'
const TARIFAS_BASE = '/api/tarifas-kit/'

// ── Bancos ──

export async function listBancos (): Promise<BancoKit[]> {
  const { data } = await api.get<BancoKit[]>(BANCOS_BASE)
  return Array.isArray(data) ? data : (data as any).results ?? []
}

export async function createBanco (payload: Partial<BancoKit>): Promise<BancoKit> {
  const { data } = await api.post<BancoKit>(BANCOS_BASE, payload)
  return data
}

export async function updateBanco (id: number, payload: Partial<BancoKit>): Promise<BancoKit> {
  const { data } = await api.patch<BancoKit>(`${BANCOS_BASE}${id}/`, payload)
  return data
}

export async function deleteBanco (id: number): Promise<void> {
  await api.delete(`${BANCOS_BASE}${id}/`)
}

// ── Tarifas ──

export async function listTarifas (): Promise<TarifaKit[]> {
  const { data } = await api.get<TarifaKit[]>(TARIFAS_BASE)
  return Array.isArray(data) ? data : (data as any).results ?? []
}

export async function createTarifa (payload: Partial<TarifaKit>): Promise<TarifaKit> {
  const { data } = await api.post<TarifaKit>(TARIFAS_BASE, payload)
  return data
}

export async function updateTarifa (id: number, payload: Partial<TarifaKit>): Promise<TarifaKit> {
  const { data } = await api.patch<TarifaKit>(`${TARIFAS_BASE}${id}/`, payload)
  return data
}

export async function deleteTarifa (id: number): Promise<void> {
  await api.delete(`${TARIFAS_BASE}${id}/`)
}
