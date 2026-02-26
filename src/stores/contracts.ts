import type { AxiosError } from 'axios'
import { defineStore } from 'pinia'
import api from '@/services/api'

// ===== Tipos =====
export interface Contract {
  id: number
  cliente: number // FK id
  numero_contrato: string
  banco: string
  situacao: string
  origem_averbacao: string
  data_inclusao: string | null
  data_inicio_desconto: string | null
  data_fim_desconto: string | null
  quantidade_parcelas: number | null
  valor_parcela: number | null
  iof: number | null
  emprestado: number | null
  liberado: number | null
  created_at: string
  updated_at: string | null
}

export interface CreateContractPayload {
  cliente: number
  numero_contrato: string
  banco: string
  situacao: string
  origem_averbacao: string
  data_inclusao?: string | null
  data_inicio_desconto?: string | null
  data_fim_desconto?: string | null
  quantidade_parcelas?: number | null
  valor_parcela?: number | null
  iof?: number | null
  emprestado?: number | null
  liberado?: number | null
}

export interface UpdateContractPayload extends Partial<CreateContractPayload> { }

export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  cliente?: number
  banco?: string
  situacao?: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ===== Helpers =====
function normalize (c: Contract): Contract {
  return {
    ...c,
    cliente: Number(c.cliente),
    quantidade_parcelas: c.quantidade_parcelas ? Number(c.quantidade_parcelas) : null,
    valor_parcela: c.valor_parcela ? Number(c.valor_parcela) : null,
    iof: c.iof ? Number(c.iof) : null,
    emprestado: c.emprestado ? Number(c.emprestado) : null,
    liberado: c.liberado ? Number(c.liberado) : null,
  }
}

function buildQuery (params: Record<string, unknown>): Record<string, unknown> {
  const q: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') {
      continue
    }
    q[k] = v
  }
  return q
}

// ===== Store =====
export const useContractsStore = defineStore('contracts', {
  state: () => ({
    items: [] as Contract[],
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    loading: false,
    loadingMutation: false,
    error: null as string | null,
    byIdCache: new Map<number, Contract>(),
  }),

  getters: {
    byId: state => (id: number) =>
      state.byIdCache.get(id) || state.items.find(i => i.id === id) || null,
    byCliente: state => (clienteId: number) =>
      state.items.filter(i => i.cliente === clienteId),
  },

  actions: {
    // LISTAR
    async fetch (params: ListParams = {}): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Paginated<Contract>>('/api/contracts/', {
          params: buildQuery({
            page: params.page ?? 1,
            page_size: params.page_size ?? 10,
            search: params.search,
            ordering: params.ordering,
            cliente: params.cliente,
            banco: params.banco,
            situacao: params.situacao,
          }),
        })
        this.items = res.data.results.map(c => normalize(c))
        this.count = res.data.count
        this.next = res.data.next
        this.previous = res.data.previous
        for (const it of this.items) {
          this.byIdCache.set(it.id, it)
        }
      } catch (error) {
        const e = error as AxiosError<any>
        this.error
                    = e.response?.data?.detail || e.message || 'Falha ao listar contratos'
        throw error
      } finally {
        this.loading = false
      }
    },

    // DETALHE
    async getDetail (id: number): Promise<Contract> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Contract>(`/api/contracts/${id}/`)
        const data = normalize(res.data)
        this.byIdCache.set(id, data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error
                    = e.response?.data?.detail || e.message || 'Falha ao carregar contrato'
        throw error
      } finally {
        this.loading = false
      }
    },

    // CRIAR
    async create (payload: CreateContractPayload): Promise<Contract> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.post<Contract>('/api/contracts/', payload)
        const data = normalize(res.data)
        this.items = [data, ...this.items]
        this.count += 1
        this.byIdCache.set(data.id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error
                    = e.response?.data?.detail || e.message || 'Falha ao criar contrato'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATUALIZAR
    async update (id: number, payload: UpdateContractPayload): Promise<Contract> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.patch<Contract>(`/api/contracts/${id}/`, payload)
        const data = normalize(res.data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        this.byIdCache.set(id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error
                    = e.response?.data?.detail || e.message || 'Falha ao atualizar contrato'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // REMOVER
    async remove (id: number): Promise<void> {
      this.loadingMutation = true
      this.error = null
      try {
        await api.delete(`/api/contracts/${id}/`)
        this.items = this.items.filter(i => i.id !== id)
        this.count = Math.max(0, this.count - 1)
        this.byIdCache.delete(id)
      } catch (error) {
        const e = error as AxiosError<any>
        this.error
                    = e.response?.data?.detail || e.message || 'Falha ao remover contrato'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },
  },
})
