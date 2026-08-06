import api from './api'

export type TipoLeituraIA = 'identidade' | 'comprovante_residencia'

/** Campos que a IA devolve ao ler documentos de identidade (RG, CNH, CPF). */
export interface DadosIdentidadeIA {
  nome_completo: string | null
  cpf: string | null
  rg: string | null
  orgao_expedidor: string | null
  data_nascimento: string | null   // YYYY-MM-DD
  genero: string | null            // 'masculino' | 'feminino'
  nacionalidade: string | null
}

/** Campos que a IA devolve ao ler comprovantes de residência. */
export interface DadosEnderecoIA {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null               // 8 dígitos, sem traço
}

export type DadosExtraidosIA = Partial<DadosIdentidadeIA & DadosEnderecoIA>

export interface LeituraIAResponse {
  dados_extraidos: DadosExtraidosIA
  uso_tokens: { input: number, output: number, total: number }
  modelo: string
}

/**
 * Lê por IA os documentos JÁ ENVIADOS do cliente e devolve os campos extraídos.
 *
 * Nada é gravado no cliente — o operador revisa os dados no formulário e salva
 * normalmente. A leitura leva alguns segundos, daí o timeout maior.
 */
export async function extrairDocumentosIA (
  clienteId: number,
  tipo: TipoLeituraIA,
): Promise<LeituraIAResponse> {
  const { data } = await api.post<LeituraIAResponse>(
    `/api/cadastro/clientes/${clienteId}/ia/extrair-documentos/`,
    { tipo },
    { timeout: 120000 },
  )
  return data
}
