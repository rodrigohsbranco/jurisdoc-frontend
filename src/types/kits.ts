export type KitStatus = 'rascunho' | 'acoes' | 'finalizado' | 'assinado'

export type KitEtapa = 'cliente' | 'acoes' | 'kit-final'

export type TipoAcao =
  | 'cartao_credito_consignado'
  | 'rmc'
  | 'rcc'
  | 'emprestimo_nao_autorizado'
  | 'tarifa_bancaria'
  | 'contribuicao_sindical_nao_autorizada'
  | 'seguro_nao_autorizado'

export type CondicaoCliente = 'alfabetizado' | 'analfabeto' | 'incapaz' | 'crianca_adolescente'

export type UploadedDoc = {
  path: string
  url: string
  name: string
}

export type KitCadastro = {
  // Dados Pessoais
  nome: string
  cpf: string
  genero: string
  nacionalidadeTipo: string        // 'brasileiro' | 'outro'
  nacionalidade: string            // preenchido quando tipo='outro'
  estadoCivilTipo: string          // 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel' | 'outro'
  estadoCivil: string              // preenchido quando tipo='outro'
  profissaoTipo: string            // 'aposentado' | 'pensionista' | 'outro'
  profissao: string                // preenchido quando tipo='outro'
  condicaoCliente: CondicaoCliente

  // Assinatura a Rogo (quando condicao='analfabeto')
  rogadoNome: string
  rogadoCpf: string
  testemunha1Nome: string
  testemunha1Cpf: string
  testemunha2Nome: string
  testemunha2Cpf: string

  // Responsável Legal (quando condicao='incapaz' ou 'crianca_adolescente')
  responsavelLegalNome: string
  responsavelLegalCpf: string

  // Endereço
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string

  // Comprovante de Residência
  comprovanteResidenciaUrl: string
  comprovanteNomeCliente: string   // 'sim' | 'nao'
  responsavelImovelNome: string    // quando comprovanteNomeCliente='nao'
  responsavelImovelCpf: string     // quando comprovanteNomeCliente='nao'
  responsavelImovelDocUrl: string  // quando comprovanteNomeCliente='nao'

  // Declaração de Hipossuficiência
  possuiImoveis: boolean | null
  possuiMoveis: boolean | null
  isentoIrpf: boolean | null

  // Contato
  telefone: string
  titularContato: string           // 'sim' | 'nao'
  nomeTitularNumero: string        // quando titularContato='nao'
  relacaoTitularTipo: string       // 'pai_mae' | 'filho_a' | 'irmao_a' | 'conjuge' | 'outro'
  relacaoTitular: string           // quando relacaoTitularTipo='outro'

  // Status
  status: KitStatus
}

export type KitAcao = {
  nomeBanco: string
  bancoOutro: string               // quando nomeBanco='Outro'
  tipoAcao: TipoAcao | ''
  numeroContrato: string           // quando tipo requer contrato
  tarifaQuestionada: string        // quando tipo='tarifa_bancaria'
  tipoSeguro: string               // quando tipo='seguro_nao_autorizado'
  tipoContribuicao: string         // quando tipo='contribuicao_sindical_nao_autorizada'
  historicoEmprestimoArquivos: UploadedDoc[]
  historicoEmprestimoFiles: File[]
  historicoCreditoArquivos: UploadedDoc[]
  historicoCreditoFiles: File[]
  extratoBancarioArquivos: UploadedDoc[]
  extratoBancarioFiles: File[]
}

export type Kit = {
  id: number
  status: KitStatus
  cadastro: KitCadastro
  acoes: KitAcao[]
  createdAt: string
  updatedAt: string
}

// --- Constantes ---

export const TIPOS_ACAO: { value: TipoAcao; label: string }[] = [
  { value: 'cartao_credito_consignado', label: 'Cartão de Crédito Consignado' },
  { value: 'rmc', label: 'RMC' },
  { value: 'rcc', label: 'RCC' },
  { value: 'emprestimo_nao_autorizado', label: 'Empréstimo Não Autorizado' },
  { value: 'tarifa_bancaria', label: 'Tarifa Bancária' },
  { value: 'contribuicao_sindical_nao_autorizada', label: 'Contribuição Sindical Não Autorizada' },
  { value: 'seguro_nao_autorizado', label: 'Seguro Não Autorizado' },
]

export const TIPOS_COM_CONTRATO: TipoAcao[] = [
  'cartao_credito_consignado',
  'rmc',
  'rcc',
  'emprestimo_nao_autorizado',
]

export const BANCOS = [
  'Bradesco',
  'Itaú',
  'Pan',
  'Daycoval',
  'BMG',
  'C6',
  'Safra',
  'Caixa Econômica',
  'Banco do Brasil',
  'Santander',
  'Banrisul',
  'Cetelem',
  'Mercantil',
  'Master',
  'Agibank',
  'Outro',
]

export const TARIFAS = [
  'Tarifa de cadastro',
  'Tarifa de manutenção de conta',
  'Tarifa de transferência',
  'Tarifa de extrato',
  'Tarifa de saque',
  'Outra',
]

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export const STATUS_MAP: Record<KitStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'grey' },
  acoes: { label: 'Em andamento', color: 'primary' },
  finalizado: { label: 'Finalizado', color: 'warning' },
  assinado: { label: 'Assinado', color: 'success' },
}

// --- Factories ---

export const emptyCadastro = (): KitCadastro => ({
  nome: '',
  cpf: '',
  genero: '',
  nacionalidadeTipo: '',
  nacionalidade: '',
  estadoCivilTipo: '',
  estadoCivil: '',
  profissaoTipo: '',
  profissao: '',
  condicaoCliente: 'alfabetizado',

  rogadoNome: '',
  rogadoCpf: '',
  testemunha1Nome: '',
  testemunha1Cpf: '',
  testemunha2Nome: '',
  testemunha2Cpf: '',

  responsavelLegalNome: '',
  responsavelLegalCpf: '',

  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',

  comprovanteResidenciaUrl: '',
  comprovanteNomeCliente: '',
  responsavelImovelNome: '',
  responsavelImovelCpf: '',
  responsavelImovelDocUrl: '',

  possuiImoveis: null,
  possuiMoveis: null,
  isentoIrpf: null,

  telefone: '',
  titularContato: '',
  nomeTitularNumero: '',
  relacaoTitularTipo: '',
  relacaoTitular: '',

  status: 'rascunho',
})

export const emptyAcao = (): KitAcao => ({
  nomeBanco: '',
  bancoOutro: '',
  tipoAcao: '',
  numeroContrato: '',
  tarifaQuestionada: '',
  tipoSeguro: '',
  tipoContribuicao: '',
  historicoEmprestimoArquivos: [],
  historicoEmprestimoFiles: [],
  historicoCreditoArquivos: [],
  historicoCreditoFiles: [],
  extratoBancarioArquivos: [],
  extratoBancarioFiles: [],
})
