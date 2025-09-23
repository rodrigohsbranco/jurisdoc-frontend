export interface Petition {
    id: number;
    cliente: number;
    template: number;
    context: Record<string, any>;
    created_at: string;
    updated_at: string | null;
    cliente_nome?: string | null;
    output?: string | null;
}
export interface CreatePetitionPayload {
    cliente: number;
    template: number;
    context?: Record<string, any>;
}
export interface UpdatePetitionPayload {
    cliente?: number;
    template?: number;
    context?: Record<string, any>;
}
export interface ListParams {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
    cliente?: number;
    template?: number;
}
export interface Paginated<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
export interface RenderOptions {
    filename?: string;
    context_override?: Record<string, any>;
    strict?: boolean;
}
export interface RenderResult {
    blob: Blob;
    filename: string;
}
export interface RenderError {
    detail: string;
    missing?: string[];
    required?: string[];
}
export declare const usePeticoesStore: import("pinia").StoreDefinition<"peticoes", {
    items: Petition[];
    count: number;
    next: string | null;
    previous: string | null;
    loading: boolean;
    loadingMutation: boolean;
    error: string | null;
    byIdCache: Map<number, Petition>;
}, {
    byId: (state: {
        items: {
            id: number;
            cliente: number;
            template: number;
            context: Record<string, any>;
            created_at: string;
            updated_at: string | null;
            cliente_nome?: string | null | undefined;
            output?: string | null | undefined;
        }[];
        count: number;
        next: string | null;
        previous: string | null;
        loading: boolean;
        loadingMutation: boolean;
        error: string | null;
        byIdCache: Map<number, {
            id: number;
            cliente: number;
            template: number;
            context: Record<string, any>;
            created_at: string;
            updated_at: string | null;
            cliente_nome?: string | null | undefined;
            output?: string | null | undefined;
        }> & Omit<Map<number, Petition>, keyof Map<any, any>>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: Petition[];
        count: number;
        next: string | null;
        previous: string | null;
        loading: boolean;
        loadingMutation: boolean;
        error: string | null;
        byIdCache: Map<number, Petition>;
    }>) => (id: number) => {
        id: number;
        cliente: number;
        template: number;
        context: Record<string, any>;
        created_at: string;
        updated_at: string | null;
        cliente_nome?: string | null | undefined;
        output?: string | null | undefined;
    } | null;
    byCliente: (state: {
        items: {
            id: number;
            cliente: number;
            template: number;
            context: Record<string, any>;
            created_at: string;
            updated_at: string | null;
            cliente_nome?: string | null | undefined;
            output?: string | null | undefined;
        }[];
        count: number;
        next: string | null;
        previous: string | null;
        loading: boolean;
        loadingMutation: boolean;
        error: string | null;
        byIdCache: Map<number, {
            id: number;
            cliente: number;
            template: number;
            context: Record<string, any>;
            created_at: string;
            updated_at: string | null;
            cliente_nome?: string | null | undefined;
            output?: string | null | undefined;
        }> & Omit<Map<number, Petition>, keyof Map<any, any>>;
    } & import("pinia").PiniaCustomStateProperties<{
        items: Petition[];
        count: number;
        next: string | null;
        previous: string | null;
        loading: boolean;
        loadingMutation: boolean;
        error: string | null;
        byIdCache: Map<number, Petition>;
    }>) => (clienteId: number) => {
        id: number;
        cliente: number;
        template: number;
        context: Record<string, any>;
        created_at: string;
        updated_at: string | null;
        cliente_nome?: string | null | undefined;
        output?: string | null | undefined;
    }[];
}, {
    fetch(params?: ListParams): Promise<void>;
    getDetail(id: number): Promise<Petition>;
    create(payload: CreatePetitionPayload): Promise<Petition>;
    update(id: number, payload: UpdatePetitionPayload): Promise<Petition>;
    remove(id: number): Promise<void>;
    render(id: number, opts?: RenderOptions): Promise<RenderResult>;
    downloadRendered(result: RenderResult): void;
}>;
