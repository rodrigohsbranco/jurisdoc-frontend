import api, { fetchAllPages } from '@/services/api'
import type { PermissaoLeve } from '@/services/permissoes'

export type EnderecoUser = {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}

export type User = {
  id: number
  username: string
  first_name?: string
  last_name?: string
  email: string
  nome_completo: string
  telefone?: string
  endereco?: EnderecoUser | Record<string, any>
  avatar?: string | null
  is_admin: boolean
  is_active: boolean
  permissao?: number | null
  permissao_detalhe?: PermissaoLeve | null
  capacidades?: string[]
}

export type UserWritePayload = Partial<User> & {
  password?: string
  avatar?: string | File | null
}

/** Constrói o payload a enviar — usa FormData se houver upload de arquivo. */
function buildPayload (data: UserWritePayload): FormData | UserWritePayload {
  const hasFile = data.avatar instanceof File
  if (!hasFile) {
    // remove a key avatar se for string (URL) — backend trataria como reset; preservar
    const { avatar, ...rest } = data
    return typeof avatar === 'string' ? { ...rest, avatar } : rest
  }
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (key === 'avatar' && value instanceof File) {
      fd.append('avatar', value)
    } else if (key === 'endereco' && typeof value === 'object') {
      fd.append('endereco', JSON.stringify(value))
    } else if (typeof value === 'boolean') {
      fd.append(key, value ? 'true' : 'false')
    } else {
      fd.append(key, String(value))
    }
  }
  return fd
}

export async function listUsers (params: {
  search?: string
  ordering?: string
}) {
  return await fetchAllPages<User>('/api/accounts/users/', {
    params: { ...params, page_size: 100 },
  })
}

export async function createUser (payload: UserWritePayload & { password: string }) {
  const body = buildPayload(payload)
  const config = body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
  const { data } = await api.post<User>('/api/accounts/users/', body as any, config)
  return data
}

export async function updateUser (id: number, payload: UserWritePayload) {
  const body = buildPayload(payload)
  const config = body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
  const { data } = await api.patch<User>(`/api/accounts/users/${id}/`, body as any, config)
  return data
}

export async function deleteUser (id: number) {
  await api.delete(`/api/accounts/users/${id}/`)
}

export async function setUserPassword (id: number, new_password: string) {
  await api.post(`/api/accounts/users/${id}/set-password/`, { new_password })
}
