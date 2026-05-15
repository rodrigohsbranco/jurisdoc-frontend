import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Composable de leitura das permissões do usuário logado.
 *
 *   const { can, isAdmin, capacidades } = usePermissions()
 *   if (can('clientes.deletar')) { ... }
 *
 * `can()` retorna true se o usuário é admin OU se a capacidade está na lista
 * vinda do backend (campo `capacidades` em `/api/auth/me/`).
 */
export function usePermissions () {
  const auth = useAuthStore()

  const isAdmin = computed(() => auth.isAdmin)
  const capacidades = computed<string[]>(() => auth.capacidades)

  function can (codigo: string): boolean {
    if (auth.isAdmin) return true
    return auth.capacidades.includes(codigo)
  }

  function canAny (codigos: string[]): boolean {
    if (auth.isAdmin) return true
    return codigos.some(c => auth.capacidades.includes(c))
  }

  function canAll (codigos: string[]): boolean {
    if (auth.isAdmin) return true
    return codigos.every(c => auth.capacidades.includes(c))
  }

  return { can, canAny, canAll, isAdmin, capacidades }
}
