import { defineStore } from 'pinia';
import api from '@/services/api';
// ===== Helpers =====
function normalize(p) {
    return {
        ...p,
        cliente: Number(p.cliente),
        template: Number(p.template),
    };
}
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
// ===== Store =====
export const usePeticoesStore = defineStore('peticoes', {
    state: () => ({
        items: [],
        count: 0,
        next: null,
        previous: null,
        loading: false,
        loadingMutation: false,
        error: null,
        byIdCache: new Map(),
    }),
    getters: {
        byId: state => (id) => state.byIdCache.get(id) || state.items.find(i => i.id === id) || null,
        byCliente: state => (clienteId) => state.items.filter(i => i.cliente === clienteId),
    },
    actions: {
        // LISTAR
        async fetch(params = {}) {
            this.loading = true;
            this.error = null;
            try {
                const res = await api.get('/api/petitions/', {
                    params: buildQuery({
                        page: params.page ?? 1,
                        page_size: params.page_size ?? 10,
                        search: params.search,
                        ordering: params.ordering,
                        cliente: params.cliente,
                        template: params.template,
                    }),
                });
                this.items = res.data.results.map(p => normalize(p));
                this.count = res.data.count;
                this.next = res.data.next;
                this.previous = res.data.previous;
                for (const it of this.items) {
                    this.byIdCache.set(it.id, it);
                }
            }
            catch (error) {
                const e = error;
                this.error = e.response?.data?.detail || e.message || 'Falha ao listar petições';
                throw error;
            }
            finally {
                this.loading = false;
            }
        },
        // DETALHE
        async getDetail(id) {
            this.loading = true;
            this.error = null;
            try {
                const res = await api.get(`/api/petitions/${id}/`);
                const data = normalize(res.data);
                this.byIdCache.set(id, data);
                const idx = this.items.findIndex(i => i.id === id);
                if (idx !== -1) {
                    this.items.splice(idx, 1, data);
                }
                return data;
            }
            catch (error) {
                const e = error;
                this.error = e.response?.data?.detail || e.message || 'Falha ao carregar petição';
                throw error;
            }
            finally {
                this.loading = false;
            }
        },
        // CRIAR
        async create(payload) {
            this.loadingMutation = true;
            this.error = null;
            try {
                const res = await api.post('/api/petitions/', payload);
                const data = normalize(res.data);
                this.items = [data, ...this.items];
                this.count += 1;
                this.byIdCache.set(data.id, data);
                return data;
            }
            catch (error) {
                const e = error;
                this.error = e.response?.data?.detail || e.message || 'Falha ao criar petição';
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // ATUALIZAR
        async update(id, payload) {
            this.loadingMutation = true;
            this.error = null;
            try {
                const res = await api.patch(`/api/petitions/${id}/`, payload);
                const data = normalize(res.data);
                const idx = this.items.findIndex(i => i.id === id);
                if (idx !== -1) {
                    this.items.splice(idx, 1, data);
                }
                this.byIdCache.set(id, data);
                return data;
            }
            catch (error) {
                const e = error;
                this.error = e.response?.data?.detail || e.message || 'Falha ao atualizar petição';
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // REMOVER
        async remove(id) {
            this.loadingMutation = true;
            this.error = null;
            try {
                await api.delete(`/api/petitions/${id}/`);
                this.items = this.items.filter(i => i.id !== id);
                this.count = Math.max(0, this.count - 1);
                this.byIdCache.delete(id);
            }
            catch (error) {
                const e = error;
                this.error = e.response?.data?.detail || e.message || 'Falha ao remover petição';
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // RENDER (download .docx)
        async render(id, opts = {}) {
            try {
                const res = await api.post(`/api/petitions/${id}/render/`, {
                    filename: opts.filename,
                    context_override: opts.context_override,
                    strict: opts.strict,
                }, { responseType: 'blob' });
                const cd = res.headers['content-disposition'];
                const fname = parseContentDispositionFilename(cd) || `${opts.filename || 'peticao'}.docx`;
                return { blob: res.data, filename: fname };
            }
            catch (error) {
                const e = error;
                if (e.response && e.response.data instanceof Blob) {
                    try {
                        const txt = await e.response.data.text();
                        try {
                            const parsed = JSON.parse(txt);
                            this.error = parsed.detail;
                            console.warn('Campos ausentes:', parsed.missing);
                        }
                        catch {
                            this.error = txt;
                        }
                    }
                    catch {
                        this.error = e.message;
                    }
                }
                else {
                    this.error = e.response?.data?.detail || e.message || 'Falha ao renderizar petição';
                }
                throw error;
            }
        },
        // Helper de download
        downloadRendered(result) {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        },
    },
});
