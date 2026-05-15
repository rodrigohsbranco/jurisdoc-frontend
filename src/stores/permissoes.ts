import { defineStore } from 'pinia'
import {
  createPermissao,
  deletePermissao,
  getCapacidadesAgrupadas,
  getPermissao,
  listCapacidades,
  listPermissoes,
  updatePermissao,
  type Capacidade,
  type CapacidadesAgrupadas,
  type Permissao,
} from '@/services/permissoes'
import { friendlyError } from '@/utils/errorMessages'

export const usePermissoesStore = defineStore('permissoes', {
  state: () => ({
    items: [] as Permissao[],
    capacidades: [] as Capacidade[],
    agrupadas: [] as CapacidadesAgrupadas,

    loading: false,
    loadingMutation: false,
    loadingCatalog: false,
    error: '' as string,
  }),

  getters: {
    porId: s => (id: number) => s.items.find(p => p.id === id) || null,
    totalUsuarios: s => s.items.reduce((acc, p) => acc + (p.usuarios_count || 0), 0),
  },

  actions: {
    async fetchList () {
      this.loading = true
      this.error = ''
      try {
        this.items = await listPermissoes()
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'list')
      } finally {
        this.loading = false
      }
    },

    async fetchCatalog () {
      if (this.agrupadas.length && this.capacidades.length) return
      this.loadingCatalog = true
      try {
        const [agrupadas, flat] = await Promise.all([
          getCapacidadesAgrupadas(),
          listCapacidades(),
        ])
        this.agrupadas = agrupadas
        this.capacidades = flat
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'list')
      } finally {
        this.loadingCatalog = false
      }
    },

    async getDetail (id: number) {
      try {
        const p = await getPermissao(id)
        const idx = this.items.findIndex(x => x.id === id)
        if (idx === -1) this.items.unshift(p)
        else this.items[idx] = p
        return p
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'list')
        throw error
      }
    },

    async create (payload: Partial<Permissao>) {
      this.loadingMutation = true
      this.error = ''
      try {
        const created = await createPermissao(payload)
        this.items.unshift(created)
        return created
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'create')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async update (id: number, payload: Partial<Permissao>) {
      this.loadingMutation = true
      this.error = ''
      try {
        const updated = await updatePermissao(id, payload)
        const idx = this.items.findIndex(x => x.id === id)
        if (idx !== -1) this.items[idx] = { ...this.items[idx], ...updated }
        return updated
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'update')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    async remove (id: number) {
      this.loadingMutation = true
      this.error = ''
      try {
        await deletePermissao(id)
        this.items = this.items.filter(p => p.id !== id)
      } catch (error: any) {
        this.error = friendlyError(error, 'permissoes', 'remove')
        throw error
      } finally {
        this.loadingMutation = false
      }
    },
  },
})
