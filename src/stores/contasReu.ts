import { defineStore } from 'pinia'
import api, { fetchAllPages } from '@/services/api'
import { friendlyError } from '@/utils/errorMessages'

export type ContaBancariaReu = {
  id: number
  banco_nome: string
  banco_codigo?: string | null
  cnpj: string
  descricao?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  criado_em?: string
  atualizado_em?: string
}

export type ContaReuExtras = {
  banco_id?: string
  descricao_banco?: string
  /** quando enviar descricao_banco, define esta variação como ativa no servidor */
  descricao_set_ativa?: boolean
}

const BASE = '/api/cadastro/contas-reu/'
const NOTES_BASE = '/api/cadastro/bancos-descricoes/'

export const useContasReuStore = defineStore('contasReu', {
  state: () => ({
    items: [] as ContaBancariaReu[],
    loading: false,
    error: '' as string,
    params: {
      ordering: 'banco_nome',
    } as { ordering?: string },
  }),
  getters: {
    hasError: s => !!s.error,
  },
  actions: {
    setParams (p: Partial<{ ordering?: string }>) {
      this.params = { ...this.params, ...p }
    },

    async fetchAll (
      overrides?: Partial<{ ordering?: string }>,
    ) {
      this.loading = true
      this.error = ''
      try {
        const params = { ...this.params, ...overrides }
        const data = await fetchAllPages<ContaBancariaReu>(BASE, { params: { ...params, page_size: 100 } })
        this.items = data
        return data
      } catch (error: any) {
        this.error = friendlyError(error, 'contas', 'list')
        throw error
      } finally {
        this.loading = false
      }
    },

    async create (
      payload: Omit<ContaBancariaReu, 'id' | 'criado_em' | 'atualizado_em'>,
      extras?: ContaReuExtras,
    ): Promise<ContaBancariaReu> {
      this.loading = true
      this.error = ''
      try {
        const fullPayload = { ...payload, ...extras } as any
        const { data } = await api.post<ContaBancariaReu>(BASE, fullPayload)
        this.items.push(data)
        return data
      } catch (error: any) {
        this.error = friendlyError(error, 'contas', 'create')
        throw error
      } finally {
        this.loading = false
      }
    },

    async update (
      id: number,
      payload: Partial<Omit<ContaBancariaReu, 'id' | 'criado_em' | 'atualizado_em'>>,
      extras?: ContaReuExtras,
    ): Promise<ContaBancariaReu> {
      this.loading = true
      this.error = ''
      try {
        const fullPayload = { ...payload, ...extras } as any
        const { data } = await api.patch<ContaBancariaReu>(`${BASE}${id}/`, fullPayload)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx >= 0) {
          this.items[idx] = data
        }
        return data
      } catch (error: any) {
        this.error = friendlyError(error, 'contas', 'update')
        throw error
      } finally {
        this.loading = false
      }
    },

    async remove (id: number): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        await api.delete(`${BASE}${id}/`)
        this.items = this.items.filter(i => i.id !== id)
      } catch (error: any) {
        this.error = friendlyError(error, 'contas', 'remove')
        throw error
      } finally {
        this.loading = false
      }
    },

  },
})

