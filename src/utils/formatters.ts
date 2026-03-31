export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '')
}

export function formatCPF(v: string): string {
  const s = onlyDigits(v).slice(0, 11)
  if (s.length <= 3) return s
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`
  if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`
}

export function formatCEP(v: string): string {
  const s = onlyDigits(v).slice(0, 8)
  if (s.length <= 5) return s
  return `${s.slice(0, 5)}-${s.slice(5)}`
}

export function formatCNPJ(v: string): string {
  const s = onlyDigits(v).slice(0, 14)
  if (s.length <= 2) return s
  if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`
  if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`
  if (s.length <= 12) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
}
