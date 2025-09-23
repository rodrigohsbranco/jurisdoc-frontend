import axios, { AxiosHeaders } from "axios";
import { useAuthStore } from "@/stores/auth";
const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://192.168.0.250:8000";
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: false,
});
// injeta Authorization e tenta refresh se necessário
api.interceptors.request.use(async (config) => {
    const auth = useAuthStore();
    try {
        await auth.refreshIfNeeded();
    }
    catch {
        // segue; se der 401, o response interceptor tenta 1x
    }
    if (auth?.accessToken) {
        // Garante que headers é uma instância de AxiosHeaders
        const headers = config.headers instanceof AxiosHeaders
            ? config.headers
            : AxiosHeaders.from((config.headers || {}));
        headers.set("Authorization", `Bearer ${auth.accessToken}`);
        config.headers = headers;
    }
    return config;
});
// tenta 1x refresh e refaz a request
api.interceptors.response.use((resp) => resp, async (error) => {
    const auth = useAuthStore();
    const original = error.config;
    if (!error.response || !original) {
        throw error;
    }
    if (error.response.status === 401 &&
        auth.refreshToken &&
        !original._retry) {
        original._retry = true;
        try {
            await auth.refresh();
            // Normaliza headers como AxiosHeaders e reatribui Authorization
            const headers = original.headers instanceof AxiosHeaders
                ? original.headers
                : AxiosHeaders.from((original.headers || {}));
            headers.set("Authorization", `Bearer ${auth.accessToken}`);
            original.headers = headers;
            return api.request(original);
        }
        catch (error_) {
            await auth.logout();
            throw error_;
        }
    }
    throw error;
});
export default api;
