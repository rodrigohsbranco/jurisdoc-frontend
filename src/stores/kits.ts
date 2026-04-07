import { defineStore } from 'pinia'
import {
  acaoFromAPI,
  assinarKit,
  createAcao,
  createKit,
  deleteAcao,
  deleteKit,
  finalizarKit,
  getKit,
  listKits,
  mudarStatus,
  updateKit,
  type AcaoAPI,
  type KitDetail,
  type KitListItem,
} from '@/services/kits'
import api from '@/services/api'
import { friendlyError } from '@/utils/errorMessages'
import { formatCPF, formatCEP } from '@/utils/formatters'
import type { KitAcao, KitCadastro, KitStatus } from '@/types/kits'
import { emptyCadastro, emptyAcao } from '@/types/kits'

export const useKitsStore = defineStore('kits', {
  state: () => ({
    items: [] as KitListItem[],
    loading: false,
    error: '' as string,
  }),

  getters: {
    byId: state => (id: number) => state.items.find(k => k.id === id) || null,
    stats: state => {
      const total = state.items.length
      const emAndamento = state.items.filter(k => k.status === 'acoes').length
      const pendentes = state.items.filter(k => k.status === 'finalizado').length
      const assinados = state.items.filter(k => k.status === 'assinado').length
      return { total, emAndamento, pendentes, assinados }
    },
  },

  actions: {
    async fetchList () {
      this.loading = true
      this.error = ''
      try {
        this.items = await listKits()
      } catch (e: any) {
        this.error = friendlyError(e)
      } finally {
        this.loading = false
      }
    },

    async getDetail (id: number): Promise<KitDetail | null> {
      this.error = ''
      try {
        return await getKit(id)
      } catch (e: any) {
        this.error = friendlyError(e)
        return null
      }
    },

    async createDraft (clienteId: number): Promise<KitDetail> {
      this.error = ''
      try {
        const created = await createKit(clienteId)
        await this.fetchList()
        return created
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async saveCadastro (kitId: number, clienteId: number, cadastro: Partial<KitCadastro>) {
      this.error = ''
      try {
        // Atualiza o cliente com os dados do cadastro
        await api.patch(`/api/cadastro/clientes/${clienteId}/`, cadastroToAPI(cadastro))
        return true
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async saveAcoes (kitId: number, acoes: KitAcao[], acoesExistentes: AcaoAPI[]) {
      this.error = ''
      try {
        // Remove ações antigas (ignora 404 se já deletadas)
        for (const existente of acoesExistentes) {
          if (existente.id) {
            try {
              await deleteAcao(kitId, existente.id)
            } catch { /* ignora 404 */ }
          }
        }
        // Cria novas
        for (const acao of acoes) {
          await createAcao(kitId, acao)
        }
        // Avança status para 'acoes' se ainda em rascunho
        try {
          await mudarStatus(kitId, 'acoes')
        } catch { /* ignora se já está em 'acoes' ou adiante */ }
        await this.fetchList()
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async finalizar (id: number) {
      this.error = ''
      try {
        const result = await finalizarKit(id)
        await this.fetchList()
        return result
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async assinar (id: number) {
      this.error = ''
      try {
        const result = await assinarKit(id)
        await this.fetchList()
        return result
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async remove (id: number) {
      this.error = ''
      try {
        await deleteKit(id)
        this.items = this.items.filter(k => k.id !== id)
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },
  },
})

// ── Helpers de conversão camelCase ↔ snake_case ──

function cadastroToAPI (c: Partial<KitCadastro>): Record<string, any> {
  return {
    nome_completo: c.nome || undefined,
    cpf: c.cpf ? c.cpf.replace(/\D/g, '') : undefined,
    genero: c.genero || undefined,
    nacionalidade: c.nacionalidadeTipo === 'outro' ? c.nacionalidade : (c.nacionalidadeTipo === 'brasileiro' ? 'Brasileiro(a)' : undefined),
    estado_civil: c.estadoCivilTipo === 'outro' ? c.estadoCivil : c.estadoCivilTipo || undefined,
    profissao: c.profissaoTipo === 'outro' ? c.profissao : c.profissaoTipo || undefined,
    condicao_cliente: c.condicaoCliente || undefined,
    telefone: c.telefone || undefined,
    // Endereço
    logradouro: c.rua || undefined,
    numero: c.numero || undefined,
    bairro: c.bairro || undefined,
    cidade: c.cidade || undefined,
    uf: c.estado || undefined,
    cep: c.cep ? c.cep.replace(/\D/g, '') : undefined,
    // Rogado / testemunhas
    rogado_nome: c.rogadoNome || '',
    rogado_cpf: c.rogadoCpf ? c.rogadoCpf.replace(/\D/g, '') : '',
    testemunha1_nome: c.testemunha1Nome || '',
    testemunha1_cpf: c.testemunha1Cpf ? c.testemunha1Cpf.replace(/\D/g, '') : '',
    testemunha2_nome: c.testemunha2Nome || '',
    testemunha2_cpf: c.testemunha2Cpf ? c.testemunha2Cpf.replace(/\D/g, '') : '',
    // Responsável legal
    responsavel_legal_nome: c.responsavelLegalNome || '',
    responsavel_legal_cpf: c.responsavelLegalCpf ? c.responsavelLegalCpf.replace(/\D/g, '') : '',
    // Comprovante
    comprovante_nome_cliente: c.comprovanteNomeCliente || '',
    responsavel_imovel_nome: c.responsavelImovelNome || '',
    responsavel_imovel_cpf: c.responsavelImovelCpf ? c.responsavelImovelCpf.replace(/\D/g, '') : '',
    // Hipossuficiência
    ...(c.possuiImoveis !== null && c.possuiImoveis !== undefined ? { possui_imoveis: c.possuiImoveis } : {}),
    ...(c.possuiMoveis !== null && c.possuiMoveis !== undefined ? { possui_moveis: c.possuiMoveis } : {}),
    ...(c.isentoIrpf !== null && c.isentoIrpf !== undefined ? { isento_irpf: c.isentoIrpf } : {}),
    // Contato
    titular_contato: c.titularContato || '',
    nome_titular_numero: c.nomeTitularNumero || '',
    relacao_titular_tipo: c.relacaoTitularTipo || '',
    relacao_titular: c.relacaoTitular || '',
  }
}

export function clienteToCadastro (c: Record<string, any>): KitCadastro {
  const cad = emptyCadastro()
  cad.nome = c.nome_completo || ''
  cad.cpf = formatCPF(c.cpf || '')
  cad.genero = c.genero || ''
  cad.condicaoCliente = c.condicao_cliente || 'alfabetizado'
  cad.telefone = c.telefone || ''

  // Nacionalidade
  if (c.nacionalidade && !['Brasileiro(a)', 'brasileiro', 'brasileira'].includes(c.nacionalidade)) {
    cad.nacionalidadeTipo = 'outro'
    cad.nacionalidade = c.nacionalidade
  } else if (c.nacionalidade) {
    cad.nacionalidadeTipo = 'brasileiro'
  }

  // Estado civil
  const estadosCivis = ['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']
  if (estadosCivis.includes(c.estado_civil)) {
    cad.estadoCivilTipo = c.estado_civil
  } else if (c.estado_civil) {
    cad.estadoCivilTipo = 'outro'
    cad.estadoCivil = c.estado_civil
  }

  // Profissão
  const profissoes = ['aposentado', 'pensionista']
  if (profissoes.includes(c.profissao)) {
    cad.profissaoTipo = c.profissao
  } else if (c.profissao) {
    cad.profissaoTipo = 'outro'
    cad.profissao = c.profissao
  }

  // Endereço
  cad.rua = c.logradouro || ''
  cad.numero = c.numero || ''
  cad.bairro = c.bairro || ''
  cad.cidade = c.cidade || ''
  cad.estado = c.uf || ''
  cad.cep = formatCEP(c.cep || '')

  // Rogado / testemunhas
  cad.rogadoNome = c.rogado_nome || ''
  cad.rogadoCpf = formatCPF(c.rogado_cpf || '')
  cad.testemunha1Nome = c.testemunha1_nome || ''
  cad.testemunha1Cpf = formatCPF(c.testemunha1_cpf || '')
  cad.testemunha2Nome = c.testemunha2_nome || ''
  cad.testemunha2Cpf = formatCPF(c.testemunha2_cpf || '')

  // Responsável legal
  cad.responsavelLegalNome = c.responsavel_legal_nome || ''
  cad.responsavelLegalCpf = formatCPF(c.responsavel_legal_cpf || '')

  // Hipossuficiência
  cad.possuiImoveis = c.possui_imoveis ?? null
  cad.possuiMoveis = c.possui_moveis ?? null
  cad.isentoIrpf = c.isento_irpf ?? null

  // Comprovante
  cad.comprovanteNomeCliente = c.comprovante_nome_cliente || ''
  cad.responsavelImovelNome = c.responsavel_imovel_nome || ''
  cad.responsavelImovelCpf = formatCPF(c.responsavel_imovel_cpf || '')

  // Contato
  cad.titularContato = c.titular_contato || ''
  cad.nomeTitularNumero = c.nome_titular_numero || ''
  cad.relacaoTitularTipo = c.relacao_titular_tipo || ''
  cad.relacaoTitular = c.relacao_titular || ''

  return cad
}
