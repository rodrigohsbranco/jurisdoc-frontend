import type { AxiosError } from 'axios'
// src/stores/relatorios.ts
import { defineStore } from 'pinia'
import api from '@/services/api'

// ===== Tipos =====
export type Bucket = 'day' | 'week' | 'month'

export interface TimeSeriesPoint {
  period: string // "YYYY-MM-DD" ou "YYYY-MM"
  clientes: number
  peticoes_criadas: number
  peticoes_atualizadas: number
}
export interface TimeSeriesResponse {
  bucket: Bucket
  date_from: string // ISO (YYYY-MM-DD)
  date_to: string // ISO
  series: TimeSeriesPoint[]
}

export interface TemplatesUsageItem {
  template_id: number
  template: string
  count: number
}
export type TemplatesUsageResponse = TemplatesUsageItem[]

export interface DataQualityResponse {
  total_clientes: number
  sem_cpf: number
  sem_endereco: number
  com_conta_principal: number
}

export interface ExportPetitionsParams {
  date_from?: string // "YYYY-MM-DD"
  date_to?: string // "YYYY-MM-DD"
  template?: number
  cliente?: number
  filename?: string // nome sugerido p/ o arquivo
}

// ===== Helpers =====
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

function toErrorMessage (e: any): string {
  const ax = e as AxiosError<any>
  return (
    ax.response?.data?.detail
    || ax.message
    || 'Falha ao carregar relatórios'
  )
}

// ===== Store =====
export const useRelatoriosStore = defineStore('relatorios', {
  state: () => ({
    // dados
    timeseries: null as TimeSeriesResponse | null,
    templatesUsage: [] as TemplatesUsageResponse,
    dataQuality: null as DataQualityResponse | null,

    // loading flags
    loading: {
      timeseries: false,
      templates: false,
      quality: false,
      export: false,
    } as Record<'timeseries' | 'templates' | 'quality' | 'export', boolean>,

    // erro global simples (p/ banners/alerts)
    error: '' as string,
  }),

  getters: {
    hasError: s => !!s.error,
  },

  actions: {
    resetError () {
      this.error = ''
    },

    // --- Séries históricas ---
    async fetchTimeSeries (params: {
      bucket?: Bucket
      date_from?: string
      date_to?: string
    } = {}) {
      this.loading.timeseries = true
      this.resetError()
      try {
        const { data } = await api.get<TimeSeriesResponse>('/api/reports/timeseries/', {
          params: buildQuery({
            bucket: params.bucket ?? 'day',
            date_from: params.date_from,
            date_to: params.date_to,
          }),
        })
        this.timeseries = data
      } catch (error) {
        this.error = toErrorMessage(error)
        throw error
      } finally {
        this.loading.timeseries = false
      }
    },

    // --- Top templates ---
    async fetchTemplatesUsage (params: {
      top?: number
      date_from?: string
      date_to?: string
    } = {}) {
      this.loading.templates = true
      this.resetError()
      try {
        const { data } = await api.get<TemplatesUsageResponse>('/api/reports/templates-usage/', {
          params: buildQuery({
            top: params.top ?? 10,
            date_from: params.date_from,
            date_to: params.date_to,
          }),
        })
        this.templatesUsage = data
      } catch (error) {
        this.error = toErrorMessage(error)
        throw error
      } finally {
        this.loading.templates = false
      }
    },

    // --- Qualidade de dados (clientes) ---
    async fetchDataQuality () {
      this.loading.quality = true
      this.resetError()
      try {
        const { data } = await api.get<DataQualityResponse>('/api/reports/data-quality/')
        this.dataQuality = data
      } catch (error) {
        this.error = toErrorMessage(error)
        throw error
      } finally {
        this.loading.quality = false
      }
    },

    // --- Exportação CSV de petições ---
    async exportPetitionsCSV (params: ExportPetitionsParams = {}) {
      this.loading.export = true
      this.resetError()
      try {
        const res = await api.get('/api/reports/export/petitions/', {
          params: buildQuery({
            date_from: params.date_from,
            date_to: params.date_to,
            template: params.template,
            cliente: params.cliente,
          }),
          responseType: 'blob',
        })

        const cd = (res.headers as any)['content-disposition'] as string | undefined
        const filename = parseContentDispositionFilename(cd) || params.filename || 'peticoes.csv'

        const blob = res.data as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.append(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (error) {
        this.error = toErrorMessage(error)
        throw error
      } finally {
        this.loading.export = false
      }
    },
  },
})
