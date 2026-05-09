import { defineStore } from 'pinia'
import api, { fetchAllPages } from '@/services/api'
import { friendlyError } from '@/utils/errorMessages'

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
  search?: string
  ordering?: string
  active?: boolean
  page?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
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

export const useTemplatesStore = defineStore('templates', {
  state: () => ({
    items: [] as TemplateItem[],
    totalItems: 0,
    currentPage: 1,
    pageSize: 10,
    loadingList: false,
    loadingMutation: false,
    fieldsCache: new Map<number, FieldsResponse>(),
    lastError: null as string | null,
  }),

  getters: {
    byId: state => (id: number) => state.items.find(t => t.id === id) || null,
    totalPages: state => Math.ceil(state.totalItems / state.pageSize),
  },

  actions: {
    // LISTAR (paginado)
    async fetch (params: ListParams = {}): Promise<void> {
      this.loadingList = true
      this.lastError = null
      try {
        const res = await api.get<PaginatedResponse<TemplateItem>>('/api/templates/', {
          params: buildQuery({
            search: params.search,
            ordering: params.ordering,
            active: params.active,
            page: params.page ?? this.currentPage,
            page_size: params.page_size ?? this.pageSize,
          }),
        })
        this.items = res.data.results
        this.totalItems = res.data.count
        if (params.page) this.currentPage = params.page
        if (params.page_size) this.pageSize = params.page_size
      } catch (error) {
        this.lastError = friendlyError(error, 'templates', 'list')
        throw error
      } finally {
        this.loadingList = false
      }
    },

    // LISTAR TODOS (para selects em outras views)
    async fetchAll (params: { active?: boolean } = {}): Promise<TemplateItem[]> {
      try {
        return await fetchAllPages<TemplateItem>('/api/templates/', {
          params: buildQuery({
            active: params.active,
            page_size: 100,
          }),
        })
      } catch (error) {
        this.lastError = friendlyError(error, 'templates', 'list')
        throw error
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
        return res.data
      } catch (error) {
        this.lastError = friendlyError(error, 'templates', 'create')
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
        this.lastError = friendlyError(error, 'templates', 'update')
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
      } catch (error) {
        this.lastError = friendlyError(error, 'templates', 'remove')
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
        this.lastError = friendlyError(error, 'templates', 'fields')
        throw error
      }
    },

    // RENDER (.docx)
    async render (id: number, opts: RenderOptions): Promise<RenderResult> {
      return this._renderInternal(id, opts, 'docx')
    },

    // RENDER (PDF, via LibreOffice no backend)
    async renderPdf (id: number, opts: RenderOptions): Promise<RenderResult> {
      return this._renderInternal(id, opts, 'pdf')
    },

    async _renderInternal (id: number, opts: RenderOptions, format: 'docx' | 'pdf'): Promise<RenderResult> {
      const body = {
        context: opts.context || {},
        ...(opts.filename ? { filename: opts.filename } : {}),
      }
      const url = format === 'pdf'
        ? `/api/templates/${id}/render-pdf/`
        : `/api/templates/${id}/render/`
      try {
        const res = await api.post(url, body, {
          responseType: 'blob',
          validateStatus: (status) => status < 500, // aceita 400 para extrair detail
        })
        if (res.status === 400) {
          const errorText = await (res.data as Blob).text()
          let errorDetail = errorText
          try {
            const errorJson = JSON.parse(errorText)
            errorDetail = errorJson.detail || errorText
          } catch {
            // texto puro
          }
          throw new Error(errorDetail)
        }

        const cd = res.headers['content-disposition'] as string | undefined
        const fname = parseContentDispositionFilename(cd) || `${opts.filename || 'documento'}.${format}`
        return { blob: res.data as Blob, filename: fname }
      } catch (error: any) {
        let detail = ''
        if (error.response?.data instanceof Blob) {
          try {
            const text = await error.response.data.text()
            if (error.response.data.type === 'application/json') {
              try {
                const json = JSON.parse(text)
                detail = json.detail || JSON.stringify(json)
              } catch {
                detail = text
              }
            } else {
              detail = text
            }
          } catch {
            // ignora; cai no friendlyError abaixo
          }
        }
        this.lastError = detail || friendlyError(error, 'templates', 'render')
        // Repropaga com a mensagem detalhada para a view conseguir exibir
        // (e.response.data é Blob; um Error simples carrega a mensagem em .message)
        throw detail ? new Error(detail) : error
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
