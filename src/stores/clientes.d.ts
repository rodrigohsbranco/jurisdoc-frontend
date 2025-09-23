export type Cliente = {
    id: number;
    nome_completo: string;
    qualificacao?: string | null;
    cpf?: string | null;
    rg?: string | null;
    orgao_expedidor?: string | null;
    se_idoso?: boolean;
    se_incapaz?: boolean;
    se_crianca_adolescente?: boolean;
    nacionalidade?: string | null;
    estado_civil?: string | null;
    profissao?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    cep?: string | null;
    uf?: string | null;
    criado_em?: string;
    atualizado_em?: string;
};
export type Representante = {
    id: number;
    cliente: number;
    nome_completo: string;
    cpf?: string | null;
    rg?: string | null;
    orgao_expedidor?: string | null;
    se_idoso?: boolean;
    se_incapaz?: boolean;
    se_crianca_adolescente?: boolean;
    nacionalidade?: string | null;
    estado_civil?: string | null;
    profissao?: string | null;
    usa_endereco_do_cliente?: boolean;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    criado_em?: string;
    atualizado_em?: string;
};
export type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};
type ListParams = {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
};
export declare const useClientesStore: import("pinia").StoreDefinition<"clientes", {
    items: Cliente[];
    count: number;
    loading: boolean;
    error: string;
    params: Required<Pick<ListParams, "page" | "page_size" | "search" | "ordering">>;
    representantesByCliente: Record<number, Representante[]>;
    repsLoadingByCliente: Record<number, boolean>;
    repsErrorByCliente: Record<number, string>;
}, {
    hasError: (s: {
        items: {
            id: number;
            nome_completo: string;
            qualificacao?: string | null | undefined;
            cpf?: string | null | undefined;
            rg?: string | null | undefined;
            orgao_expedidor?: string | null | undefined;
            se_idoso?: boolean | undefined;
            se_incapaz?: boolean | undefined;
            se_crianca_adolescente?: boolean | undefined;
            nacionalidade?: string | null | undefined;
            estado_civil?: string | null | undefined;
            profissao?: string | null | undefined;
            logradouro?: string | null | undefined;
            numero?: string | null | undefined;
            bairro?: string | null | undefined;
            cidade?: string | null | undefined;
            cep?: string | null | undefined;
            uf?: string | null | undefined;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        params: {
            search: string;
            page: number;
            page_size: number;
            ordering: string;
        };
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: Cliente[];
        count: number;
        loading: boolean;
        error: string;
        params: Required<Pick<ListParams, "page" | "page_size" | "search" | "ordering">>;
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    }>) => boolean;
    representantesDoCliente: (s: {
        items: {
            id: number;
            nome_completo: string;
            qualificacao?: string | null | undefined;
            cpf?: string | null | undefined;
            rg?: string | null | undefined;
            orgao_expedidor?: string | null | undefined;
            se_idoso?: boolean | undefined;
            se_incapaz?: boolean | undefined;
            se_crianca_adolescente?: boolean | undefined;
            nacionalidade?: string | null | undefined;
            estado_civil?: string | null | undefined;
            profissao?: string | null | undefined;
            logradouro?: string | null | undefined;
            numero?: string | null | undefined;
            bairro?: string | null | undefined;
            cidade?: string | null | undefined;
            cep?: string | null | undefined;
            uf?: string | null | undefined;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        params: {
            search: string;
            page: number;
            page_size: number;
            ordering: string;
        };
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: Cliente[];
        count: number;
        loading: boolean;
        error: string;
        params: Required<Pick<ListParams, "page" | "page_size" | "search" | "ordering">>;
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    }>) => (clienteId: number) => Representante[];
    temRepresentante: (s: {
        items: {
            id: number;
            nome_completo: string;
            qualificacao?: string | null | undefined;
            cpf?: string | null | undefined;
            rg?: string | null | undefined;
            orgao_expedidor?: string | null | undefined;
            se_idoso?: boolean | undefined;
            se_incapaz?: boolean | undefined;
            se_crianca_adolescente?: boolean | undefined;
            nacionalidade?: string | null | undefined;
            estado_civil?: string | null | undefined;
            profissao?: string | null | undefined;
            logradouro?: string | null | undefined;
            numero?: string | null | undefined;
            bairro?: string | null | undefined;
            cidade?: string | null | undefined;
            cep?: string | null | undefined;
            uf?: string | null | undefined;
            criado_em?: string | undefined;
            atualizado_em?: string | undefined;
        }[];
        count: number;
        loading: boolean;
        error: string;
        params: {
            search: string;
            page: number;
            page_size: number;
            ordering: string;
        };
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: Cliente[];
        count: number;
        loading: boolean;
        error: string;
        params: Required<Pick<ListParams, "page" | "page_size" | "search" | "ordering">>;
        representantesByCliente: Record<number, Representante[]>;
        repsLoadingByCliente: Record<number, boolean>;
        repsErrorByCliente: Record<number, string>;
    }>) => (clienteId: number) => boolean;
}, {
    setParams(p: Partial<ListParams>): void;
    resetParams(): void;
    fetchList(overrides?: Partial<ListParams>): Promise<void>;
    getDetail(id: number): Promise<Cliente>;
    create(payload: Omit<Cliente, "id" | "criado_em" | "atualizado_em">): Promise<Cliente>;
    update(id: number, payload: Partial<Cliente>): Promise<Cliente>;
    remove(id: number): Promise<void>;
    /**
     * Lista representantes de um cliente. Usa cache por padrão.
     * Passe { force: true } para recarregar do servidor.
     */
    fetchRepresentantes(clienteId: number, opts?: {
        force?: boolean;
        page_size?: number;
    }): Promise<Representante[]>;
    createRepresentante(payload: Omit<Representante, "id" | "criado_em" | "atualizado_em">): Promise<Representante>;
    updateRepresentante(id: number, patch: Partial<Representante>, clienteIdHint?: number): Promise<Representante>;
    removeRepresentante(id: number, clienteIdHint?: number): Promise<void>;
    /**
     * Atalho: aciona a cópia do endereço do cliente no representante via flag
     * 'usa_endereco_do_cliente = true' (o back efetua a cópia).
     */
    usarEnderecoDoClienteNoRepresentante(id: number, clienteIdHint?: number): Promise<Representante>;
    /**
     * (Opcional) Propaga o endereço atual do cliente para todos os representantes
     * dele que estejam marcados com usa_endereco_do_cliente = true.
     */
    propagarEnderecoParaRepsQueUsamCliente(clienteId: number): Promise<number>;
}>;
export {};
