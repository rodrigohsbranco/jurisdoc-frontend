import { defineStore } from 'pinia'
import api, { fetchAllPages } from '@/services/api'
import { friendlyError } from '@/utils/errorMessages'

export interface OabUf {
  id?: number
  advogado?: number
  uf: string
  numero_oab: string
  unidade_apoio_nome: string
  unidade_apoio_endereco: string
}

export interface Advogado {
  id: number
  nome_completo: string
  nacionalidade: string
  estado_civil: string
  genero: string
  is_socio: boolean
  escritorio_nome: string
  escritorio_cnpj: string
  ativo: boolean
  oabs?: OabUf[]
  total_ufs?: number
  criado_em?: string
  atualizado_em?: string
}

export interface AdvogadoPorUf {
  id: number
  nome_completo: string
  nacionalidade: string
  estado_civil: string
  genero: string
  is_socio: boolean
  escritorio_nome: string
  escritorio_cnpj: string
  numero_oab: string
  unidade_apoio_nome: string
  unidade_apoio_endereco: string
}

const BASE = '/api/advogados/'

export const useAdvogadosStore = defineStore('advogados', {
  state: () => ({
    items: [] as Advogado[],
    loading: false,
    error: '' as string,
  }),

  actions: {
    async fetchList () {
      this.loading = true
      this.error = ''
      try {
        this.items = await fetchAllPages<Advogado>(BASE)
      } catch (e: any) {
        this.error = friendlyError(e)
      } finally {
        this.loading = false
      }
    },

    async getDetail (id: number): Promise<Advogado | null> {
      try {
        const { data } = await api.get<Advogado>(`${BASE}${id}/`)
        return data
      } catch (e: any) {
        this.error = friendlyError(e)
        return null
      }
    },

    async create (payload: Partial<Advogado>): Promise<Advogado> {
      const { data } = await api.post<Advogado>(BASE, payload)
      await this.fetchList()
      return data
    },

    async update (id: number, payload: Partial<Advogado>): Promise<Advogado> {
      const { data } = await api.patch<Advogado>(`${BASE}${id}/`, payload)
      await this.fetchList()
      return data
    },

    async remove (id: number) {
      await api.delete(`${BASE}${id}/`)
      this.items = this.items.filter(a => a.id !== id)
    },

    // OABs
    async addOab (advogadoId: number, oab: Partial<OabUf>): Promise<OabUf> {
      const { data } = await api.post<OabUf>(`${BASE}${advogadoId}/oabs/`, oab)
      return data
    },

    async updateOab (advogadoId: number, oabId: number, oab: Partial<OabUf>): Promise<OabUf> {
      const { data } = await api.patch<OabUf>(`${BASE}${advogadoId}/oabs/${oabId}/`, oab)
      return data
    },

    async removeOab (advogadoId: number, oabId: number) {
      await api.delete(`${BASE}${advogadoId}/oabs/${oabId}/`)
    },

    // Buscar por UF (para o Kit)
    async fetchPorUf (uf: string): Promise<AdvogadoPorUf[]> {
      const { data } = await api.get<AdvogadoPorUf[]>(`${BASE}por-uf/`, { params: { uf } })
      return data
    },
  },
})
