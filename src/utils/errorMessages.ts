/**
 * Mapeador centralizado de erros da API para mensagens amigáveis em pt-BR.
 * Traduz erros técnicos do backend para linguagem que o usuário final entende.
 */

// Mensagens amigáveis por status HTTP
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Os dados enviados são inválidos. Verifique os campos e tente novamente.',
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O registro solicitado não foi encontrado.',
  405: 'Esta operação não é permitida.',
  409: 'Conflito: este registro já existe ou está em uso.',
  413: 'O arquivo enviado é muito grande.',
  422: 'Os dados enviados não puderam ser processados.',
  429: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  500: 'Erro interno no servidor. Tente novamente em alguns instantes.',
  502: 'O servidor está temporariamente indisponível.',
  503: 'O servidor está em manutenção. Tente novamente em alguns minutos.',
}

// Padrões conhecidos do backend → mensagens amigáveis
const KNOWN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  // Django unique constraint
  { pattern: /unique.*constraint|already exists|já existe|duplicate key/i, message: 'Este registro já existe. Verifique se não há duplicidade.' },
  // Django PROTECT constraint
  { pattern: /cannot be deleted|cannot delete|protectederror|está sendo usado|possui.*vinculad/i, message: 'Não é possível excluir este registro pois ele está vinculado a outros dados.' },
  // Field required
  { pattern: /this field is required|este campo é obrigatório|campo obrigatório/i, message: 'Preencha todos os campos obrigatórios.' },
  // Invalid format
  { pattern: /invalid.*format|formato inválido/i, message: 'O formato dos dados está incorreto. Verifique e tente novamente.' },
  // File too large
  { pattern: /file.*too.*large|arquivo.*grande/i, message: 'O arquivo é muito grande. Reduza o tamanho e tente novamente.' },
  // Template rendering
  { pattern: /undefined.*variable|variável.*indefinida|UndefinedError/i, message: 'O template possui variáveis não preenchidas. Verifique todos os campos.' },
  { pattern: /template.*syntax|sintaxe.*template|TemplateSyntaxError/i, message: 'Erro de sintaxe no template. Verifique o arquivo .docx.' },
  { pattern: /angle|<< >>|atualize para jinja/i, message: 'Este template usa formato antigo (<< >>). Atualize para Jinja {{ }}.' },
  // CPF/CNPJ
  { pattern: /cpf.*inválido|cpf.*invalid/i, message: 'O CPF informado é inválido.' },
  { pattern: /cnpj.*inválido|cnpj.*invalid/i, message: 'O CNPJ informado é inválido.' },
  // Authentication
  { pattern: /no active account|credenciais inválidas|invalid credentials/i, message: 'Usuário ou senha incorretos.' },
  { pattern: /token.*invalid|token.*expired|token.*blacklisted/i, message: 'Sua sessão expirou. Faça login novamente.' },
  // Permission
  { pattern: /not.*permission|sem permissão|permission denied/i, message: 'Você não tem permissão para esta ação.' },
  // Network
  { pattern: /network.*error|econnrefused|econnreset|enotfound/i, message: 'Não foi possível conectar ao servidor. Verifique sua conexão.' },
  { pattern: /timeout|timed? ?out/i, message: 'A operação demorou demais. Tente novamente.' },
]

/**
 * Mapeia contexto da operação para mensagens de fallback mais específicas.
 */
const CONTEXT_FALLBACKS: Record<string, Record<string, string>> = {
  clientes: {
    list: 'Não foi possível carregar a lista de clientes.',
    create: 'Não foi possível cadastrar o cliente. Verifique os dados.',
    update: 'Não foi possível atualizar o cliente.',
    remove: 'Não foi possível excluir o cliente.',
  },
  templates: {
    list: 'Não foi possível carregar os templates.',
    create: 'Não foi possível criar o template. Verifique o arquivo.',
    update: 'Não foi possível atualizar o template.',
    remove: 'Não foi possível excluir o template.',
    fields: 'Não foi possível analisar os campos do template.',
    render: 'Não foi possível gerar o documento. Verifique os campos.',
  },
  peticoes: {
    list: 'Não foi possível carregar as petições.',
    create: 'Não foi possível criar a petição. Verifique os dados.',
    update: 'Não foi possível atualizar a petição.',
    remove: 'Não foi possível excluir a petição.',
    render: 'Não foi possível gerar o documento. Verifique os campos preenchidos.',
  },
  contratos: {
    list: 'Não foi possível carregar os contratos.',
    create: 'Não foi possível criar o contrato. Verifique os dados.',
    update: 'Não foi possível atualizar o contrato.',
    remove: 'Não foi possível excluir o contrato.',
    render: 'Não foi possível gerar o documento do contrato.',
  },
  contas: {
    list: 'Não foi possível carregar as contas bancárias.',
    create: 'Não foi possível cadastrar a conta.',
    update: 'Não foi possível atualizar a conta.',
    remove: 'Não foi possível excluir a conta.',
  },
  usuarios: {
    list: 'Não foi possível carregar os usuários.',
    create: 'Não foi possível criar o usuário.',
    update: 'Não foi possível atualizar o usuário.',
    remove: 'Não foi possível excluir o usuário.',
    password: 'Não foi possível alterar a senha.',
  },
}

/**
 * Extrai a mensagem mais relevante de um erro de API.
 *
 * @param error - Erro capturado (AxiosError ou Error genérico)
 * @param context - Contexto da operação, ex: "clientes"
 * @param action - Ação sendo executada, ex: "create", "remove"
 * @returns Mensagem amigável em pt-BR
 */
export function friendlyError(
  error: any,
  context?: string,
  action?: string,
): string {
  // 1) Sem resposta = problema de rede
  if (!error?.response) {
    const msg = error?.message || ''
    // Tenta encontrar padrão conhecido na mensagem
    for (const { pattern, message } of KNOWN_PATTERNS) {
      if (pattern.test(msg)) return message
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão de internet.'
  }

  const status = error.response.status
  const data = error.response.data

  // 2) Extrai detail do backend (DRF padrão)
  let detail = ''
  if (typeof data === 'string') {
    detail = data
  } else if (data?.detail) {
    detail = String(data.detail)
  } else if (data?.non_field_errors) {
    detail = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : String(data.non_field_errors)
  }

  // 3) Verifica padrões conhecidos na mensagem do backend
  const textToCheck = detail || JSON.stringify(data || '')
  for (const { pattern, message } of KNOWN_PATTERNS) {
    if (pattern.test(textToCheck)) return message
  }

  // 4) Se tem detail legível (não é JSON técnico), usa direto
  if (detail && detail.length < 200 && !detail.includes('{') && !detail.includes('Traceback')) {
    return detail
  }

  // 5) Mensagem por status HTTP
  if (STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status]
  }

  // 6) Fallback por contexto/ação
  if (context && action && CONTEXT_FALLBACKS[context]?.[action]) {
    return CONTEXT_FALLBACKS[context][action]
  }
  if (context && CONTEXT_FALLBACKS[context]?.list) {
    return `Erro ao processar a operação. Tente novamente.`
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}

/**
 * Extrai erros de campo (HTTP 400 com validação por campo).
 * Retorna null se não for um erro de validação por campo.
 */
export function extractFieldErrors(error: any): Record<string, string[]> | null {
  if (error?.response?.status !== 400) return null
  const data = error.response.data
  if (!data || typeof data !== 'object' || data.detail) return null
  // Verifica se parece com campo→erros (ex: { cpf: ["CPF inválido"] })
  const keys = Object.keys(data)
  if (keys.length === 0) return null
  const first = data[keys[0]]
  if (Array.isArray(first) || typeof first === 'string') {
    // Normaliza: garante que todos os valores são arrays de strings
    const result: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(data)) {
      result[k] = Array.isArray(v) ? v.map(String) : [String(v)]
    }
    return result
  }
  return null
}
