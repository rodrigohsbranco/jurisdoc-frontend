import { defineStore } from 'pinia';
import api from '@/services/api';
// =======================
// Helpers
// =======================
function toMessage(e) {
    // mapeia erros do Axios/DRF para string amigável
    if (!e?.response) {
        return 'Falha de rede. Verifique se a API está no ar.';
    }
    const d = e.response.data;
    if (typeof d === 'string') {
        return d;
    }
    return (d?.detail
        || d?.non_field_errors?.[0]
        // tenta primeira key de erro de campo
        || (d && typeof d === 'object'
            ? String((() => {
                const k = Object.keys(d)[0];
                const v = Array.isArray(d[k]) ? d[k][0] : d[k];
                return v ?? 'Ocorreu um erro. Tente novamente.';
            })())
            : 'Ocorreu um erro. Tente novamente.'));
}
const BASE = '/api/cadastro/clientes/';
const REPS_BASE = '/api/cadastro/representantes/';
// =======================
// Store
// =======================
export const useClientesStore = defineStore('clientes', {
    state: () => ({
        items: [],
        count: 0,
        loading: false,
        error: '',
        // filtros/paginação padrão (server-side)
        params: {
            page: 1,
            page_size: 10,
            search: '',
            ordering: 'nome_completo',
        },
        // ---------- Representantes por cliente ----------
        representantesByCliente: {},
        repsLoadingByCliente: {},
        repsErrorByCliente: {},
    }),
    getters: {
        hasError: s => !!s.error,
        // Representantes helpers
        representantesDoCliente: s => (clienteId) => s.representantesByCliente[clienteId] || [],
        temRepresentante: s => (clienteId) => (s.representantesByCliente[clienteId]?.length ?? 0) > 0,
    },
    actions: {
        setParams(p) {
            this.params = { ...this.params, ...p };
        },
        resetParams() {
            this.params = { page: 1, page_size: 10, search: '', ordering: 'nome_completo' };
        },
        // ========= Clientes: CRUD =========
        async fetchList(overrides) {
            this.loading = true;
            this.error = '';
            try {
                const params = { ...this.params, ...overrides };
                const { data } = await api.get(BASE, { params });
                this.items = data.results;
                this.count = data.count;
                // se vier override, sincroniza no estado
                this.params = {
                    page: params.page ?? 1,
                    page_size: params.page_size ?? 10,
                    search: params.search ?? '',
                    ordering: params.ordering ?? 'nome_completo',
                };
            }
            catch (error) {
                this.error = toMessage(error);
            }
            finally {
                this.loading = false;
            }
        },
        async getDetail(id) {
            this.error = '';
            try {
                const { data } = await api.get(`${BASE}${id}/`);
                // atualiza/insere no cache local
                const i = this.items.findIndex(x => x.id === id);
                if (i === -1) {
                    this.items.unshift(data);
                }
                else {
                    this.items[i] = data;
                }
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        async create(payload) {
            this.error = '';
            try {
                const { data } = await api.post(BASE, payload);
                this.items.unshift(data);
                this.count += 1;
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        async update(id, payload) {
            this.error = '';
            try {
                const { data } = await api.patch(`${BASE}${id}/`, payload);
                const i = this.items.findIndex(x => x.id === id);
                if (i !== -1) {
                    this.items[i] = { ...this.items[i], ...data };
                }
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        async remove(id) {
            this.error = '';
            try {
                await api.delete(`${BASE}${id}/`);
                this.items = this.items.filter(x => x.id !== id);
                this.count = Math.max(0, this.count - 1);
                // limpa reps cache daquele cliente
                delete this.representantesByCliente[id];
                delete this.repsLoadingByCliente[id];
                delete this.repsErrorByCliente[id];
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        // ========= Representantes: CRUD (escopo dentro de clientes) =========
        /**
         * Lista representantes de um cliente. Usa cache por padrão.
         * Passe { force: true } para recarregar do servidor.
         */
        async fetchRepresentantes(clienteId, opts = {}) {
            const { force = false, page_size = 200 } = opts;
            if (!force && this.representantesByCliente[clienteId]) {
                return this.representantesByCliente[clienteId];
            }
            this.repsLoadingByCliente[clienteId] = true;
            this.repsErrorByCliente[clienteId] = '';
            try {
                const { data } = await api.get(REPS_BASE, {
                    params: { cliente: clienteId, page: 1, page_size },
                });
                this.representantesByCliente[clienteId] = data.results;
                return data.results;
            }
            catch (error) {
                this.repsErrorByCliente[clienteId] = toMessage(error);
                throw error;
            }
            finally {
                this.repsLoadingByCliente[clienteId] = false;
            }
        },
        async createRepresentante(payload) {
            const clienteId = Number(payload.cliente);
            this.repsErrorByCliente[clienteId] = '';
            try {
                const { data } = await api.post(REPS_BASE, payload);
                const list = this.representantesByCliente[clienteId] || [];
                this.representantesByCliente[clienteId] = [data, ...list];
                return data;
            }
            catch (error) {
                this.repsErrorByCliente[clienteId] = toMessage(error);
                throw error;
            }
        },
        async updateRepresentante(id, patch, clienteIdHint = 0) {
            // tenta descobrir o clienteId com base no cache, caso não tenha sido passado
            let clienteId = clienteIdHint ?? 0;
            if (!clienteId) {
                for (const [cidStr, reps] of Object.entries(this.representantesByCliente)) {
                    const found = reps.find(r => r.id === id);
                    if (found) {
                        clienteId = Number(cidStr);
                        break;
                    }
                }
            }
            if (!clienteId && patch.cliente) {
                clienteId = Number(patch.cliente);
            }
            try {
                const { data } = await api.patch(`${REPS_BASE}${id}/`, patch);
                const arr = this.representantesByCliente[clienteId];
                if (arr) {
                    const idx = arr.findIndex(r => r.id === id);
                    if (idx !== -1) {
                        arr.splice(idx, 1, data);
                    }
                }
                return data;
            }
            catch (error) {
                if (clienteId) {
                    this.repsErrorByCliente[clienteId] = toMessage(error);
                }
                throw error;
            }
        },
        async removeRepresentante(id, clienteIdHint = 0) {
            // idem: tenta inferir clienteId
            let clienteId = clienteIdHint ?? 0;
            if (!clienteId) {
                for (const [cidStr, reps] of Object.entries(this.representantesByCliente)) {
                    const found = reps.some(r => r.id === id);
                    if (found) {
                        clienteId = Number(cidStr);
                        break;
                    }
                }
            }
            try {
                await api.delete(`${REPS_BASE}${id}/`);
                if (clienteId && this.representantesByCliente[clienteId]) {
                    this.representantesByCliente[clienteId]
                        = this.representantesByCliente[clienteId].filter(r => r.id !== id);
                }
            }
            catch (error) {
                if (clienteId) {
                    this.repsErrorByCliente[clienteId] = toMessage(error);
                }
                throw error;
            }
        },
        /**
         * Atalho: aciona a cópia do endereço do cliente no representante via flag
         * 'usa_endereco_do_cliente = true' (o back efetua a cópia).
         */
        async usarEnderecoDoClienteNoRepresentante(id, clienteIdHint) {
            return this.updateRepresentante(id, { usa_endereco_do_cliente: true }, clienteIdHint);
        },
        /**
         * (Opcional) Propaga o endereço atual do cliente para todos os representantes
         * dele que estejam marcados com usa_endereco_do_cliente = true.
         */
        async propagarEnderecoParaRepsQueUsamCliente(clienteId) {
            const reps = await this.fetchRepresentantes(clienteId, { force: false });
            const targets = reps.filter(r => r.usa_endereco_do_cliente);
            for (const r of targets) {
                // basta enviar a flag novamente; o back copiará o endereço atual do cliente
                await this.updateRepresentante(r.id, { usa_endereco_do_cliente: true }, clienteId);
            }
            return targets.length;
        },
    },
});
