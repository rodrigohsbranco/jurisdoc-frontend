import { defineStore } from 'pinia'
import api from '@/services/api'

export type ContaBancaria = {
  id: number
  cliente: number
  banco_nome: string
  agencia: string
  conta: string
  digito?: string | null
  tipo?: 'corrente' | 'poupanca' | string | null
  is_principal: boolean
  criado_em?: string
  atualizado_em?: string
}

export type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

const BASE = '/api/cadastro/contas/'

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
  return 'Ocorreu um erro. Tente novamente.'
}

export const useContasStore = defineStore('contas', {
  state: () => ({
    items: [] as ContaBancaria[],
    count: 0,
    loading: false,
    error: '' as string,
    clienteId: 0 as number,
    params: {
      page: 1,
      page_size: 20,
      ordering: 'banco_nome',
    } as { page: number, page_size: number, ordering?: string },
  }),
  getters: {
    hasError: s => !!s.error,
    byCliente: s => (id: number) => s.items.filter(i => i.cliente === id),
    principal: s => (id: number) =>
      s.items.find(i => i.cliente === id && i.is_principal) || null,
  },
  actions: {
    setCliente (id: number) {
      this.clienteId = id
    },
    setParams (p: Partial<{ page: number, page_size: number, ordering?: string }>) {
      this.params = { ...this.params, ...p }
    },

    async fetchForCliente (cliente: number, overrides?: Partial<{ page: number, page_size: number, ordering?: string }>) {
      this.loading = true
      this.error = ''
      try {
        const params = { ...this.params, ...overrides, cliente }
        const { data } = await api.get<Paginated<ContaBancaria>>(BASE, { params })
        // substitui as contas daquele cliente no cache local
        this.items = this.items.filter(i => i.cliente !== cliente).concat(data.results)
        this.count = data.count
        this.clienteId = cliente
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async create (payload: Omit<ContaBancaria, 'id' | 'criado_em' | 'atualizado_em'>) {
      this.error = ''
      try {
        const { data } = await api.post<ContaBancaria>(BASE, payload)
        this.items.push(data)
        // se marcou principal, desmarca as outras do mesmo cliente localmente
        if (data.is_principal) {
          this.items = this.items.map(i =>
            i.cliente === data.cliente ? { ...i, is_principal: i.id === data.id } : i,
          )
        }
        this.count += 1
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    async update (id: number, payload: Partial<ContaBancaria>) {
      this.error = ''
      try {
        const { data } = await api.patch<ContaBancaria>(`${BASE}${id}/`, payload)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items[idx] = { ...this.items[idx], ...data }
        }
        if (data.is_principal) {
          this.items = this.items.map(i =>
            i.cliente === data.cliente ? { ...i, is_principal: i.id === data.id } : i,
          )
        }
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    async setPrincipal (id: number) {
      return this.update(id, { is_principal: true })
    },

    async remove (id: number) {
      this.error = ''
      try {
        await api.delete(`${BASE}${id}/`)
        this.items = this.items.filter(i => i.id !== id)
        this.count = Math.max(0, this.count - 1)
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },
  },
})
