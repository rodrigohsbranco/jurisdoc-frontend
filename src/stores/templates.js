import { defineStore } from 'pinia';
import api from '@/services/api'; // axios instance com interceptors de auth
function toFormData(payload) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) {
        if (v === undefined || v === null) {
            continue;
        }
        if (v instanceof Blob) {
            fd.append(k, v);
        }
        else if (Array.isArray(v)) {
            for (const vv of v) {
                fd.append(k, String(vv));
            }
        }
        else {
            fd.append(k, String(v));
        }
    }
    return fd;
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
function toMessage(e) {
    if (!e?.response) {
        return 'Falha de rede. Verifique se a API está no ar.';
    }
    const d = e.response.data;
    if (d?.detail) {
        return d.detail;
    }
    if (d && typeof d === 'object') {
        const k = Object.keys(d)[0];
        const msg = Array.isArray(d[k]) ? d[k][0] : d[k];
        if (msg) {
            return String(msg);
        }
    }
    return e.message || 'Ocorreu um erro inesperado.';
}
export const useTemplatesStore = defineStore('templates', {
    state: () => ({
        items: [],
        count: 0,
        next: null,
        previous: null,
        loadingList: false,
        loadingMutation: false,
        fieldsCache: new Map(),
        lastError: null,
    }),
    getters: {
        byId: state => (id) => state.items.find(t => t.id === id) || null,
    },
    actions: {
        // LISTAR
        async fetch(params = {}) {
            this.loadingList = true;
            this.lastError = null;
            try {
                const res = await api.get('/api/templates/', {
                    params: buildQuery({
                        page: params.page ?? 1,
                        page_size: params.page_size ?? 10,
                        search: params.search,
                        ordering: params.ordering,
                        active: params.active,
                    }),
                });
                this.items = res.data.results;
                this.count = res.data.count;
                this.next = res.data.next;
                this.previous = res.data.previous;
            }
            catch (error) {
                this.lastError = toMessage(error);
                throw error;
            }
            finally {
                this.loadingList = false;
            }
        },
        // CRIAR
        async create(payload) {
            this.loadingMutation = true;
            this.lastError = null;
            try {
                const fd = toFormData({ name: payload.name, file: payload.file, active: payload.active ?? true });
                const res = await api.post('/api/templates/', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                this.items = [res.data, ...this.items];
                this.count += 1;
                return res.data;
            }
            catch (error) {
                this.lastError
                    = error.response?.data?.file?.[0]
                        || error.response?.data?.name?.[0]
                        || error.response?.data?.detail
                        || error.message
                        || 'Falha ao criar template';
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // ATUALIZAR
        async update(id, payload) {
            this.loadingMutation = true;
            this.lastError = null;
            try {
                const hasFile = payload.file instanceof File;
                const url = `/api/templates/${id}/`;
                const res = hasFile
                    ? await api.patch(url, toFormData(payload), {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    })
                    : await api.patch(url, payload);
                const idx = this.items.findIndex(t => t.id === id);
                if (idx === -1) {
                    this.items.push(res.data); // 🔹 mantém lista sincronizada
                }
                else {
                    this.items[idx] = res.data;
                }
                return res.data;
            }
            catch (error) {
                this.lastError = toMessage(error);
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // ATIVAR/DESATIVAR
        async setActive(id, active) {
            return this.update(id, { active });
        },
        // REMOVER
        async remove(id) {
            this.loadingMutation = true;
            this.lastError = null;
            try {
                await api.delete(`/api/templates/${id}/`);
                this.items = this.items.filter(t => t.id !== id);
                this.count = Math.max(0, this.count - 1);
            }
            catch (error) {
                this.lastError = toMessage(error);
                throw error;
            }
            finally {
                this.loadingMutation = false;
            }
        },
        // CAMPOS
        async fetchFields(id, { force = false } = {}) {
            if (!force && this.fieldsCache.has(id)) {
                return this.fieldsCache.get(id);
            }
            try {
                const res = await api.get(`/api/templates/${id}/fields/`);
                this.fieldsCache.set(id, res.data);
                return res.data;
            }
            catch (error) {
                this.lastError = toMessage(error);
                throw error;
            }
        },
        // RENDER
        async render(id, opts) {
            const body = {
                context: opts.context || {},
                ...(opts.filename ? { filename: opts.filename } : {}),
            };
            try {
                const res = await api.post(`/api/templates/${id}/render/`, body, {
                    responseType: 'blob',
                });
                const cd = res.headers['content-disposition'];
                const fname = parseContentDispositionFilename(cd) || `${opts.filename || 'documento'}.docx`;
                return { blob: res.data, filename: fname };
            }
            catch (error) {
                const e = error;
                if (e.response?.data instanceof Blob) {
                    try {
                        if (e.response.data.type === 'application/json') {
                            const json = JSON.parse(await e.response.data.text());
                            this.lastError = json.detail || JSON.stringify(json);
                        }
                        else {
                            this.lastError = await e.response.data.text();
                        }
                    }
                    catch {
                        this.lastError = e.message;
                    }
                }
                else {
                    this.lastError = toMessage(error);
                }
                throw error;
            }
        },
        // DOWNLOAD
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
