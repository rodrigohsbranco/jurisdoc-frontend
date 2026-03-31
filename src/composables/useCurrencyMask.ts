/**
 * Máscara monetária brasileira estilo caixa registradora.
 * Dígitos entram pela direita, vírgula fixa nas 2 últimas casas.
 * Ex: digita 1→0,01 | 2→0,12 | 3→1,23 | 4→12,34 | 5→123,45
 */

/**
 * Formata um número para exibição monetária brasileira.
 * 1234.56 → "1.234,56"
 * 0 ou vazio → ""
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string'
    ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
    : Number(value)
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Converte string monetária brasileira para número.
 * "1.234,56" → 1234.56
 */
export function parseCurrency(value: string): number | null {
  if (!value || !value.trim()) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const num = parseInt(digits, 10) / 100
  return num
}

/**
 * Aplica a máscara estilo caixa registradora a um valor digitado.
 * Extrai apenas dígitos, divide por 100 e formata.
 */
export function applyCurrencyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
