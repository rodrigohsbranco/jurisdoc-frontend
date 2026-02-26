import { defineStore } from 'pinia'
import api from '@/services/api'

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
        const { data } = await api.get<ContaBancariaReu[]>(BASE, { params })
        this.items = data
        return data
      } catch (error: any) {
        this.error = toMessage(error)
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
        this.error = toMessage(error)
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
        this.error = toMessage(error)
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
        this.error = toMessage(error)
        throw error
      } finally {
        this.loading = false
      }
    },

  },
})

