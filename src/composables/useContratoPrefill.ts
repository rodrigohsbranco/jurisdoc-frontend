/**
 * Composable for auto-filling Jinja template fields from client, bank, contract data.
 * Used by ContratosView (verificação) and PetitionsView.
 */

import type { Cliente } from '@/stores/clientes'
import type { ContaBancaria } from '@/stores/contas'
import type { ContaBancariaReu } from '@/stores/contasReu'
import type { ContratoItem } from '@/stores/contratos'

// Normalize key for comparison
export function normKey(s: any): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

// Synonym map: canonical key -> list of known aliases
const SYNONYMS: Record<string, string[]> = {
  // cliente
  nome: ['nome', 'nomecompleto', 'nome_completo', 'cliente', 'cliente_nome', 'autor', 'requerente'],
  cpf: ['cpf', 'cpfrequerente', 'documentocpf'],
  rg: ['rg', 'identidade'],
  orgaoexpedidor: ['orgaoexpedidor', 'orgao_expedidor', 'orgao', 'oexpedidor', 'oexp', 'expedidor'],
  logradouro: ['logradouro', 'rua', 'endereco', 'end', 'endereco_rua'],
  numero: ['numero', 'num', 'n'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  cep: ['cep', 'codigopostal', 'codpostal'],
  uf: ['uf', 'estado', 'siglaestado'],
  enderecocompleto: ['enderecocompleto', 'enderecoformatado', 'enderecofull', 'endereco_full', 'enderecocompletoformatado'],
  cidadeuf: ['cidadeuf', 'localidade', 'cidade_uf'],
  profissao: ['profissao', 'ocupacao'],
  nacionalidade: ['nacionalidade'],
  estadocivil: ['estadocivil', 'estado_civil'],
  qualificacao: ['qualificacao'],
  idoso: ['idoso', 'se_idoso', 'seidoso', 'senior'],
  incapaz: ['incapaz', 'se_incapaz', 'interditado', 'curatelado', 'tutelado'],
  criancaadolescente: ['criancaadolescente', 'crianca_adolescente', 'menor', 'crianca', 'adolescente', 'criancaouadolescente'],

  // benefícios
  beneficio: ['beneficio', 'numero_beneficio', 'numerobeneficio', 'num_beneficio', 'nb', 'numeroben', 'numero_ben'],
  tipo_beneficio: ['tipo_beneficio', 'tipobeneficio', 'especie_beneficio', 'especiebeneficio'],

  // conta bancária (cliente)
  banco: ['banco', 'banco_nome', 'nomebanco', 'bancoquerecebe', 'banco_que_recebe', 'bancodestino', 'bancorecebedor', 'bancobeneficiario'],
  agencia: ['agencia', 'ag', 'nragencia', 'agenciaquerecebe', 'agencia_que_recebe', 'agenciadestino'],
  conta: ['conta', 'nconta', 'contacorrente', 'contanumero', 'conta_numero', 'contaquerecebe', 'conta_que_recebe', 'contadestino'],
  digito: ['digito', 'dv', 'digitoverificador'],
  tipoconta: ['tipoconta', 'tipo', 'contatipo', 'tipo_conta'],
  contaformatada: ['contaformatada', 'agenciaconta', 'contacompleta'],

  // banco do réu
  banco_reu: ['banco_reu', 'bancoreu', 'banco_devedor', 'bancodevedor'],
  cnpj_banco: ['cnpj_banco', 'cnpjbanco', 'cnpj_banco_reu'],
  logradouro_banco: ['logradouro_banco', 'logradourobanco', 'endereco_banco'],
  cidade_banco: ['cidade_banco', 'cidadebanco'],
  estado_banco: ['estado_banco', 'estadobanco', 'uf_banco'],
  cep_banco: ['cep_banco', 'cepbanco'],

  // contrato
  numero_contrato: ['numero_contrato', 'numerocontrato', 'numero_do_contrato', 'numerodocontrato'],
  banco_contrato: ['banco_contrato', 'bancocontrato', 'banco_do_contrato', 'bancodocontrato'],
  situacao: ['situacao', 'situacao_contrato'],
  origem_averbacao: ['origem_averbacao', 'origemaverbacao', 'origem'],
  data_inclusao: ['data_inclusao', 'datainclusao'],
  data_inicio_desconto: ['data_inicio_desconto', 'datainiciodesconto', 'inicio_desconto'],
  data_fim_desconto: ['data_fim_desconto', 'datafimdesconto', 'fim_desconto'],
  quantidade_parcelas: ['quantidade_parcelas', 'quantidadeparcelas', 'parcelas'],
  valor_parcela: ['valor_parcela', 'valorparcela'],
  iof: ['iof'],
  valor_do_emprestimo: ['valor_do_emprestimo', 'valordoemprestimo', 'valor_emprestimo', 'valoremprestado', 'valor_emprestado_contrato', 'valoremprestadocontrato'],
  valor_liberado: ['valor_liberado', 'valorliberado'],
}

// Build lookup map
const LOOKUP = new Map<string, string>()
for (const [canon, list] of Object.entries(SYNONYMS)) {
  LOOKUP.set(canon, canon)
  for (const s of list) LOOKUP.set(s, canon)
}

export function detectCanon(rawFieldName: string): string {
  const k = normKey(rawFieldName)

  if (LOOKUP.has(k)) return LOOKUP.get(k)!

  // Handle item.* prefix (Jinja contract loop fields)
  if (k.startsWith('item')) {
    const withoutItem = k.replace(/^item[._]?/, '')
    if (LOOKUP.has(withoutItem)) return LOOKUP.get(withoutItem)!
  }

  // Substring fallbacks
  if (k.includes('banco') && k.includes('reu')) return 'banco_reu'
  if (k.includes('banco') && (k.includes('contrato') || k.includes('do_contrato'))) return 'banco_contrato'
  if (k.includes('imagem') && k.includes('contrato')) return 'imagem_do_contrato'
  if (k.includes('banco')) return 'banco'
  if (k.includes('agencia') || k === 'ag') return 'agencia'
  if (k.includes('conta') && !k.includes('reu')) return 'conta'
  if (k.includes('digito') || k === 'dv') return 'digito'
  if (k.includes('tipo') && k.includes('conta')) return 'tipoconta'
  if (k.includes('nome') && !k.includes('banco')) return 'nome'
  if (k.includes('qualificacao')) return 'qualificacao'
  if (k.includes('enderecocompleto') || (k.includes('endereco') && !k.includes('banco'))) return 'logradouro'
  if (k.includes('cidadeuf')) return 'cidadeuf'
  if (k.includes('crianca') || k.includes('adolescente') || k.includes('menor')) return 'criancaadolescente'
  if (k.includes('estado') && k.includes('civil')) return 'estadocivil'
  if (k.includes('beneficio') && k.includes('tipo')) return 'tipo_beneficio'
  if (k.includes('beneficio')) return 'beneficio'
  if (k.includes('numero') && k.includes('contrato')) return 'numero_contrato'
  if (k.includes('situacao')) return 'situacao'
  if (k.includes('origem') && k.includes('averbacao')) return 'origem_averbacao'
  if (k.includes('data') && k.includes('inclusao')) return 'data_inclusao'
  if (k.includes('data') && k.includes('inicio') && k.includes('desconto')) return 'data_inicio_desconto'
  if (k.includes('data') && k.includes('fim') && k.includes('desconto')) return 'data_fim_desconto'
  if (k.includes('quantidade') && k.includes('parcela')) return 'quantidade_parcelas'
  if (k.includes('valor') && k.includes('parcela')) return 'valor_parcela'
  if (k.includes('valor') && k.includes('emprestado')) return 'valor_do_emprestimo'
  if (k.includes('valor') && k.includes('liberado')) return 'valor_liberado'

  return k
}

// Known contract field canons
const CONTRATO_CANONS = new Set([
  'numero_contrato', 'banco_contrato', 'situacao', 'origem_averbacao',
  'data_inclusao', 'data_inicio_desconto', 'data_fim_desconto',
  'quantidade_parcelas', 'valor_parcela', 'iof', 'valor_do_emprestimo',
  'valor_liberado',
])

export function isContratoField(fieldName: string, rawName?: string): boolean {
  const raw = (rawName || fieldName).toLowerCase()
  const k = normKey(fieldName)
  if (raw.includes('bancos_e_contratos') || k.includes('bancosecontratos')) return false
  if (raw.includes('item.')) return true
  if (k.startsWith('item') && k !== 'item') return true
  return CONTRATO_CANONS.has(detectCanon(k))
}

function composeEndereco(c: Cliente): string {
  const maskCEP = (cep?: string) => {
    if (!cep) return ''
    const d = cep.replace(/\D/g, '').slice(0, 8)
    return d.replace(/^(\d{5})(\d{1,3})$/, '$1-$2')
  }
  const partes = [
    [c.logradouro, c.numero].filter(Boolean).join(', '),
    c.bairro,
    [c.cidade, (c.uf || '').toUpperCase()].filter(Boolean).join('/'),
    maskCEP(c.cep),
  ].filter(Boolean)
  return partes.join(' – ')
}

/**
 * Resolve the value for a template field from available data sources.
 */
export function valueFromSources(
  c: Cliente | null,
  acc: ContaBancaria | null,
  bancoReu: ContaBancariaReu | null,
  contrato: ContratoItem | null,
  rawFieldName: string,
): unknown {
  const canon = detectCanon(rawFieldName)

  // 1) Client fields
  if (c) {
    switch (canon) {
      case 'nome': return c.nome_completo || ''
      case 'cpf': return c.cpf || ''
      case 'rg': return c.rg || ''
      case 'orgaoexpedidor': return c.orgao_expedidor || ''
      case 'logradouro': return c.logradouro || ''
      case 'numero': return c.numero || ''
      case 'bairro': return c.bairro || ''
      case 'cidade': return c.cidade || ''
      case 'cep': return c.cep || ''
      case 'uf': return (c.uf || '').toUpperCase()
      case 'profissao': return c.profissao || ''
      case 'nacionalidade': return c.nacionalidade || ''
      case 'estadocivil': return c.estado_civil || ''
      case 'qualificacao': {
        const parts: string[] = []
        if (c.nacionalidade) parts.push(c.nacionalidade.toLowerCase())
        if (c.estado_civil) parts.push(c.estado_civil.toLowerCase())
        return parts.join(', ')
      }
      case 'enderecocompleto': return composeEndereco(c)
      case 'cidadeuf': return [c.cidade, (c.uf || '').toUpperCase()].filter(Boolean).join('/')
      case 'idoso': return !!c.se_idoso
      case 'incapaz': return !!c.se_incapaz
      case 'criancaadolescente': return !!c.se_crianca_adolescente
      case 'beneficio': return c.beneficios?.[0]?.numero || ''
      case 'tipo_beneficio': return c.beneficios?.[0]?.tipo || ''
    }
  }

  // 2) Client bank account
  if (acc) {
    switch (canon) {
      case 'banco': return (acc as any).descricao_ativa || acc.banco_nome || ''
      case 'agencia': return acc.agencia || ''
      case 'conta': return acc.conta || ''
      case 'digito': return acc.digito || ''
      case 'tipoconta': return acc.tipo || ''
      case 'contaformatada': {
        const ag = acc.agencia ?? ''
        const num = acc.conta ?? ''
        const dv = acc.digito ?? ''
        return [ag, num].filter(Boolean).join('/') + (dv ? `-${dv}` : '')
      }
    }
  }

  // 3) Defendant bank
  if (bancoReu) {
    switch (canon) {
      case 'banco_reu': return bancoReu.banco_nome || ''
      case 'cnpj_banco': return bancoReu.cnpj || ''
      case 'logradouro_banco': return bancoReu.logradouro || ''
      case 'cidade_banco': return bancoReu.cidade || ''
      case 'estado_banco': return bancoReu.estado || ''
      case 'cep_banco': return bancoReu.cep || ''
    }
  }

  // 4) Contract fields
  if (contrato) {
    switch (canon) {
      case 'numero_contrato': return contrato.numero_do_contrato || ''
      case 'banco_contrato': return contrato.banco_do_contrato || ''
      case 'situacao': return contrato.situacao || ''
      case 'origem_averbacao': return contrato.origem_averbacao || ''
      case 'data_inclusao': return contrato.data_inclusao || ''
      case 'data_inicio_desconto': return contrato.data_inicio_desconto || ''
      case 'data_fim_desconto': return contrato.data_fim_desconto || ''
      case 'quantidade_parcelas': return contrato.quantidade_parcelas?.toString() || ''
      case 'valor_parcela': return contrato.valor_parcela?.toString() || ''
      case 'iof': return contrato.iof?.toString() || ''
      case 'valor_do_emprestimo': return contrato.valor_do_emprestimo?.toString() || ''
      case 'valor_liberado': return contrato.valor_liberado?.toString() || ''
    }
  }

  return undefined
}

/**
 * Format bancos_e_contratos string from contract items.
 * Example: "Banco AGIBANK SA, CONTRATOS Nº 123 e 456:"
 */
export function formatBancosEContratos(contratos: ContratoItem[]): string {
  const bancosMap = new Map<string, string[]>()
  for (const c of contratos) {
    const banco = c.banco_do_contrato || ''
    const numero = c.numero_do_contrato || ''
    if (banco.trim() && String(numero).trim()) {
      if (!bancosMap.has(banco)) bancosMap.set(banco, [])
      bancosMap.get(banco)!.push(String(numero))
    }
  }
  if (bancosMap.size === 0) return ''

  const partes: string[] = []
  for (const [banco, numeros] of bancosMap.entries()) {
    if (!numeros.length) continue
    let fmt = ''
    if (numeros.length === 1) fmt = numeros[0]
    else if (numeros.length === 2) fmt = `${numeros[0]} e ${numeros[1]}`
    else fmt = `${numeros.slice(0, -1).join(', ')} e ${numeros[numeros.length - 1]}`
    const label = numeros.length > 1 ? 'CONTRATOS' : 'CONTRATO'
    partes.push(`Banco ${banco}, ${label} Nº ${fmt}`)
  }
  return partes.length ? partes.join(', ') + ':' : ''
}

/**
 * Format bancos_reus string from contract items + defendant bank data.
 */
export function formatBancosReus(
  contratos: ContratoItem[],
  bancosReu: ContaBancariaReu[],
): string {
  const bancosUnicos = new Set<string>()
  for (const c of contratos) {
    const banco = c.banco_do_contrato || ''
    if (banco.trim()) bancosUnicos.add(banco.trim())
  }
  if (bancosUnicos.size === 0) return ''

  const partes: string[] = []
  for (const nome of bancosUnicos) {
    const br = bancosReu.find(b => b.banco_nome?.trim().toLowerCase() === nome.trim().toLowerCase())
    if (!br) { partes.push(`**${nome}**`); continue }

    const p: string[] = [`**${br.banco_nome}**`]
    if (br.descricao?.trim()) p.push(br.descricao.trim())
    if (br.cnpj) {
      const f = br.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      p.push(`CNPJ: ${f}`)
    }
    const end: string[] = []
    if (br.logradouro) end.push(br.logradouro)
    if (br.numero) end.push(br.numero)
    if (br.bairro) end.push(br.bairro)
    if (br.cidade) end.push(br.cidade)
    if (br.estado) end.push(br.estado)
    if (br.cep) end.push(`CEP: ${br.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`)
    if (end.length) p.push(end.join(', '))
    partes.push(p.join(', '))
  }
  return partes.join(', e ')
}
