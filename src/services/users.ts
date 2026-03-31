import api, { fetchAllPages } from '@/services/api'

export type User = {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  is_admin: boolean
  is_active: boolean
}

export async function listUsers (params: {
  search?: string
  ordering?: string
}) {
  return await fetchAllPages<User>('/api/accounts/users/', {
    params: { ...params, page_size: 100 },
  })
}

export async function createUser (payload: User & { password: string }) {
  const { data } = await api.post<User>('/api/accounts/users/', payload)
  return data
}

export async function updateUser (id: number, payload: Partial<User> & { password?: string }) {
  const { data } = await api.patch<User>(`/api/accounts/users/${id}/`, payload)
  return data
}

export async function deleteUser (id: number) {
  await api.delete(`/api/accounts/users/${id}/`)
}

export async function setUserPassword (id: number, new_password: string) {
  await api.post(`/api/accounts/users/${id}/set-password/`, { new_password })
}
