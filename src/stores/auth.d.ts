import type { Router } from 'vue-router';
export declare const useAuthStore: import("pinia").StoreDefinition<"auth", {
    accessToken: string;
    refreshToken: string;
    username: string;
    lastActiveAt: number;
    _refreshTimer: number;
    _refreshPromise: Promise<void> | null;
    initialized: boolean;
}, {
    isAuthenticated: (s: {
        accessToken: string;
        refreshToken: string;
        username: string;
        lastActiveAt: number;
        _refreshTimer: number;
        _refreshPromise: {
            then: <TResult1 = void, TResult2 = never>(onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined) => Promise<TResult1 | TResult2>;
            catch: <TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined) => Promise<void | TResult>;
            finally: (onfinally?: (() => void) | null | undefined) => Promise<void>;
            readonly [Symbol.toStringTag]: string;
        } | null;
        initialized: boolean;
    } & import("pinia").PiniaCustomStateProperties<{
        accessToken: string;
        refreshToken: string;
        username: string;
        lastActiveAt: number;
        _refreshTimer: number;
        _refreshPromise: Promise<void> | null;
        initialized: boolean;
    }>) => boolean;
}, {
    _scheduleRefresh(): void;
    touchActivity(): void;
    bootstrap(): Promise<void>;
    login(username: string, password: string): Promise<void>;
    refreshIfNeeded(): Promise<void>;
    refresh(): Promise<void>;
    logout(router?: Router): Promise<void>;
}>;
