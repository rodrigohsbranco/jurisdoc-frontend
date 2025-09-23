export type ContaBancaria = {
    id: number;
    cliente: number;
    banco_nome: string;
    agencia: string;
    conta: string;
    digito?: string | null;
    tipo?: 'corrente' | 'poupanca' | string | null;
    is_principal: boolean;
    criado_em?: string;
    atualizado_em?: string;
    descricao_ativa?: string | null;
    banco_codigo?: string | null;
};
export type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};
export type ContaExtras = {
    banco_id?: string;
    descricao_banco?: string;
    /** quando enviar descricao_banco, define esta variação como ativa no servidor */
    descricao_set_ativa?: boolean;
};
export type BankDescricao = {
    id: number;
    banco_id: string;
    banco_nome: string;
    descricao: string;
    is_ativa: boolean;
    criado_em?: string;
    atualizado_em?: string;
};
export declare const useContasStore: import("pinia").StoreDefinition<"contas", {
    items: ContaBancaria[];
    count: number;
    loading: boolean;
    error: string;
    clienteId: number;
    params: {
        page: number;
        page_size: number;
        ordering?: string;
    };
    notesByBank: Record<string, BankDescricao[]>;
}, {
    hasError: (s: {
        items: {
            id: number;
            cliente: number;
            banco_nome: string;
            agencia: string;
            conta: string;
            digito?: string | null | undefined;
            tipo?: "corrente" | "poupanca" | string | null | undefined;
            is_principal: boolean;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
            descricao_ativa?: string | null | undefined;
            banco_codigo?: string | null | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string | undefined;
        };
        notesByBank: Record<string, BankDescricao[]>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: ContaBancaria[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string;
        };
        notesByBank: Record<string, BankDescricao[]>;
    }>) => boolean;
    byCliente: (s: {
        items: {
            id: number;
            cliente: number;
            banco_nome: string;
            agencia: string;
            conta: string;
            digito?: string | null | undefined;
            tipo?: "corrente" | "poupanca" | string | null | undefined;
            is_principal: boolean;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
            descricao_ativa?: string | null | undefined;
            banco_codigo?: string | null | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string | undefined;
        };
        notesByBank: Record<string, BankDescricao[]>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: ContaBancaria[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string;
        };
        notesByBank: Record<string, BankDescricao[]>;
    }>) => (id: number) => {
        id: number;
        cliente: number;
        banco_nome: string;
        agencia: string;
        conta: string;
        digito?: string | null | undefined;
        tipo?: "corrente" | "poupanca" | string | null | undefined;
        is_principal: boolean;
        criado_em?: string | undefined;
        atualizado_em?: string | undefined;
        descricao_ativa?: string | null | undefined;
        banco_codigo?: string | null | undefined;
    }[];
    principal: (s: {
        items: {
            id: number;
            cliente: number;
            banco_nome: string;
            agencia: string;
            conta: string;
            digito?: string | null | undefined;
            tipo?: "corrente" | "poupanca" | string | null | undefined;
            is_principal: boolean;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
            descricao_ativa?: string | null | undefined;
            banco_codigo?: string | null | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string | undefined;
        };
        notesByBank: Record<string, BankDescricao[]>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: ContaBancaria[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string;
        };
        notesByBank: Record<string, BankDescricao[]>;
    }>) => (id: number) => {
        id: number;
        cliente: number;
        banco_nome: string;
        agencia: string;
        conta: string;
        digito?: string | null | undefined;
        tipo?: "corrente" | "poupanca" | string | null | undefined;
        is_principal: boolean;
        criado_em?: string | undefined;
        atualizado_em?: string | undefined;
        descricao_ativa?: string | null | undefined;
        banco_codigo?: string | null | undefined;
    } | null;
    descricoesAtivasMap: (s: {
        items: {
            id: number;
            cliente: number;
            banco_nome: string;
            agencia: string;
            conta: string;
            digito?: string | null | undefined;
            tipo?: "corrente" | "poupanca" | string | null | undefined;
            is_principal: boolean;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
            descricao_ativa?: string | null | undefined;
            banco_codigo?: string | null | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string | undefined;
        };
        notesByBank: Record<string, BankDescricao[]>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: ContaBancaria[];
        count: number;
        loading: boolean;
        error: string;
        clienteId: number;
        params: {
            page: number;
            page_size: number;
            ordering?: string;
        };
        notesByBank: Record<string, BankDescricao[]>;
    }>) => Record<string, BankDescricao | null>;
}, {
    setCliente(id: number): void;
    setParams(p: Partial<{
        page: number;
        page_size: number;
        ordering?: string;
    }>): void;
    fetchForCliente(cliente: number, overrides?: Partial<{
        page: number;
        page_size: number;
        ordering?: string;
    }>): Promise<void>;
    create(payload: Omit<ContaBancaria, "id" | "criado_em" | "atualizado_em">, extras?: ContaExtras): Promise<ContaBancaria>;
    update(id: number, payload: Partial<ContaBancaria & ContaExtras>): Promise<ContaBancaria>;
    setPrincipal(id: number): Promise<ContaBancaria>;
    remove(id: number): Promise<void>;
    /**
     * Retorna a descrição ATIVA do banco (ou null se não existir).
     * Preferir bank_id (ISPB/COMPE/slug). Se não tiver, usar bank_name.
     */
    lookupDescricaoBanco(args: {
        banco_id?: string;
        banco_nome?: string;
    }): Promise<BankDescricao | null>;
    /**
     * Lista TODAS as descrições (variações) de um banco_id, ativa primeiro.
     * Também atualiza o cache interno (notesByBank).
     */
    listDescricoes(banco_id: string): Promise<BankDescricao[]>;
    /**
     * Cria uma NOVA variação de descrição para o banco. Se is_ativa=true,
     * ela é marcada ativa e as demais são desativadas pelo backend.
     * Após criar, refaz o cache via listDescricoes().
     */
    createDescricaoBanco(payload: {
        banco_id: string;
        banco_nome: string;
        descricao: string;
        is_ativa?: boolean;
    }): Promise<BankDescricao>;
    /**
     * Edita uma descrição existente. Se is_ativa=true, torna-a ativa e
     * desativa as demais. Atualiza o cache em seguida.
     */
    updateDescricaoBanco(id: number, payload: Partial<Pick<BankDescricao, "descricao" | "is_ativa">>): Promise<BankDescricao>;
    /**
     * Marca a descrição (id) como ATIVA usando a ação dedicada.
     * Atualiza o cache do banco correspondente.
     */
    setDescricaoAtiva(id: number): Promise<BankDescricao>;
    /**
     * Mantida por compatibilidade, mas agora cria uma nova variação e define como ativa.
     * Use createDescricaoBanco/updateDescricaoBanco/setDescricaoAtiva nos fluxos novos.
     */
    upsertDescricaoBanco(payload: {
        banco_id: string;
        banco_nome: string;
        descricao: string;
    }): Promise<BankDescricao>;
}>;
