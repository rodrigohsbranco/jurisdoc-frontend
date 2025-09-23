import api from '@/services/api';
export async function listUsers(params) {
    const { data } = await api.get('/api/accounts/users/', { params });
    return data;
}
export async function createUser(payload) {
    const { data } = await api.post('/api/accounts/users/', payload);
    return data;
}
export async function updateUser(id, payload) {
    const { data } = await api.patch(`/api/accounts/users/${id}/`, payload);
    return data;
}
export async function deleteUser(id) {
    await api.delete(`/api/accounts/users/${id}/`);
}
export async function setUserPassword(id, new_password) {
    await api.post(`/api/accounts/users/${id}/set-password/`, { new_password });
}
