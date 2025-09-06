import { defineStore } from 'pinia'
import api from '@/services/api'

export type Cliente = {
  id: number
  nome_completo: string
  qualificacao?: string | null
  cpf?: string | null
  rg?: string | null
  orgao_expedidor?: string | null
  se_idoso?: boolean
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  uf?: string | null
  criado_em?: string
  atualizado_em?: string
}

export type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // ex.: 'nome_completo' ou '-criado_em'
}

function toMessage (e: any): string {
  // mapeia erros do Axios/DRF para string amigável
  if (!e?.response) {
    return 'Falha de rede. Verifique se a API está no ar.'
  }
  return (
    e.response.data?.detail
    || e.response.data?.non_field_errors?.[0]
    || 'Ocorreu um erro. Tente novamente.'
  )
}

const BASE = '/api/cadastro/clientes/'

export const useClientesStore = defineStore('clientes', {
  state: () => ({
    items: [] as Cliente[],
    count: 0,
    loading: false,
    error: '' as string,
    // filtros/paginação padrão (server-side)
    params: {
      page: 1,
      page_size: 10,
      search: '',
      ordering: 'nome_completo',
    } as Required<Pick<ListParams, 'page' | 'page_size' | 'search' | 'ordering'>>,
  }),

  getters: {
    hasError: s => !!s.error,
  },

  actions: {
    setParams (p: Partial<ListParams>) {
      this.params = { ...this.params, ...p }
    },

    resetParams () {
      this.params = { page: 1, page_size: 10, search: '', ordering: 'nome_completo' }
    },

    async fetchList (overrides?: Partial<ListParams>) {
      this.loading = true
      this.error = ''
      try {
        const params = { ...this.params, ...overrides }
        const { data } = await api.get<Paginated<Cliente>>(BASE, { params })
        this.items = data.results
        this.count = data.count
        // se vier override, sincroniza no estado
        this.params = {
          page: params.page ?? 1,
          page_size: params.page_size ?? 10,
          search: params.search ?? '',
          ordering: params.ordering ?? 'nome_completo',
        }
      } catch (error: any) {
        this.error = toMessage(error)
      } finally {
        this.loading = false
      }
    },

    async getDetail (id: number) {
      this.error = ''
      try {
        const { data } = await api.get<Cliente>(`${BASE}${id}/`)
        // atualiza/insere no cache local
        const i = this.items.findIndex(x => x.id === id)
        if (i === -1) {
          this.items.unshift(data)
        } else {
          this.items[i] = data
        }
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    async create (payload: Omit<Cliente, 'id' | 'criado_em' | 'atualizado_em'>) {
      this.error = ''
      try {
        const { data } = await api.post<Cliente>(BASE, payload)
        this.items.unshift(data)
        this.count += 1
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    async update (id: number, payload: Partial<Cliente>) {
      this.error = ''
      try {
        const { data } = await api.patch<Cliente>(`${BASE}${id}/`, payload)
        const i = this.items.findIndex(x => x.id === id)
        if (i !== -1) {
          this.items[i] = { ...this.items[i], ...data }
        }
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    async remove (id: number) {
      this.error = ''
      try {
        await api.delete(`${BASE}${id}/`)
        this.items = this.items.filter(x => x.id !== id)
        this.count = Math.max(0, this.count - 1)
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },
  },
})
