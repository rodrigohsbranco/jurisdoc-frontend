import { ref } from 'vue'

export interface BankItem {
  label: string
  code?: string
  ispb?: string
}

const FALLBACK_BANKS: BankItem[] = [
  'Banco do Brasil (001)',
  'Bradesco (237)',
  'Itaú Unibanco (341)',
  'Caixa Econômica Federal (104)',
  'Santander (033)',
  'Nubank (260)',
  'Inter (077)',
  'C6 Bank (336)',
  'BTG Pactual (208)',
  'Sicoob (756)',
  'Sicredi (748)',
  'Banrisul (041)',
  'BRB (070)',
  'Banco Original (212)',
  'PagBank (290)',
].map((label) => ({ label }))

export function useBankCatalog(customBanks?: readonly { label: string; ispb: string }[]) {
  const bankItems = ref<BankItem[]>([])
  const bankLoading = ref(false)

  function ensureCustomBanks(list: BankItem[]) {
    if (!customBanks?.length) return
    for (const cb of [...customBanks].reverse()) {
      if (!list.some((i) => i.label === cb.label)) {
        list.unshift({ label: cb.label, ispb: cb.ispb })
      }
    }
  }

  async function loadBankCatalog() {
    if (bankItems.value.length > 0) return
    bankLoading.value = true
    try {
      const cached = localStorage.getItem('br_banks_v1')
      if (cached) {
        bankItems.value = JSON.parse(cached)
        ensureCustomBanks(bankItems.value)
        return
      }
      const resp = await fetch('https://brasilapi.com.br/api/banks/v1')
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      const mapped: BankItem[] = (data as any[]).map((b) => ({
        label: `${b.fullName || b.name}${b.code ? ` (${b.code})` : ''}`,
        code: b.code ? String(b.code) : undefined,
        ispb: b.ispb ? String(b.ispb) : undefined,
      }))
      mapped.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      ensureCustomBanks(mapped)
      bankItems.value = mapped
      localStorage.setItem('br_banks_v1', JSON.stringify(mapped))
    } catch {
      bankItems.value = [...FALLBACK_BANKS]
      ensureCustomBanks(bankItems.value)
    } finally {
      bankLoading.value = false
    }
  }

  function extractCompeFromLabel(label: string): string {
    const m = /\((\d{3})\)\s*$/.exec(label)
    return m ? m[1] : ''
  }

  function findBankMetaByLabel(label: string): BankItem | null {
    return bankItems.value.find((i) => i.label === label) || null
  }

  return { bankItems, bankLoading, loadBankCatalog, extractCompeFromLabel, findBankMetaByLabel }
}
