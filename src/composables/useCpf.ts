import { ref } from 'vue'
import { onlyDigits, formatCPF } from '@/utils/formatters'
import { fetchAllPages } from '@/services/api'

export function isValidCPF(v?: string): boolean {
  const s = onlyDigits(v || '')
  if (s.length !== 11) return false
  if (/^(\d)\1{10}$/.test(s)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number.parseInt(s[i], 10) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== Number.parseInt(s[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number.parseInt(s[i], 10) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return d2 === Number.parseInt(s[10], 10)
}

export function useCpf() {
  const cpfCheckStatus = ref<{ message: string; type: 'info' | 'error' | null }>({
    message: '',
    type: null,
  })

  async function checkCPFExists(cpf: string) {
    if (!cpf || !isValidCPF(cpf)) {
      cpfCheckStatus.value = { message: '', type: null }
      return
    }

    const cpfNormalizado = onlyDigits(cpf)
    if (cpfNormalizado.length !== 11) {
      cpfCheckStatus.value = { message: '', type: null }
      return
    }

    try {
      const data = await fetchAllPages<any>('/api/cadastro/clientes/', {
        params: { cpf: cpfNormalizado, page_size: 100 },
      })

      if (data && data.length > 0) {
        const clienteExistente = data[0]
        const isActive = clienteExistente.is_active ?? true
        if (isActive) {
          cpfCheckStatus.value = {
            message: 'Já existe um cliente ativo com este CPF.',
            type: 'error',
          }
        } else {
          cpfCheckStatus.value = {
            message: 'Cliente inativo encontrado. Será restaurado ao salvar.',
            type: 'info',
          }
        }
      } else {
        cpfCheckStatus.value = { message: '', type: null }
      }
    } catch {
      cpfCheckStatus.value = { message: '', type: null }
    }
  }

  function resetCpfCheck() {
    cpfCheckStatus.value = { message: '', type: null }
  }

  return { cpfCheckStatus, checkCPFExists, resetCpfCheck, isValidCPF, formatCPF }
}
