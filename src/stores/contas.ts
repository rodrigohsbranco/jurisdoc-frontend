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

export type ContaExtras = {
  banco_id?: string
  descricao_banco?: string
  /** quando enviar descricao_banco, define esta variação como ativa no servidor */
  descricao_set_ativa?: boolean
}

export type BankDescricao = {
  id: number
  banco_id: string
  banco_nome: string
  descricao: string
  is_ativa: boolean
  criado_em?: string
  atualizado_em?: string
}

const BASE = '/api/cadastro/contas/'
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

    // cache simples de descrições por banco_id
    notesByBank: {} as Record<string, BankDescricao[]>,
  }),
  getters: {
    hasError: s => !!s.error,
    byCliente: s => (id: number) => s.items.filter(i => i.cliente === id),
    principal: s => (id: number) =>
      s.items.find(i => i.cliente === id && i.is_principal) || null,
    descricoesAtivasMap: s => {
      const m: Record<string, BankDescricao | null> = {}
      for (const [bid, list] of Object.entries(s.notesByBank)) {
        m[bid] = list.find(n => n.is_ativa) || null
      }
      return m
    },
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

    async create (payload: Omit<ContaBancaria, 'id' | 'criado_em' | 'atualizado_em'>, extras?: ContaExtras) {
      this.error = ''
      try {
        const { data } = await api.post<ContaBancaria>(BASE, { ...payload, ...extras })
        this.items.push(data)
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

    async update (id: number, payload: Partial<ContaBancaria & ContaExtras>) {
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

    // ====================== Descrições de Banco (múltiplas) ======================

    /**
     * Retorna a descrição ATIVA do banco (ou null se não existir).
     * Preferir bank_id (ISPB/COMPE/slug). Se não tiver, usar bank_name.
     */
    async lookupDescricaoBanco (args: { banco_id?: string, banco_nome?: string }) {
      this.error = ''
      try {
        const params: Record<string, string> = {}
        if (args.banco_id) {
          params.bank_id = args.banco_id
        } else if (args.banco_nome) {
          params.bank_name = args.banco_nome
        } else {
          return null
        }

        const res = await api.get<BankDescricao | undefined>(`${NOTES_BASE}lookup/`, { params })
        if (res.status === 200 && res.data) {
          return res.data
        }
        return null // 204
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    /**
     * Lista TODAS as descrições (variações) de um banco_id, ativa primeiro.
     * Também atualiza o cache interno (notesByBank).
     */
    async listDescricoes (banco_id: string) {
      this.error = ''
      try {
        const { data } = await api.get<BankDescricao[]>(`${NOTES_BASE}variacoes/`, {
          params: { bank_id: banco_id },
        })
        this.notesByBank[banco_id] = Array.isArray(data) ? data : []
        return this.notesByBank[banco_id]
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    /**
     * Cria uma NOVA variação de descrição para o banco. Se is_ativa=true,
     * ela é marcada ativa e as demais são desativadas pelo backend.
     * Após criar, refaz o cache via listDescricoes().
     */
    async createDescricaoBanco (payload: { banco_id: string, banco_nome: string, descricao: string, is_ativa?: boolean }) {
      this.error = ''
      try {
        const { data } = await api.post<BankDescricao>(NOTES_BASE, payload)
        await this.listDescricoes(data.banco_id)
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    /**
     * Edita uma descrição existente. Se is_ativa=true, torna-a ativa e
     * desativa as demais. Atualiza o cache em seguida.
     */
    async updateDescricaoBanco (id: number, payload: Partial<Pick<BankDescricao, 'descricao' | 'is_ativa'>>) {
      this.error = ''
      try {
        const { data } = await api.patch<BankDescricao>(`${NOTES_BASE}${id}/`, payload)
        await this.listDescricoes(data.banco_id)
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    /**
     * Marca a descrição (id) como ATIVA usando a ação dedicada.
     * Atualiza o cache do banco correspondente.
     */
    async setDescricaoAtiva (id: number) {
      this.error = ''
      try {
        const { data } = await api.post<BankDescricao>(`${NOTES_BASE}${id}/set-ativa/`)
        await this.listDescricoes(data.banco_id)
        return data
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    /**
     * Mantida por compatibilidade, mas agora cria uma nova variação e define como ativa.
     * Use createDescricaoBanco/updateDescricaoBanco/setDescricaoAtiva nos fluxos novos.
     */
    async upsertDescricaoBanco (payload: { banco_id: string, banco_nome: string, descricao: string }) {
      return this.createDescricaoBanco({ ...payload, is_ativa: true })
    },
  },
})
