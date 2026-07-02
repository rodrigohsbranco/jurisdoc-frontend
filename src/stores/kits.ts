import { defineStore } from 'pinia'
import {
  acaoFromAPI,
  assinarKit,
  createAcao,
  createKit,
  deleteAcao,
  deleteKit,
  finalizarKit,
  fetchKitStats,
  getKit,
  listKits,
  mudarStatus,
  updateAcao,
  updateKit,
  type AcaoAPI,
  type KitDetail,
  type KitListItem,
  type KitStats,
} from '@/services/kits'
import api from '@/services/api'
import { friendlyError } from '@/utils/errorMessages'
import { formatCPF, formatCEP } from '@/utils/formatters'
import type { KitAcao, KitCadastro, KitStatus, KitTelefone, KitTipo } from '@/types/kits'
import { emptyCadastro, emptyAcao, emptyTelefone } from '@/types/kits'

export const useKitsStore = defineStore('kits', {
  state: () => ({
    items: [] as KitListItem[],
    totalItems: 0,
    currentPage: 1,
    pageSize: 8,
    stats: { total: 0, rascunho: 0, em_andamento: 0, pendentes: 0, assinados: 0 } as KitStats,
    loading: false,
    error: '' as string,
  }),

  getters: {
    byId: state => (id: number) => state.items.find(k => k.id === id) || null,
    totalPages: state => Math.ceil(state.totalItems / state.pageSize),
  },

  actions: {
    async fetchList (params?: Record<string, any>) {
      this.loading = true
      this.error = ''
      try {
        const res = await listKits({
          page: this.currentPage,
          page_size: this.pageSize,
          ...params,
        })
        this.items = res.results
        this.totalItems = res.count
      } catch (e: any) {
        this.error = friendlyError(e)
      } finally {
        this.loading = false
      }
    },

    async fetchStats () {
      try {
        this.stats = await fetchKitStats()
      } catch { /* silencioso */ }
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

    async createDraft (clienteId: number, tipo: KitTipo = 'bancario'): Promise<KitDetail> {
      this.error = ''
      try {
        const created = await createKit(clienteId, tipo)
        await Promise.all([this.fetchList(), this.fetchStats()])
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
        const saved: AcaoAPI[] = []
        const existentes = [...acoesExistentes]
        const commonLength = Math.min(acoes.length, existentes.length)

        for (let i = 0; i < commonLength; i++) {
          const existente = existentes[i]
          if (!existente.id) continue
          saved.push(await updateAcao(kitId, existente.id, acoes[i]))
        }

        for (let i = commonLength; i < acoes.length; i++) {
          saved.push(await createAcao(kitId, acoes[i]))
        }

        for (let i = commonLength; i < existentes.length; i++) {
          const existente = existentes[i]
          if (!existente.id) continue
          try {
            await deleteAcao(kitId, existente.id)
          } catch { /* ignora 404 */ }
        }
        // Avança status para 'acoes' apenas quando o kit ainda está em rascunho.
        const currentKit = this.byId(kitId)
        if (currentKit?.status === 'rascunho') {
          await mudarStatus(kitId, 'acoes')
        }
        await Promise.all([this.fetchList(), this.fetchStats()])
        return saved
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },

    async finalizar (id: number) {
      this.error = ''
      try {
        const result = await finalizarKit(id)
        await Promise.all([this.fetchList(), this.fetchStats()])
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
        await Promise.all([this.fetchList(), this.fetchStats()])
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
        this.totalItems = Math.max(0, this.totalItems - 1)
        this.fetchStats()
      } catch (e: any) {
        this.error = friendlyError(e)
        throw e
      }
    },
  },
})

// ── Helpers de conversão camelCase ↔ snake_case ──

function cadastroToAPI (c: Partial<KitCadastro>): Record<string, any> {
  // Telefones: telefones[0] = primário (vai para os campos legacy do Cliente),
  // telefones[1..] = adicionais (vão para telefones_extras como JSON).
  const tels = c.telefones && c.telefones.length > 0 ? c.telefones : [emptyTelefone()]
  const primary = tels[0]
  const extras = tels.slice(1)
    .filter(t => t.numero?.trim())
    .map(t => ({
      numero: t.numero || '',
      titular_contato: t.titularContato || '',
      nome_titular_numero: t.nomeTitularNumero || '',
      relacao_titular_tipo: t.relacaoTitularTipo || '',
      relacao_titular: t.relacaoTitular || '',
    }))

  return {
    nome_completo: c.nome || undefined,
    cpf: c.cpf ? c.cpf.replace(/\D/g, '') : undefined,
    data_nascimento: c.dataNascimento || null,
    genero: c.genero || undefined,
    nacionalidade: c.nacionalidadeTipo === 'outro' ? c.nacionalidade : (c.nacionalidadeTipo === 'brasileiro' ? 'Brasileiro(a)' : undefined),
    estado_civil: c.estadoCivilTipo === 'outro' ? c.estadoCivil : c.estadoCivilTipo || undefined,
    profissao: c.profissaoTipo === 'outro' ? c.profissao : c.profissaoTipo || undefined,
    condicao_cliente: c.condicaoCliente || undefined,
    telefone: primary.numero || undefined,
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
    // Geolocalização da residência
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    // Hipossuficiência
    ...(c.possuiImoveis !== null && c.possuiImoveis !== undefined ? { possui_imoveis: c.possuiImoveis } : {}),
    ...(c.possuiMoveis !== null && c.possuiMoveis !== undefined ? { possui_moveis: c.possuiMoveis } : {}),
    ...(c.isentoIrpf !== null && c.isentoIrpf !== undefined ? { isento_irpf: c.isentoIrpf } : {}),
    // Contato — primário em campos legacy + adicionais em telefones_extras
    titular_contato: primary.titularContato || '',
    nome_titular_numero: primary.nomeTitularNumero || '',
    relacao_titular_tipo: primary.relacaoTitularTipo || '',
    relacao_titular: primary.relacaoTitular || '',
    telefones_extras: extras,
  }
}

export function clienteToCadastro (c: Record<string, any>): KitCadastro {
  const cad = emptyCadastro()
  cad.nome = c.nome_completo || ''
  cad.cpf = formatCPF(c.cpf || '')
  cad.dataNascimento = c.data_nascimento || ''
  cad.genero = c.genero || ''
  cad.condicaoCliente = c.condicao_cliente || 'alfabetizado'

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
  cad.comprovantesResidencia = Array.isArray(c.comprovantes_residencia) ? c.comprovantes_residencia : []
  cad.responsavelImovelDocs = Array.isArray(c.responsavel_imovel_docs) ? c.responsavel_imovel_docs : []

  // Geolocalização da residência
  cad.latitude = c.latitude ?? null
  cad.longitude = c.longitude ?? null
  cad.fotosResidencia = Array.isArray(c.fotos_residencia) ? c.fotos_residencia : []

  // Contato — reconstrói telefones[] a partir do primário (campos legacy)
  // + adicionais em telefones_extras
  const primary: KitTelefone = {
    numero: c.telefone || '',
    titularContato: c.titular_contato || '',
    nomeTitularNumero: c.nome_titular_numero || '',
    relacaoTitularTipo: c.relacao_titular_tipo || '',
    relacaoTitular: c.relacao_titular || '',
  }
  const extras: KitTelefone[] = Array.isArray(c.telefones_extras)
    ? c.telefones_extras.map((t: any) => ({
        numero: t?.numero || '',
        titularContato: t?.titular_contato || '',
        nomeTitularNumero: t?.nome_titular_numero || '',
        relacaoTitularTipo: t?.relacao_titular_tipo || '',
        relacaoTitular: t?.relacao_titular || '',
      }))
    : []
  cad.telefones = [primary, ...extras]

  return cad
}
