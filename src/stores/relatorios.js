// src/stores/relatorios.ts
import { defineStore } from 'pinia';
import api from '@/services/api';
// ===== Helpers =====
function parseContentDispositionFilename(value) {
    if (!value) {
        return null;
    }
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(value);
    const raw = decodeURIComponent(m?.[1] ?? m?.[2] ?? '');
    return raw || null;
}
function buildQuery(params) {
    const q = {};
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') {
            continue;
        }
        q[k] = v;
    }
    return q;
}
function toErrorMessage(e) {
    const ax = e;
    return (ax.response?.data?.detail
        || ax.message
        || 'Falha ao carregar relatórios');
}
// ===== Store =====
export const useRelatoriosStore = defineStore('relatorios', {
    state: () => ({
        // dados
        timeseries: null,
        templatesUsage: [],
        dataQuality: null,
        // loading flags
        loading: {
            timeseries: false,
            templates: false,
            quality: false,
            export: false,
        },
        // erro global simples (p/ banners/alerts)
        error: '',
    }),
    getters: {
        hasError: s => !!s.error,
    },
    actions: {
        resetError() {
            this.error = '';
        },
        // --- Séries históricas ---
        async fetchTimeSeries(params = {}) {
            this.loading.timeseries = true;
            this.resetError();
            try {
                const { data } = await api.get('/api/reports/timeseries/', {
                    params: buildQuery({
                        bucket: params.bucket ?? 'day',
                        date_from: params.date_from,
                        date_to: params.date_to,
                    }),
                });
                this.timeseries = data;
            }
            catch (error) {
                this.error = toErrorMessage(error);
                throw error;
            }
            finally {
                this.loading.timeseries = false;
            }
        },
        // --- Top templates ---
        async fetchTemplatesUsage(params = {}) {
            this.loading.templates = true;
            this.resetError();
            try {
                const { data } = await api.get('/api/reports/templates-usage/', {
                    params: buildQuery({
                        top: params.top ?? 10,
                        date_from: params.date_from,
                        date_to: params.date_to,
                    }),
                });
                this.templatesUsage = data;
            }
            catch (error) {
                this.error = toErrorMessage(error);
                throw error;
            }
            finally {
                this.loading.templates = false;
            }
        },
        // --- Qualidade de dados (clientes) ---
        async fetchDataQuality() {
            this.loading.quality = true;
            this.resetError();
            try {
                const { data } = await api.get('/api/reports/data-quality/');
                this.dataQuality = data;
            }
            catch (error) {
                this.error = toErrorMessage(error);
                throw error;
            }
            finally {
                this.loading.quality = false;
            }
        },
        // --- Exportação CSV de petições ---
        async exportPetitionsCSV(params = {}) {
            this.loading.export = true;
            this.resetError();
            try {
                const res = await api.get('/api/reports/export/petitions/', {
                    params: buildQuery({
                        date_from: params.date_from,
                        date_to: params.date_to,
                        template: params.template,
                        cliente: params.cliente,
                    }),
                    responseType: 'blob',
                });
                const cd = res.headers['content-disposition'];
                const filename = parseContentDispositionFilename(cd) || params.filename || 'peticoes.csv';
                const blob = res.data;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.append(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }
            catch (error) {
                this.error = toErrorMessage(error);
                throw error;
            }
            finally {
                this.loading.export = false;
            }
        },
    },
});
