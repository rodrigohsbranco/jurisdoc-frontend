import type { AxiosError } from 'axios'
import { defineStore } from 'pinia'
import api from '@/services/api'

// ===== Tipos =====
export interface ContratoItem {
  numero_do_contrato?: string
  banco_do_contrato?: string
  situacao?: string
  origem_averbacao?: string
  data_inclusao?: string
  data_inicio_desconto?: string
  data_fim_desconto?: string
  quantidade_parcelas?: number
  valor_parcela?: number
  iof?: number
  valor_do_emprestimo?: number
  valor_liberado?: number
}

export interface Contrato {
  id: number
  cliente: number // FK id
  cliente_nome?: string | null // vem do serializer
  template: number // FK id
  template_nome?: string | null // vem do serializer
  contratos: ContratoItem[] // Array JSONB
  verifica_documento?: Record<string, any> | null // JSONB com todos os dados do formulário de verificação
  imagem_do_contrato?: string | null // URL da imagem
  criado_em?: string
  atualizado_em?: string
}

export interface CreateContratoPayload {
  cliente: number
  template: number
  contratos: ContratoItem[]
}

export interface UpdateContratoPayload {
  cliente?: number
  template?: number
  contratos?: ContratoItem[]
  verifica_documento?: Record<string, any> | null
  imagem_do_contrato?: string | null
}

export interface ListParams {
  search?: string
  ordering?: string
  cliente?: number
  template?: number
}

// ===== Helpers =====
function normalize (c: Contrato): Contrato {
  return {
    ...c,
    cliente: Number(c.cliente),
    template: Number(c.template),
    contratos: Array.isArray(c.contratos) ? c.contratos : [],
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

function toMessage (e: any): string {
  if (!e?.response) {
    return 'Falha de rede. Verifique se a API está no ar.'
  }
  const d = e.response.data
  if (d?.detail) {
    return d.detail
  }
  if (d && typeof d === 'object') {
    const k = Object.keys(d)[0]
    const msg = Array.isArray(d[k]) ? d[k][0] : d[k]
    if (msg) {
      return String(msg)
    }
  }
  return e.message || 'Ocorreu um erro inesperado.'
}

// ===== Store =====
export const useContratosStore = defineStore('contratos', {
  state: () => ({
    items: [] as Contrato[],
    loading: false,
    loadingMutation: false,
    error: null as string | null,
    byIdCache: new Map<number, Contrato>(),
  }),

  getters: {
    byId: state => (id: number) => state.byIdCache.get(id) || state.items.find(i => i.id === id) || null,
    byCliente: state => (clienteId: number) => state.items.filter(i => i.cliente === clienteId),
  },

  actions: {
    // LISTAR
    async fetchList (params: ListParams = {}): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Contrato[]>('/api/cadastro/contratos/', {
          params: buildQuery({
            search: params.search,
            ordering: params.ordering,
            cliente: params.cliente,
            template: params.template,
          }),
        })
        this.items = (Array.isArray(res.data) ? res.data : []).map(c => normalize(c))
        for (const it of this.items) {
          this.byIdCache.set(it.id, it)
        }
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loading = false
      }
    },

    // DETALHE
    async getDetail (id: number): Promise<Contrato> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Contrato>(`/api/cadastro/contratos/${id}/`)
        const data = normalize(res.data)
        this.byIdCache.set(id, data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loading = false
      }
    },

    // CRIAR
    async create (payload: CreateContratoPayload): Promise<Contrato> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.post<Contrato>('/api/cadastro/contratos/', payload)
        const data = normalize(res.data)
        this.items = [data, ...this.items]
        this.byIdCache.set(data.id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // CRIAR COM ARQUIVO
    async createWithFile (formData: FormData): Promise<Contrato> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.post<Contrato>('/api/cadastro/contratos/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const data = normalize(res.data)
        this.items = [data, ...this.items]
        this.byIdCache.set(data.id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATUALIZAR
    async update (id: number, payload: UpdateContratoPayload): Promise<Contrato> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.patch<Contrato>(`/api/cadastro/contratos/${id}/`, payload)
        const data = normalize(res.data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        this.byIdCache.set(id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATUALIZAR COM ARQUIVO
    async updateWithFile (id: number, formData: FormData): Promise<Contrato> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.patch<Contrato>(`/api/cadastro/contratos/${id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const data = normalize(res.data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        this.byIdCache.set(id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
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
        await api.delete(`/api/cadastro/contratos/${id}/`)
        this.items = this.items.filter(i => i.id !== id)
        this.byIdCache.delete(id)
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = toMessage(e)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },
  },
})

