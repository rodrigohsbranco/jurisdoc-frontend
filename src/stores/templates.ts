import type { AxiosError } from 'axios'
import { defineStore } from 'pinia'
import api from '@/services/api' // axios instance com interceptors de auth

// Tipos básicos
export interface TemplateItem {
  id: number
  name: string
  file: string // URL retornada pelo DRF
  active: boolean
}

export type FieldType =
  | 'string'
  | 'int'
  | 'bool'
  | 'date'
  | 'cpf'
  | 'cnpj'
  | 'cep'
  | 'phone'
  | 'email'

export interface TemplateField {
  raw: string
  name: string
  type: FieldType
}

export interface FieldsResponse {
  syntax: string
  fields: TemplateField[]
}

export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  active?: boolean
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface RenderOptions {
  context: Record<string, unknown>
  filename?: string
}

export interface RenderResult {
  blob: Blob
  filename: string
}

function toFormData (payload: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null) {
      continue
    }
    if (v instanceof Blob) {
      fd.append(k, v)
    } else if (Array.isArray(v)) {
      for (const vv of v) {
        fd.append(k, String(vv))
      }
    } else {
      fd.append(k, String(v))
    }
  }
  return fd
}

function parseContentDispositionFilename (value?: string | null): string | null {
  if (!value) {
    return null
  }
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(value)
  const raw = decodeURIComponent(m?.[1] ?? m?.[2] ?? '')
  return raw || null
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

export const useTemplatesStore = defineStore('templates', {
  state: () => ({
    items: [] as TemplateItem[],
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    loadingList: false,
    loadingMutation: false,
    fieldsCache: new Map<number, FieldsResponse>(),
    lastError: null as string | null,
  }),

  getters: {
    byId: state => (id: number) => state.items.find(t => t.id === id) || null,
  },

  actions: {
    // LISTAR
    async fetch (params: ListParams = {}): Promise<void> {
      this.loadingList = true
      this.lastError = null
      try {
        const res = await api.get<Paginated<TemplateItem>>('/api/templates/', {
          params: buildQuery({
            page: params.page ?? 1,
            page_size: params.page_size ?? 10,
            search: params.search,
            ordering: params.ordering,
            active: params.active,
          }),
        })
        this.items = res.data.results
        this.count = res.data.count
        this.next = res.data.next
        this.previous = res.data.previous
      } catch (error) {
        this.lastError = toMessage(error)
        throw error
      } finally {
        this.loadingList = false
      }
    },

    // CRIAR
    async create (payload: { name: string, file: File, active?: boolean }): Promise<TemplateItem> {
      this.loadingMutation = true
      this.lastError = null
      try {
        const fd = toFormData({ name: payload.name, file: payload.file, active: payload.active ?? true })
        const res = await api.post<TemplateItem>('/api/templates/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        this.items = [res.data, ...this.items]
        this.count += 1
        return res.data
      } catch (error) {
        this.lastError
          = (error as AxiosError<any>).response?.data?.file?.[0]
            || (error as AxiosError<any>).response?.data?.name?.[0]
            || (error as AxiosError<any>).response?.data?.detail
            || (error as AxiosError<any>).message
            || 'Falha ao criar template'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATUALIZAR
    async update (
      id: number,
      payload: Partial<{ name: string, active: boolean, file: File }>,
    ): Promise<TemplateItem> {
      this.loadingMutation = true
      this.lastError = null
      try {
        const hasFile = payload.file instanceof File
        const url = `/api/templates/${id}/`
        const res = hasFile
          ? await api.patch<TemplateItem>(url, toFormData(payload as any), {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          : await api.patch<TemplateItem>(url, payload)

        const idx = this.items.findIndex(t => t.id === id)
        if (idx === -1) {
          this.items.push(res.data) // 🔹 mantém lista sincronizada
        } else {
          this.items[idx] = res.data
        }
        return res.data
      } catch (error) {
        this.lastError = toMessage(error)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATIVAR/DESATIVAR
    async setActive (id: number, active: boolean): Promise<TemplateItem> {
      return this.update(id, { active })
    },

    // REMOVER
    async remove (id: number): Promise<void> {
      this.loadingMutation = true
      this.lastError = null
      try {
        await api.delete(`/api/templates/${id}/`)
        this.items = this.items.filter(t => t.id !== id)
        this.count = Math.max(0, this.count - 1)
      } catch (error) {
        this.lastError = toMessage(error)
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // CAMPOS
    async fetchFields (id: number, { force = false }: { force?: boolean } = {}): Promise<FieldsResponse> {
      if (!force && this.fieldsCache.has(id)) {
        return this.fieldsCache.get(id) as FieldsResponse
      }
      try {
        const res = await api.get<FieldsResponse>(`/api/templates/${id}/fields/`)
        this.fieldsCache.set(id, res.data)
        return res.data
      } catch (error) {
        this.lastError = toMessage(error)
        throw error
      }
    },

    // RENDER
    async render (id: number, opts: RenderOptions): Promise<RenderResult> {
      const body = {
        context: opts.context || {},
        ...(opts.filename ? { filename: opts.filename } : {}),
      }
      try {
        const res = await api.post(`/api/templates/${id}/render/`, body, {
          responseType: 'blob',
        })
        const cd = res.headers['content-disposition'] as string | undefined
        const fname = parseContentDispositionFilename(cd) || `${opts.filename || 'documento'}.docx`
        return { blob: res.data as Blob, filename: fname }
      } catch (error) {
        const e = error as AxiosError<any>
        if (e.response?.data instanceof Blob) {
          try {
            if (e.response.data.type === 'application/json') {
              const json = JSON.parse(await e.response.data.text())
              this.lastError = json.detail || JSON.stringify(json)
            } else {
              this.lastError = await e.response.data.text()
            }
          } catch {
            this.lastError = e.message
          }
        } else {
          this.lastError = toMessage(error)
        }
        throw error
      }
    },

    // DOWNLOAD
    downloadRendered (result: RenderResult): void {
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.append(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  },
})
