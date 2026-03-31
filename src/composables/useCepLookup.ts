import { ref } from 'vue'
import { onlyDigits, formatCEP } from '@/utils/formatters'

export function useCepLookup() {
  const cepLoading = ref(false)
  const cepStatus = ref('')

  async function lookupCEP(
    cepValue: string,
    fillFields: (data: { logradouro: string; bairro: string; cidade: string; uf: string }) => void,
  ) {
    const s = onlyDigits(cepValue)
    cepStatus.value = ''
    if (s.length !== 8) return

    cepLoading.value = true
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${s}/json/`)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      if (data.erro) throw new Error('CEP não encontrado')
      fillFields({
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
      })
      cepStatus.value = 'Endereço preenchido pelo CEP.'
    } catch {
      cepStatus.value = 'Não foi possível consultar o CEP. Preencha manualmente.'
    } finally {
      cepLoading.value = false
    }
  }

  return { cepLoading, cepStatus, lookupCEP, formatCEP }
}
