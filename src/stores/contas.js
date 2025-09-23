import { defineStore } from 'pinia';
import api from '@/services/api';
const BASE = '/api/cadastro/contas/';
const NOTES_BASE = '/api/cadastro/bancos-descricoes/';
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
    return 'Ocorreu um erro. Tente novamente.';
}
export const useContasStore = defineStore('contas', {
    state: () => ({
        items: [],
        count: 0,
        loading: false,
        error: '',
        clienteId: 0,
        params: {
            page: 1,
            page_size: 20,
            ordering: 'banco_nome',
        },
        // cache simples de descrições por banco_id
        notesByBank: {},
    }),
    getters: {
        hasError: s => !!s.error,
        byCliente: s => (id) => s.items.filter(i => i.cliente === id),
        principal: s => (id) => s.items.find(i => i.cliente === id && i.is_principal) || null,
        descricoesAtivasMap: s => {
            const m = {};
            for (const [bid, list] of Object.entries(s.notesByBank)) {
                m[bid] = list.find(n => n.is_ativa) || null;
            }
            return m;
        },
    },
    actions: {
        setCliente(id) {
            this.clienteId = id;
        },
        setParams(p) {
            this.params = { ...this.params, ...p };
        },
        async fetchForCliente(cliente, overrides) {
            this.loading = true;
            this.error = '';
            try {
                const params = { ...this.params, ...overrides, cliente };
                const { data } = await api.get(BASE, { params });
                // 🔹 Substitui as contas do cliente no cache local
                this.items = this.items.filter(i => i.cliente !== cliente).concat(data.results);
                this.count = data.count;
                this.clienteId = cliente;
                // 🔹 Para cada conta, tenta hidratar descricao_ativa priorizando banco_id (banco_codigo)
                for (const conta of this.items.filter(i => i.cliente === cliente)) {
                    const bankId = (conta.banco_codigo || '').trim();
                    if (bankId) {
                        // 1) cache por banco_id
                        const cached = this.notesByBank[bankId];
                        if (cached) {
                            const ativa = cached.find(d => d.is_ativa);
                            conta.descricao_ativa = ativa ? ativa.descricao : null;
                            continue;
                        }
                        // 2) sem cache → carrega variações por banco_id
                        try {
                            const list = await this.listDescricoes(bankId);
                            const ativa = list.find(d => d.is_ativa);
                            conta.descricao_ativa = ativa ? ativa.descricao : null;
                            continue;
                        }
                        catch {
                            // segue para fallback por nome
                        }
                    }
                    // Fallback: não há banco_id → tenta lookup por nome
                    try {
                        const found = await this.lookupDescricaoBanco({ banco_nome: conta.banco_nome });
                        conta.descricao_ativa = found?.descricao ?? null;
                    }
                    catch {
                        conta.descricao_ativa = null;
                    }
                }
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
            finally {
                this.loading = false;
            }
        },
        async create(payload, extras) {
            this.error = '';
            try {
                const { data } = await api.post(BASE, { ...payload, ...extras });
                this.items.push(data);
                if (data.is_principal) {
                    this.items = this.items.map(i => i.cliente === data.cliente ? { ...i, is_principal: i.id === data.id } : i);
                }
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
                const idx = this.items.findIndex(i => i.id === id);
                if (idx !== -1) {
                    this.items[idx] = { ...this.items[idx], ...data };
                }
                if (data.is_principal) {
                    this.items = this.items.map(i => i.cliente === data.cliente ? { ...i, is_principal: i.id === data.id } : i);
                }
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        async setPrincipal(id) {
            return this.update(id, { is_principal: true });
        },
        async remove(id) {
            this.error = '';
            try {
                await api.delete(`${BASE}${id}/`);
                this.items = this.items.filter(i => i.id !== id);
                this.count = Math.max(0, this.count - 1);
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        // ====================== Descrições de Banco (múltiplas) ======================
        /**
         * Retorna a descrição ATIVA do banco (ou null se não existir).
         * Preferir bank_id (ISPB/COMPE/slug). Se não tiver, usar bank_name.
         */
        async lookupDescricaoBanco(args) {
            this.error = '';
            try {
                const params = {};
                if (args.banco_id) {
                    params.bank_id = args.banco_id;
                }
                else if (args.banco_nome) {
                    params.bank_name = args.banco_nome;
                }
                else {
                    return null;
                }
                const res = await api.get(`${NOTES_BASE}lookup/`, { params });
                if (res.status === 200 && res.data) {
                    return res.data;
                }
                return null; // 204
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        /**
         * Lista TODAS as descrições (variações) de um banco_id, ativa primeiro.
         * Também atualiza o cache interno (notesByBank).
         */
        async listDescricoes(banco_id) {
            this.error = '';
            try {
                const { data } = await api.get(`${NOTES_BASE}variacoes/`, {
                    params: { bank_id: banco_id },
                });
                this.notesByBank[banco_id] = Array.isArray(data) ? data : [];
                return this.notesByBank[banco_id];
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        /**
         * Cria uma NOVA variação de descrição para o banco. Se is_ativa=true,
         * ela é marcada ativa e as demais são desativadas pelo backend.
         * Após criar, refaz o cache via listDescricoes().
         */
        async createDescricaoBanco(payload) {
            this.error = '';
            try {
                const { data } = await api.post(NOTES_BASE, payload);
                await this.listDescricoes(data.banco_id);
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        /**
         * Edita uma descrição existente. Se is_ativa=true, torna-a ativa e
         * desativa as demais. Atualiza o cache em seguida.
         */
        async updateDescricaoBanco(id, payload) {
            this.error = '';
            try {
                const { data } = await api.patch(`${NOTES_BASE}${id}/`, payload);
                await this.listDescricoes(data.banco_id);
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        /**
         * Marca a descrição (id) como ATIVA usando a ação dedicada.
         * Atualiza o cache do banco correspondente.
         */
        async setDescricaoAtiva(id) {
            this.error = '';
            try {
                const { data } = await api.post(`${NOTES_BASE}${id}/set-ativa/`);
                await this.listDescricoes(data.banco_id);
                return data;
            }
            catch (error) {
                this.error = toMessage(error);
                throw error;
            }
        },
        /**
         * Mantida por compatibilidade, mas agora cria uma nova variação e define como ativa.
         * Use createDescricaoBanco/updateDescricaoBanco/setDescricaoAtiva nos fluxos novos.
         */
        async upsertDescricaoBanco(payload) {
            return this.createDescricaoBanco({ ...payload, is_ativa: true });
        },
    },
});
