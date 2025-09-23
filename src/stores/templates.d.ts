export interface TemplateItem {
    id: number;
    name: string;
    file: string;
    active: boolean;
}
export type FieldType = 'string' | 'int' | 'bool' | 'date' | 'cpf' | 'cnpj' | 'cep' | 'phone' | 'email';
export interface TemplateField {
    raw: string;
    name: string;
    type: FieldType;
}
export interface FieldsResponse {
    syntax: string;
    fields: TemplateField[];
}
export interface ListParams {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
    active?: boolean;
}
export interface Paginated<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
export interface RenderOptions {
    context: Record<string, unknown>;
    filename?: string;
}
export interface RenderResult {
    blob: Blob;
    filename: string;
}
export declare const useTemplatesStore: import("pinia").StoreDefinition<"templates", {
    items: TemplateItem[];
    count: number;
    next: string | null;
    previous: string | null;
    loadingList: boolean;
    loadingMutation: boolean;
    fieldsCache: Map<number, FieldsResponse>;
    lastError: string | null;
}, {
    byId: (state: {
        items: {
            id: number;
            name: string;
            file: string;
            active: boolean;
        }[];
        count: number;
        next: string | null;
        previous: string | null;
        loadingList: boolean;
        loadingMutation: boolean;
        fieldsCache: Map<number, {
            syntax: string;
            fields: {
                raw: string;
                name: string;
                type: FieldType;
            }[];
        }> & Omit<Map<number, FieldsResponse>, keyof Map<any, any>>;
        lastError: string | null;
    } & import("pinia").PiniaCustomStateProperties<{
        items: TemplateItem[];
        count: number;
        next: string | null;
        previous: string | null;
        loadingList: boolean;
        loadingMutation: boolean;
        fieldsCache: Map<number, FieldsResponse>;
        lastError: string | null;
    }>) => (id: number) => {
        id: number;
        name: string;
        file: string;
        active: boolean;
    } | null;
}, {
    fetch(params?: ListParams): Promise<void>;
    create(payload: {
        name: string;
        file: File;
        active?: boolean;
    }): Promise<TemplateItem>;
    update(id: number, payload: Partial<{
        name: string;
        active: boolean;
        file: File;
    }>): Promise<TemplateItem>;
    setActive(id: number, active: boolean): Promise<TemplateItem>;
    remove(id: number): Promise<void>;
    fetchFields(id: number, { force }?: {
        force?: boolean;
    }): Promise<FieldsResponse>;
    render(id: number, opts: RenderOptions): Promise<RenderResult>;
    downloadRendered(result: RenderResult): void;
}>;
