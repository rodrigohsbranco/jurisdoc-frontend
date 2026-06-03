import { defineStore } from 'pinia'
import {
  type ClausulaPadrao,
  type ClausulaResolved,
  type ClausulaUF,
  createUf,
  deleteUf,
  getPadrao,
  listUfs,
  resolve as resolveApi,
  updatePadrao,
  updateUf,
} from '@/services/clausulas'
import { friendlyError } from '@/utils/errorMessages'

interface State {
  padrao: ClausulaPadrao | null
  ufs: ClausulaUF[]
  loading: boolean
  loadingMutation: boolean
  error: string
}

export const useClausulasStore = defineStore('clausulas', {
  state: (): State => ({
    padrao: null,
    ufs: [],
    loading: false,
    loadingMutation: false,
    error: '',
  }),

  getters: {
    ufsCadastradas: state => state.ufs.map(u => u.uf.toUpperCase()),
  },

  actions: {
    async fetchAll () {
      this.loading = true
      this.error = ''
      try {
        const [padrao, ufs] = await Promise.all([getPadrao(), listUfs()])
        this.padrao = padrao
        this.ufs = ufs
      } catch (error) {
        this.error = friendlyError(error, 'clausulas', 'list')
        throw error
      } finally {
        this.loading = false
      }
    },

    async savePadrao (texto: string) {
      this.loadingMutation = true
      this.error = ''
      try {
        this.padrao = await updatePadrao(texto)
      } catch (error) {
        this.error = friendlyError(error, 'clausulas', 'update')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async createUf (payload: { uf: string; tipo_acao?: string; texto: string }) {
      this.loadingMutation = true
      this.error = ''
      try {
        const created = await createUf(payload)
        this.ufs = [...this.ufs, created].sort((a, b) => a.uf.localeCompare(b.uf))
        return created
      } catch (error) {
        this.error = friendlyError(error, 'clausulas', 'create')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async updateUf (id: number, payload: Partial<{ uf: string; tipo_acao: string; texto: string }>) {
      this.loadingMutation = true
      this.error = ''
      try {
        const updated = await updateUf(id, payload)
        this.ufs = this.ufs.map(u => (u.id === id ? updated : u))
        return updated
      } catch (error) {
        this.error = friendlyError(error, 'clausulas', 'update')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async removeUf (id: number) {
      this.loadingMutation = true
      this.error = ''
      try {
        await deleteUf(id)
        this.ufs = this.ufs.filter(u => u.id !== id)
      } catch (error) {
        this.error = friendlyError(error, 'clausulas', 'remove')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async resolve (uf: string, tiposAcao: string[] = []): Promise<ClausulaResolved> {
      return await resolveApi(uf, tiposAcao)
    },
  },
})
