import { defineStore } from 'pinia'
import api from '@/services/api'

// =======================
// Tipos
// =======================
export type Cliente = {
  id: number
  nome_completo: string
  qualificacao?: string | null // mantido no back; pode ocultar no front
  cpf?: string | null
  rg?: string | null
  orgao_expedidor?: string | null

  // Sinalizadores
  se_idoso?: boolean
  se_incapaz?: boolean
  se_crianca_adolescente?: boolean

  // Dados civis
  nacionalidade?: string | null
  estado_civil?: string | null
  profissao?: string | null

  // Endereço
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  uf?: string | null

  // Status
  is_active?: boolean

  // Auditoria
  criado_em?: string
  atualizado_em?: string
}

export type Representante = {
  id: number
  cliente: number

  // Identificação
  nome_completo: string
  cpf?: string | null
  rg?: string | null
  orgao_expedidor?: string | null

  // Sinalizadores
  se_idoso?: boolean
  se_incapaz?: boolean
  se_crianca_adolescente?: boolean

  // Dados civis
  nacionalidade?: string | null
  estado_civil?: string | null
  profissao?: string | null

  // Endereço
  usa_endereco_do_cliente?: boolean
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null

  // Auditoria
  criado_em?: string
  atualizado_em?: string
}

type ListParams = {
  search?: string
  ordering?: string // ex.: 'nome_completo' ou '-criado_em'
}

// =======================
// Helpers
// =======================
function toMessage (e: any): string {
  // mapeia erros do Axios/DRF para string amigável
  if (!e?.response) {
    return 'Falha de rede. Verifique se a API está no ar.'
  }
  const d = e.response.data
  if (typeof d === 'string') {
    return d
  }
  return (
    d?.detail
    || d?.non_field_errors?.[0]
    // tenta primeira key de erro de campo
    || (d && typeof d === 'object'
      ? String(
          (() => {
            const k = Object.keys(d)[0]
            const v = Array.isArray((d as any)[k]) ? (d as any)[k][0] : (d as any)[k]
            return v ?? 'Ocorreu um erro. Tente novamente.'
          })(),
        )
      : 'Ocorreu um erro. Tente novamente.')
  )
}

const BASE = '/api/cadastro/clientes/'
const REPS_BASE = '/api/cadastro/representantes/'

// =======================
// Store
// =======================
export const useClientesStore = defineStore('clientes', {
  state: () => ({
    items: [] as Cliente[],
    loading: false,
    error: '' as string,

    // filtros padrão (server-side)
    params: {
      search: '',
      ordering: 'nome_completo',
    } as Required<Pick<ListParams, 'search' | 'ordering'>>,

    // ---------- Representantes por cliente ----------
    representantesByCliente: {} as Record<number, Representante[]>,
    repsLoadingByCliente: {} as Record<number, boolean>,
    repsErrorByCliente: {} as Record<number, string>,
  }),

  getters: {
    hasError: s => !!s.error,

    // Representantes helpers
    representantesDoCliente: s => (clienteId: number) =>
      s.representantesByCliente[clienteId] || [],
    temRepresentante: s => (clienteId: number) =>
      (s.representantesByCliente[clienteId]?.length ?? 0) > 0,
  },

  actions: {
    setParams (p: Partial<ListParams>) {
      this.params = { ...this.params, ...p }
    },

    resetParams () {
      this.params = { search: '', ordering: 'nome_completo' }
    },

    // ========= Clientes: CRUD =========
    async fetchList (overrides?: Partial<ListParams>) {
      this.loading = true
      this.error = ''
      try {
        const params = { ...this.params, ...overrides }
        const { data } = await api.get<Cliente[]>(BASE, { params })
        this.items = Array.isArray(data) ? data : []
        // se vier override, sincroniza no estado
        this.params = {
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
        // limpa reps cache daquele cliente
        delete this.representantesByCliente[id]
        delete this.repsLoadingByCliente[id]
        delete this.repsErrorByCliente[id]
      } catch (error: any) {
        this.error = toMessage(error)
        throw error
      }
    },

    // ========= Representantes: CRUD (escopo dentro de clientes) =========

    /**
     * Lista representantes de um cliente. Usa cache por padrão.
     * Passe { force: true } para recarregar do servidor.
     */
    async fetchRepresentantes (
      clienteId: number,
      opts: { force?: boolean } = {},
    ): Promise<Representante[]> {
      const { force = false } = opts
      if (!force && this.representantesByCliente[clienteId]) {
        return this.representantesByCliente[clienteId]
      }
      this.repsLoadingByCliente[clienteId] = true
      this.repsErrorByCliente[clienteId] = ''
      try {
        const { data } = await api.get<Representante[]>(REPS_BASE, {
          params: { cliente: clienteId },
        })
        this.representantesByCliente[clienteId] = Array.isArray(data) ? data : []
        return this.representantesByCliente[clienteId]
      } catch (error: any) {
        this.repsErrorByCliente[clienteId] = toMessage(error)
        throw error
      } finally {
        this.repsLoadingByCliente[clienteId] = false
      }
    },

    async createRepresentante (
      payload: Omit<Representante, 'id' | 'criado_em' | 'atualizado_em'>,
    ): Promise<Representante> {
      const clienteId = Number(payload.cliente)
      this.repsErrorByCliente[clienteId] = ''
      try {
        const { data } = await api.post<Representante>(REPS_BASE, payload)
        const list = this.representantesByCliente[clienteId] || []
        this.representantesByCliente[clienteId] = [data, ...list]
        return data
      } catch (error: any) {
        this.repsErrorByCliente[clienteId] = toMessage(error)
        throw error
      }
    },

    async updateRepresentante (
      id: number,
      patch: Partial<Representante>,
      clienteIdHint = 0,
    ): Promise<Representante> {
      // tenta descobrir o clienteId com base no cache, caso não tenha sido passado
      let clienteId = clienteIdHint ?? 0
      if (!clienteId) {
        for (const [cidStr, reps] of Object.entries(this.representantesByCliente)) {
          const found = reps.find(r => r.id === id)
          if (found) {
            clienteId = Number(cidStr)
            break
          }
        }
      }
      if (!clienteId && patch.cliente) {
        clienteId = Number(patch.cliente)
      }

      try {
        const { data } = await api.patch<Representante>(`${REPS_BASE}${id}/`, patch)
        const arr = this.representantesByCliente[clienteId]
        if (arr) {
          const idx = arr.findIndex(r => r.id === id)
          if (idx !== -1) {
            arr.splice(idx, 1, data)
          }
        }
        return data
      } catch (error: any) {
        if (clienteId) {
          this.repsErrorByCliente[clienteId] = toMessage(error)
        }
        throw error
      }
    },

    async removeRepresentante (id: number, clienteIdHint = 0): Promise<void> {
      // idem: tenta inferir clienteId
      let clienteId = clienteIdHint ?? 0
      if (!clienteId) {
        for (const [cidStr, reps] of Object.entries(this.representantesByCliente)) {
          const found = reps.some(r => r.id === id)
          if (found) {
            clienteId = Number(cidStr)
            break
          }
        }
      }
      try {
        await api.delete(`${REPS_BASE}${id}/`)
        if (clienteId && this.representantesByCliente[clienteId]) {
          this.representantesByCliente[clienteId]
            = this.representantesByCliente[clienteId].filter(r => r.id !== id)
        }
      } catch (error: any) {
        if (clienteId) {
          this.repsErrorByCliente[clienteId] = toMessage(error)
        }
        throw error
      }
    },

    /**
     * Atalho: aciona a cópia do endereço do cliente no representante via flag
     * 'usa_endereco_do_cliente = true' (o back efetua a cópia).
     */
    async usarEnderecoDoClienteNoRepresentante (id: number, clienteIdHint?: number) {
      return this.updateRepresentante(id, { usa_endereco_do_cliente: true }, clienteIdHint)
    },

    /**
     * (Opcional) Propaga o endereço atual do cliente para todos os representantes
     * dele que estejam marcados com usa_endereco_do_cliente = true.
     */
    async propagarEnderecoParaRepsQueUsamCliente (clienteId: number) {
      const reps = await this.fetchRepresentantes(clienteId, { force: false })
      const targets = reps.filter(r => r.usa_endereco_do_cliente)
      for (const r of targets) {
        // basta enviar a flag novamente; o back copiará o endereço atual do cliente
        await this.updateRepresentante(r.id, { usa_endereco_do_cliente: true }, clienteId)
      }
      return targets.length
    },
  },
})
