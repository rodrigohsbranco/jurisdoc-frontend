export type Bucket = 'day' | 'week' | 'month';
export interface TimeSeriesPoint {
    period: string;
    clientes: number;
    peticoes_criadas: number;
    peticoes_atualizadas: number;
}
export interface TimeSeriesResponse {
    bucket: Bucket;
    date_from: string;
    date_to: string;
    series: TimeSeriesPoint[];
}
export interface TemplatesUsageItem {
    template_id: number;
    template: string;
    count: number;
}
export type TemplatesUsageResponse = TemplatesUsageItem[];
export interface DataQualityResponse {
    total_clientes: number;
    sem_cpf: number;
    sem_endereco: number;
    com_conta_principal: number;
}
export interface ExportPetitionsParams {
    date_from?: string;
    date_to?: string;
    template?: number;
    cliente?: number;
    filename?: string;
}
export declare const useRelatoriosStore: import("pinia").StoreDefinition<"relatorios", {
    timeseries: TimeSeriesResponse | null;
    templatesUsage: TemplatesUsageResponse;
    dataQuality: DataQualityResponse | null;
    loading: Record<"timeseries" | "templates" | "quality" | "export", boolean>;
    error: string;
}, {
    hasError: (s: {
        timeseries: {
            bucket: Bucket;
            date_from: string;
            date_to: string;
            series: {
                period: string;
                clientes: number;
                peticoes_criadas: number;
                peticoes_atualizadas: number;
            }[];
        } | null;
        templatesUsage: {
            template_id: number;
            template: string;
            count: number;
        }[];
        dataQuality: {
            total_clientes: number;
            sem_cpf: number;
            sem_endereco: number;
            com_conta_principal: number;
        } | null;
        loading: {
            templates: boolean;
            timeseries: boolean;
            quality: boolean;
            export: boolean;
        };
        error: string;
    } & import("pinia").PiniaCustomStateProperties<{
        timeseries: TimeSeriesResponse | null;
        templatesUsage: TemplatesUsageResponse;
        dataQuality: DataQualityResponse | null;
        loading: Record<"timeseries" | "templates" | "quality" | "export", boolean>;
        error: string;
    }>) => boolean;
}, {
    resetError(): void;
    fetchTimeSeries(params?: {
        bucket?: Bucket;
        date_from?: string;
        date_to?: string;
    }): Promise<void>;
    fetchTemplatesUsage(params?: {
        top?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<void>;
    fetchDataQuality(): Promise<void>;
    exportPetitionsCSV(params?: ExportPetitionsParams): Promise<void>;
}>;
