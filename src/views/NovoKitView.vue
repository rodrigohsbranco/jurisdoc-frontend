<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useKitsStore, clienteToCadastro } from '@/stores/kits'
import { useClientesStore, type Cliente } from '@/stores/clientes'
import { useTemplatesStore } from '@/stores/templates'
import { useAdvogadosStore } from '@/stores/advogados'
import { acaoFromAPI, enviarParaAssinatura, type AcaoAPI, type DocumentoAPI, type ZapSignDocInfo } from '@/services/kits'
import { listBancos, listTarifas, listAssociacoes, type AssociacaoKit } from '@/services/bancosETarifas'
import { snapshotKit } from '@/services/clausulas'
import {
  type AdvogadoSnapshot,
  getSnapshot as getAdvogadosSnapshot,
  getSugeridos as getAdvogadosSugeridos,
  saveSnapshot as saveAdvogadosSnapshot,
} from '@/services/kitAdvogados'
import draggable from 'vuedraggable'
import api from '@/services/api'
import { useSnackbar } from '@/composables/useSnackbar'
import { usePermissions } from '@/composables/usePermissions'
import { useCpf } from '@/composables/useCpf'
import { useCepLookup } from '@/composables/useCepLookup'
import { onlyDigits, formatCPF } from '@/utils/formatters'
import { friendlyError, extractFieldErrors } from '@/utils/errorMessages'
import SidePanel from '@/components/SidePanel.vue'
import {
  TIPOS_ACAO,
  TIPOS_COM_CONTRATO,
  TIPOS_KIT,
  UF_LIST,
  emptyAcao,
  emptyCadastro,
  emptyTelefone,
  type CondicaoCliente,
  type KitAcao,
  type KitCadastro,
  type KitEtapa,
  type KitTipo,
  type TipoAcao,
} from '@/types/kits'

const etapaAtual = ref<KitEtapa>('cliente')
const etapas = computed<KitEtapa[]>(() =>
  tipoKit.value === 'previdenciario'
    ? ['cliente', 'advogados', 'kit-final']
    : ['cliente', 'acoes', 'advogados', 'kit-final'],
)
const etapaIndex = computed(() => etapas.value.indexOf(etapaAtual.value))
const route = useRoute()
const router = useRouter()
const kitsStore = useKitsStore()
const kitId = computed(() => Number(route.params.id || 0))
const isEditMode = computed(() => !!kitId.value)
const saving = ref(false)
const tipoKit = ref<KitTipo>('bancario')

// ── ZapSign ──
const zapsignLoading = ref(false)
const zapsignStatus = ref<string | null>(null)
const zapsignDialog = ref(false)
const zapsignStep = ref(1)
const zapsignNivel = ref<'basico' | 'medio' | 'avancado'>('basico')
const zapsignMedioTipo = ref<'email' | 'sms'>('email')
const zapsignComRubrica = ref(false)
const zapsignSignUrl = ref<string | null>(null)
const zapsignDocumentos = ref<ZapSignDocInfo[]>([])
const zapsignCopied = ref(false)
const zapsignVerificandoStatus = ref(false)
const documentosAssinados = ref<DocumentoAPI[]>([])
const clienteId = ref<number | null>(null)
const acoesExistentes = ref<AcaoAPI[]>([])
const clientesStore = useClientesStore()
const { showSuccess, showError, showInfo } = useSnackbar()
const { can } = usePermissions()

// Bancos e tarifas dinâmicos (do banco de dados)
const bancosOptions = ref<string[]>([])
const tarifasOptions = ref<string[]>([])
const associacoesOptions = ref<AssociacaoKit[]>([])

const associacoesSelectItems = computed(() =>
  associacoesOptions.value.map(a => ({
    id: a.id,
    label: a.abreviacao ? `${a.nome} (${a.abreviacao})` : a.nome,
  })),
)

async function carregarBancosETarifas () {
  const [bancos, tarifas, associacoes] = await Promise.all([listBancos(), listTarifas(), listAssociacoes()])
  bancosOptions.value = bancos.filter(b => b.ativo).map(b => b.nome)
  if (!bancosOptions.value.includes('Outro')) bancosOptions.value.push('Outro')
  tarifasOptions.value = tarifas.filter(t => t.ativo).map(t => t.nome)
  if (!tarifasOptions.value.includes('OUTROS')) tarifasOptions.value.push('OUTROS')
  associacoesOptions.value = associacoes.filter(a => a.ativo)
}

// ── Busca de cliente por CPF ──
const cpfBusca = ref('')
const buscandoCliente = ref(false)
const clienteEncontrado = ref(false)
const clienteNaoEncontrado = ref(false)
const clienteNome = ref('')

async function buscarClientePorCpf () {
  const digits = onlyDigits(cpfBusca.value)
  if (digits.length !== 11) return

  buscandoCliente.value = true
  clienteEncontrado.value = false
  clienteNaoEncontrado.value = false

  try {
    const { data } = await api.get('/api/cadastro/clientes/', { params: { search: digits } })
    const results = Array.isArray(data) ? data : data.results || []
    const found = results.find((c: any) => c.cpf === digits)

    if (found) {
      clienteId.value = found.id
      cad.value = clienteToCadastro(found)
      clienteEncontrado.value = true
      clienteNome.value = found.nome_completo
      docsPessoais.value = found.documentos_pessoais || []
      relatedDocs.value.rogado = found.rogado_documentos || []
      relatedDocs.value.testemunha1 = found.testemunha1_documentos || []
      relatedDocs.value.testemunha2 = found.testemunha2_documentos || []
      relatedDocs.value.responsavel_legal = found.responsavel_legal_documentos || []
    } else {
      docsPessoais.value = []
      relatedDocs.value.rogado = []
      relatedDocs.value.testemunha1 = []
      relatedDocs.value.testemunha2 = []
      relatedDocs.value.responsavel_legal = []
      clienteNaoEncontrado.value = true
    }
  } catch (e: any) {
    showError('Erro ao buscar cliente.')
  } finally {
    buscandoCliente.value = false
  }
}

// ── Drawer cadastro de cliente ──
const drawerCadastro = ref(false)
const drawerForm = ref<Partial<Cliente>>({})
const drawerFieldErrors = ref<Record<string, string[]>>({})
const drawerTab = ref('pessoal')

function abrirDrawerCadastro () {
  drawerForm.value = {
    nome_completo: '',
    cpf: cpfBusca.value,
    rg: '',
    orgao_expedidor: '',
    nacionalidade: '',
    estado_civil: '',
    profissao: '',
    se_idoso: false,
    se_incapaz: false,
    se_crianca_adolescente: false,
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    cep: '',
    uf: '',
    beneficios: [],
  }
  drawerFieldErrors.value = {}
  drawerTab.value = 'pessoal'
  drawerCadastro.value = true
}

async function salvarClienteDrawer () {
  drawerFieldErrors.value = {}
  try {
    if (!drawerForm.value.nome_completo?.trim()) {
      throw new Error('Informe o nome completo.')
    }
    const payload = { ...drawerForm.value } as any
    if (payload.cpf) payload.cpf = onlyDigits(payload.cpf)
    if (payload.cep) payload.cep = onlyDigits(payload.cep)
    if (payload.uf) payload.uf = String(payload.uf).toUpperCase()

    const created = await clientesStore.create(payload)
    clienteId.value = created.id
    cad.value = clienteToCadastro(created as any)
    clienteEncontrado.value = true
    clienteNaoEncontrado.value = false
    clienteNome.value = created.nome_completo
    docsPessoais.value = []
    relatedDocs.value.rogado = []
    relatedDocs.value.testemunha1 = []
    relatedDocs.value.testemunha2 = []
    relatedDocs.value.responsavel_legal = []
    drawerCadastro.value = false
    showSuccess('Cliente cadastrado com sucesso!')
  } catch (e: any) {
    const fields = extractFieldErrors(e)
    if (fields) {
      drawerFieldErrors.value = fields
      return
    }
    showError(friendlyError(e))
  }
}

// ── Drawer CEP lookup ──
const { cepLoading: drawerCepLoading, cepStatus: drawerCepStatus, lookupCEP: drawerCepLookup } = useCepLookup()

async function drawerLookupCEP () {
  const raw = drawerForm.value.cep || ''
  await drawerCepLookup(raw, (data) => {
    drawerForm.value.logradouro = data.logradouro || drawerForm.value.logradouro || ''
    drawerForm.value.bairro = data.bairro || drawerForm.value.bairro || ''
    drawerForm.value.cidade = data.cidade || drawerForm.value.cidade || ''
    drawerForm.value.uf = data.uf || drawerForm.value.uf || ''
  })
}

// ── Cadastro state ──
const cad = ref<KitCadastro>(emptyCadastro())

// ── Ações state ──
const acoes = ref<KitAcao[]>([])

// ── Composables ──
const { isValidCPF } = useCpf()
const { cepLoading: buscandoCep, lookupCEP } = useCepLookup()

// ── CEP lookup ──
watch(() => cad.value.cep, (val) => {
  const digits = val.replace(/\D/g, '')
  if (digits.length === 8) {
    lookupCEP(digits, (data) => {
      cad.value.rua = data.logradouro || cad.value.rua
      cad.value.bairro = data.bairro || cad.value.bairro
      cad.value.cidade = data.cidade || cad.value.cidade
      cad.value.estado = data.uf || cad.value.estado
    })
  }
})

// ── Masks ──
function maskCPF (v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCEP (v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function maskPhone (v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ── Opções ──
const opcoesGenero = [
  { title: 'Masculino', value: 'masculino' },
  { title: 'Feminino', value: 'feminino' },
]

const opcoesNacionalidade = [
  { title: 'Brasileiro(a)', value: 'brasileiro' },
  { title: 'Outra', value: 'outro' },
]

const opcoesEstadoCivil = [
  { title: 'Solteiro(a)', value: 'solteiro' },
  { title: 'Casado(a)', value: 'casado' },
  { title: 'Divorciado(a)', value: 'divorciado' },
  { title: 'Viúvo(a)', value: 'viuvo' },
  { title: 'União Estável', value: 'uniao_estavel' },
  { title: 'Outro', value: 'outro' },
]

const opcoesProfissao = [
  { title: 'Aposentado(a)', value: 'aposentado' },
  { title: 'Pensionista', value: 'pensionista' },
  { title: 'Outra', value: 'outro' },
]

const opcoesCondicao: { label: string; value: CondicaoCliente; icon: string }[] = [
  { label: 'Alfabetizado', value: 'alfabetizado', icon: 'mdi-check-circle-outline' },
  { label: 'Analfabeto(a)', value: 'analfabeto', icon: 'mdi-pencil-off-outline' },
  { label: 'Incapaz', value: 'incapaz', icon: 'mdi-account-alert-outline' },
  { label: 'Criança/Adolescente', value: 'crianca_adolescente', icon: 'mdi-account-child-outline' },
]

const opcoesTitularContato = [
  { title: 'Sim, o cliente é o titular', value: 'sim' },
  { title: 'Não, é outra pessoa', value: 'nao' },
]

const opcoesRelacaoTitular = [
  { title: 'Pai/Mãe', value: 'pai_mae' },
  { title: 'Filho(a)', value: 'filho_a' },
  { title: 'Irmão/Irmã', value: 'irmao_a' },
  { title: 'Cônjuge', value: 'conjuge' },
  { title: 'Outro', value: 'outro' },
]

// ── Computed helpers ──
const isAnalfabeto = computed(() => cad.value.condicaoCliente === 'analfabeto')
const needsResponsavel = computed(() =>
  cad.value.condicaoCliente === 'incapaz' || cad.value.condicaoCliente === 'crianca_adolescente',
)
const comprovanteNaoCliente = computed(() => cad.value.comprovanteNomeCliente === 'nao')
function formatarRelacaoTitular (t: { relacaoTitularTipo: string, relacaoTitular: string }): string {
  if (t.relacaoTitularTipo === 'outro') return t.relacaoTitular?.trim() || ''
  const map: Record<string, string> = {
    pai_mae: 'pai/mãe',
    filho_a: 'filho(a)',
    irmao_a: 'irmão/irmã',
    conjuge: 'cônjuge',
  }
  return map[t.relacaoTitularTipo] || ''
}

function addTelefone () {
  cad.value.telefones.push(emptyTelefone())
}

function removeTelefone (idx: number) {
  if (cad.value.telefones.length <= 1) return
  cad.value.telefones.splice(idx, 1)
}

// ── Upload docs pessoais (múltiplos) ──
interface DocPessoal {
  path: string
  url: string
  name: string
}

type RelatedDocOwner = 'rogado' | 'testemunha1' | 'testemunha2' | 'responsavel_legal'

const docsPessoais = ref<DocPessoal[]>([])
const uploadingDocs = ref(false)
const relatedDocs = ref<Record<RelatedDocOwner, DocPessoal[]>>({
  rogado: [],
  testemunha1: [],
  testemunha2: [],
  responsavel_legal: [],
})
const relatedDocsUploading = ref<Record<RelatedDocOwner, boolean>>({
  rogado: false,
  testemunha1: false,
  testemunha2: false,
  responsavel_legal: false,
})

async function onSelectDocPessoal (e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) await uploadDocsPessoais(Array.from(files))
  // Reset input para permitir reselecionar o mesmo arquivo
  ;(e.target as HTMLInputElement).value = ''
}

async function onDropDocPessoal (e: DragEvent) {
  const files = e.dataTransfer?.files
  if (files?.length) await uploadDocsPessoais(Array.from(files))
}

async function uploadDocsPessoais (files: File[]) {
  if (!clienteId.value || !files.length) return
  uploadingDocs.value = true
  try {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/documentos-pessoais/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    docsPessoais.value = data.documentos_pessoais
  } catch (e: any) {
    console.error('Erro no upload:', e)
  } finally {
    uploadingDocs.value = false
  }
}

async function onSelectRelatedDocs (owner: RelatedDocOwner, e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files?.length) await uploadRelatedDocs(owner, Array.from(files))
  input.value = ''
}

async function uploadRelatedDocs (owner: RelatedDocOwner, files: File[]) {
  if (!clienteId.value || !files.length) return
  relatedDocsUploading.value[owner] = true
  try {
    const fd = new FormData()
    fd.append('owner', owner)
    files.forEach(f => fd.append('files', f))
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/documentos-vinculados/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    relatedDocs.value[owner] = data.documentos || []
  } catch (e: any) {
    console.error(`Erro no upload de ${owner}:`, e)
  } finally {
    relatedDocsUploading.value[owner] = false
  }
}

function isImage (name: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name)
}

function docIcon (name: string) {
  if (/\.pdf$/i.test(name)) return 'mdi-file-pdf-box'
  if (/\.docx?$/i.test(name)) return 'mdi-file-word-outline'
  return 'mdi-file-outline'
}

async function removeDocPessoal (doc: DocPessoal) {
  if (!clienteId.value) return
  try {
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/documentos-pessoais/remove/`,
      { path: doc.path },
    )
    docsPessoais.value = data.documentos_pessoais
  } catch (e: any) {
    console.error('Erro ao remover doc:', e)
  }
}

const comprovantesUploading = ref(false)
const responsavelDocsUploading = ref(false)

async function onSelectComprovantes (e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files?.length) await uploadComprovantesResidencia(Array.from(files))
  input.value = ''
}
async function onDropComprovantes (e: DragEvent) {
  const files = e.dataTransfer?.files
  if (files?.length) await uploadComprovantesResidencia(Array.from(files))
}
async function uploadComprovantesResidencia (files: File[]) {
  if (!clienteId.value || !files.length) return
  comprovantesUploading.value = true
  try {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/comprovantes-residencia/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    cad.value.comprovantesResidencia = data.comprovantes_residencia || []
  } catch (e: any) {
    console.error('Erro no upload de comprovantes:', e)
  } finally {
    comprovantesUploading.value = false
  }
}
async function removeComprovante (doc: DocPessoal) {
  if (!clienteId.value) return
  try {
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/comprovantes-residencia/remove/`,
      { path: doc.path },
    )
    cad.value.comprovantesResidencia = data.comprovantes_residencia || []
  } catch (e: any) {
    console.error('Erro ao remover comprovante:', e)
  }
}

// ── Fotos da residência (geolocalização) ──
const MAX_FOTOS_RESIDENCIA = 10
const fotosResidenciaUploading = ref(false)

async function onSelectFotosResidencia (e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files?.length) await uploadFotosResidencia(Array.from(files))
  input.value = ''
}
async function onDropFotosResidencia (e: DragEvent) {
  const files = e.dataTransfer?.files
  if (files?.length) await uploadFotosResidencia(Array.from(files))
}
async function uploadFotosResidencia (files: File[]) {
  if (!clienteId.value || !files.length) return
  const atuais = cad.value.fotosResidencia?.length || 0
  if (atuais + files.length > MAX_FOTOS_RESIDENCIA) {
    showError(`Limite de ${MAX_FOTOS_RESIDENCIA} fotos por residência.`)
    return
  }
  fotosResidenciaUploading.value = true
  try {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/fotos-residencia/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    cad.value.fotosResidencia = data.fotos_residencia || []
  } catch (e: any) {
    showError(friendlyError(e))
  } finally {
    fotosResidenciaUploading.value = false
  }
}
async function removeFotoResidencia (doc: DocPessoal) {
  if (!clienteId.value) return
  try {
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/fotos-residencia/remove/`,
      { path: doc.path },
    )
    cad.value.fotosResidencia = data.fotos_residencia || []
  } catch (e: any) {
    console.error('Erro ao remover foto da residência:', e)
  }
}

// ── Foto 3x4 do cliente (única) ──
const fotoClienteUploading = ref(false)

async function onSelectFotoCliente (e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await uploadFotoCliente(file)
  input.value = ''
}
async function uploadFotoCliente (file: File) {
  if (!clienteId.value) return
  fotoClienteUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/foto-cliente/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    cad.value.fotoCliente = data.foto_cliente || null
  } catch (e: any) {
    showError(friendlyError(e))
  } finally {
    fotoClienteUploading.value = false
  }
}
async function removeFotoCliente () {
  if (!clienteId.value) return
  try {
    await api.post(`/api/cadastro/clientes/${clienteId.value}/foto-cliente/remove/`)
    cad.value.fotoCliente = null
  } catch (e: any) {
    console.error('Erro ao remover foto do cliente:', e)
  }
}

async function onSelectResponsavelDocs (e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files?.length) await uploadResponsavelImovelDocs(Array.from(files))
  input.value = ''
}
async function onDropResponsavelDocs (e: DragEvent) {
  const files = e.dataTransfer?.files
  if (files?.length) await uploadResponsavelImovelDocs(Array.from(files))
}
async function uploadResponsavelImovelDocs (files: File[]) {
  if (!clienteId.value || !files.length) return
  responsavelDocsUploading.value = true
  try {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/responsavel-imovel-docs/upload/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    cad.value.responsavelImovelDocs = data.responsavel_imovel_docs || []
  } catch (e: any) {
    console.error('Erro no upload de docs do responsável:', e)
  } finally {
    responsavelDocsUploading.value = false
  }
}
async function removeResponsavelDoc (doc: DocPessoal) {
  if (!clienteId.value) return
  try {
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/responsavel-imovel-docs/remove/`,
      { path: doc.path },
    )
    cad.value.responsavelImovelDocs = data.responsavel_imovel_docs || []
  } catch (e: any) {
    console.error('Erro ao remover doc do responsável:', e)
  }
}

async function removeRelatedDoc (owner: RelatedDocOwner, doc: DocPessoal) {
  if (!clienteId.value) return
  try {
    const { data } = await api.post(
      `/api/cadastro/clientes/${clienteId.value}/documentos-vinculados/remove/`,
      { owner, path: doc.path },
    )
    relatedDocs.value[owner] = data.documentos || []
  } catch (e: any) {
    console.error(`Erro ao remover doc de ${owner}:`, e)
  }
}

// ── Ações helpers ──
function addAcao () {
  acoes.value.push(emptyAcao())
}

function removeAcao (index: number) {
  acoes.value.splice(index, 1)
}

function updateAcao (index: number, field: keyof KitAcao, value: string | number | null) {
  const acao = acoes.value[index]
  if (field === 'tipoAcao') {
    acao.numeroContrato = ''
    acao.tarifaQuestionada = ''
    acao.tarifaQuestionadaOutro = ''
    acao.tipoSeguro = ''
    acao.tipoContribuicao = ''
    acao.associacaoId = null
    acao.historicoEmprestimoArquivos = []
    acao.historicoEmprestimoFiles = []
    acao.historicoCreditoArquivos = []
    acao.historicoCreditoFiles = []
    acao.extratoBancarioArquivos = []
    acao.extratoBancarioFiles = []
  }
  if (field === 'tarifaQuestionada' && value !== 'OUTROS') {
    acao.tarifaQuestionadaOutro = ''
  }
  if (field === 'nomeBanco' && value !== 'Outro') {
    acao.bancoOutro = ''
  }
  ;(acao as any)[field] = value
}

function resolveTarifaQuestionada (acao: KitAcao): string {
  if (acao.tarifaQuestionada === 'OUTROS') {
    return acao.tarifaQuestionadaOutro?.trim() || 'OUTROS'
  }
  return acao.tarifaQuestionada
}

type AcaoUploadField = 'historicoEmprestimo' | 'historicoCredito' | 'extratoBancario'

function getAcaoOwner (field: AcaoUploadField) {
  if (field === 'historicoEmprestimo') return 'historico_emprestimo'
  if (field === 'historicoCredito') return 'historico_credito'
  return 'extrato_bancario'
}

function setAcaoDocs (index: number, field: AcaoUploadField, docs: any[]) {
  const acao = acoes.value[index]
  if (!acao) return
  if (field === 'historicoEmprestimo') {
    acao.historicoEmprestimoArquivos = docs
    return
  }
  if (field === 'historicoCredito') {
    acao.historicoCreditoArquivos = docs
    return
  }
  acao.extratoBancarioArquivos = docs
}

async function ensurePersistedAcoesForUpload () {
  if (acoesExistentes.value.length === acoes.value.length && acoesExistentes.value.every(a => !!a.id)) return
  if (!validateAcoes()) throw new Error('Preencha os campos obrigatórios da ação antes de enviar anexos.')
  if (clienteId.value) {
    await kitsStore.saveCadastro(kitId.value, clienteId.value, cad.value)
  }
  const savedAcoes = await kitsStore.saveAcoes(kitId.value, acoes.value, acoesExistentes.value)
  acoesExistentes.value = savedAcoes
  acoes.value = savedAcoes.map(a => acaoFromAPI(a))
}

async function uploadAcaoDocs (index: number, field: AcaoUploadField, files: File[]) {
  if (!files.length || !kitId.value) return
  await ensurePersistedAcoesForUpload()
  const acaoId = acoesExistentes.value[index]?.id
  if (!acaoId) throw new Error('Não foi possível identificar a ação para anexar os arquivos.')

  const fd = new FormData()
  fd.append('owner', getAcaoOwner(field))
  files.forEach(file => fd.append('files', file))

  const { data } = await api.post(
    `/api/kits/${kitId.value}/acoes/${acaoId}/anexos/upload/`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  setAcaoDocs(index, field, data.documentos || [])
}

async function onSelectAcaoUpload (index: number, field: AcaoUploadField, e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  try {
    await uploadAcaoDocs(index, field, files)
  } catch (error: any) {
    showError(error?.message || 'Não foi possível enviar os anexos da ação.')
  }
}

async function removeAcaoUpload (index: number, field: AcaoUploadField, path: string) {
  if (!kitId.value) return
  const acaoId = acoesExistentes.value[index]?.id
  if (!acaoId) return
  try {
    const { data } = await api.post(
      `/api/kits/${kitId.value}/acoes/${acaoId}/anexos/remove/`,
      { owner: getAcaoOwner(field), path },
    )
    setAcaoDocs(index, field, data.documentos || [])
  } catch (error: any) {
    showError(error?.message || 'Não foi possível remover o anexo da ação.')
  }
}

function acaoDocs (acao: KitAcao, field: AcaoUploadField) {
  if (field === 'historicoEmprestimo') {
    return {
      existing: acao.historicoEmprestimoArquivos,
    }
  }
  if (field === 'historicoCredito') {
    return {
      existing: acao.historicoCreditoArquivos,
    }
  }
  return {
    existing: acao.extratoBancarioArquivos,
  }
}

function acaoNeedsContrato (tipo: string) {
  return TIPOS_COM_CONTRATO.includes(tipo as TipoAcao)
}

// ── Validação ──
const errors = ref<Record<string, string>>({})
const acoesErrors = ref<Record<number, Record<string, string>>>({})

function validateCadastro (): boolean {
  const e: Record<string, string> = {}
  if (!cad.value.nome?.trim()) e.nome = 'Campo obrigatório'
  if (!cad.value.cpf?.trim()) e.cpf = 'Campo obrigatório'
  else if (!isValidCPF(cad.value.cpf)) e.cpf = 'CPF inválido'
  if (tipoKit.value === 'previdenciario' && !cad.value.dataNascimento) e.dataNascimento = 'Campo obrigatório para kit previdenciário'
  if (!cad.value.genero) e.genero = 'Campo obrigatório'
  if (!cad.value.nacionalidadeTipo) e.nacionalidadeTipo = 'Campo obrigatório'
  if (cad.value.nacionalidadeTipo === 'outro' && !cad.value.nacionalidade?.trim()) e.nacionalidade = 'Campo obrigatório'
  if (cad.value.estadoCivilTipo === 'outro' && !cad.value.estadoCivil?.trim()) e.estadoCivil = 'Campo obrigatório'
  if (cad.value.profissaoTipo === 'outro' && !cad.value.profissao?.trim()) e.profissao = 'Campo obrigatório'

  // Condição: analfabeto (apenas rogado é obrigatório, testemunhas são opcionais)
  if (isAnalfabeto.value) {
    if (!cad.value.rogadoNome?.trim()) e.rogadoNome = 'Campo obrigatório'
    if (!cad.value.rogadoCpf?.trim()) e.rogadoCpf = 'Campo obrigatório'
  }

  // Condição: incapaz / criança
  if (needsResponsavel.value) {
    if (!cad.value.responsavelLegalNome?.trim()) e.responsavelLegalNome = 'Campo obrigatório'
    if (!cad.value.responsavelLegalCpf?.trim()) e.responsavelLegalCpf = 'Campo obrigatório'
  }

  // Endereço
  if (!cad.value.rua?.trim()) e.rua = 'Campo obrigatório'
  if (!cad.value.numero?.trim()) e.numero = 'Campo obrigatório'
  if (!cad.value.bairro?.trim()) e.bairro = 'Campo obrigatório'
  if (!cad.value.cidade?.trim()) e.cidade = 'Campo obrigatório'
  if (!cad.value.estado) e.estado = 'Campo obrigatório'
  if (!cad.value.cep?.trim()) e.cep = 'Campo obrigatório'

  // Comprovante
  if (!cad.value.comprovanteNomeCliente) e.comprovanteNomeCliente = 'Campo obrigatório'
  if (comprovanteNaoCliente.value) {
    if (!cad.value.responsavelImovelNome?.trim()) e.responsavelImovelNome = 'Campo obrigatório'
    if (!cad.value.responsavelImovelCpf?.trim()) e.responsavelImovelCpf = 'Campo obrigatório'
  }

  // Hipossuficiência (não exigida em kit previdenciário)
  if (tipoKit.value !== 'previdenciario') {
    if (cad.value.possuiImoveis === null) e.possuiImoveis = 'Campo obrigatório'
    if (cad.value.possuiMoveis === null) e.possuiMoveis = 'Campo obrigatório'
    if (cad.value.isentoIrpf === null) e.isentoIrpf = 'Campo obrigatório'
  }

  // Contato — valida cada telefone do array
  cad.value.telefones.forEach((t, i) => {
    const idx = String(i)
    if (!t.numero?.trim()) e[`telefone_${idx}`] = 'Campo obrigatório'
    if (!t.titularContato) e[`titularContato_${idx}`] = 'Campo obrigatório'
    if (t.titularContato === 'nao') {
      if (!t.nomeTitularNumero?.trim()) e[`nomeTitularNumero_${idx}`] = 'Campo obrigatório'
      if (!t.relacaoTitularTipo) e[`relacaoTitularTipo_${idx}`] = 'Campo obrigatório'
      if (t.relacaoTitularTipo === 'outro' && !t.relacaoTitular?.trim()) e[`relacaoTitular_${idx}`] = 'Campo obrigatório'
    }
  })

  errors.value = e
  return Object.keys(e).length === 0
}

function validateAcoes (): boolean {
  if (acoes.value.length === 0) return false
  const errs: Record<number, Record<string, string>> = {}
  acoes.value.forEach((acao, i) => {
    const e: Record<string, string> = {}
    if (!acao.tipoAcao) e.tipoAcao = 'Campo obrigatório'
    if (acao.nomeBanco === 'Outro' && !acao.bancoOutro?.trim()) e.bancoOutro = 'Campo obrigatório'
    if (acaoNeedsContrato(acao.tipoAcao) && !acao.numeroContrato?.trim()) e.numeroContrato = 'Campo obrigatório'
    if (acao.tipoAcao === 'tarifa_bancaria' && !acao.tarifaQuestionada) e.tarifaQuestionada = 'Campo obrigatório'
    if (acao.tipoAcao === 'tarifa_bancaria' && acao.tarifaQuestionada === 'OUTROS' && !acao.tarifaQuestionadaOutro?.trim()) e.tarifaQuestionadaOutro = 'Campo obrigatório'
    if (acao.tipoAcao === 'seguro_nao_autorizado' && !acao.tipoSeguro?.trim()) e.tipoSeguro = 'Campo obrigatório'
    if (acao.tipoAcao === 'contribuicao_sindical_nao_autorizada' && tipoKit.value === 'marketing' && !acao.tipoContribuicao?.trim()) e.tipoContribuicao = 'Campo obrigatório'
    if (Object.keys(e).length > 0) errs[i] = e
  })
  acoesErrors.value = errs
  return Object.keys(errs).length === 0
}

const podeAvancar = computed(() => {
  if (etapaAtual.value === 'cliente') {
    if (!clienteEncontrado.value && !isEditMode.value) return false
    return validateCadastroSilent()
  }
  if (etapaAtual.value === 'acoes') return acoes.value.length > 0
  if (etapaAtual.value === 'advogados') return !advogadosLoading.value
  return false
})

function validateCadastroSilent (): boolean {
  // Validação leve sem setar erros — para habilitar/desabilitar botão
  return !!(
    cad.value.nome?.trim() &&
    cad.value.cpf?.trim() &&
    cad.value.genero &&
    cad.value.nacionalidadeTipo &&
    (cad.value.nacionalidadeTipo !== 'outro' || cad.value.nacionalidade?.trim()) &&
    (cad.value.estadoCivilTipo !== 'outro' || cad.value.estadoCivil?.trim()) &&
    (cad.value.profissaoTipo !== 'outro' || cad.value.profissao?.trim()) &&
    (!isAnalfabeto.value || (cad.value.rogadoNome?.trim() && cad.value.rogadoCpf?.trim())) &&
    (!needsResponsavel.value || (cad.value.responsavelLegalNome?.trim() && cad.value.responsavelLegalCpf?.trim())) &&
    cad.value.rua?.trim() &&
    cad.value.numero?.trim() &&
    cad.value.bairro?.trim() &&
    cad.value.cidade?.trim() &&
    cad.value.estado &&
    cad.value.cep?.trim() &&
    cad.value.comprovanteNomeCliente &&
    (!comprovanteNaoCliente.value || (cad.value.responsavelImovelNome?.trim() && cad.value.responsavelImovelCpf?.trim())) &&
    (tipoKit.value === 'previdenciario' || (cad.value.possuiImoveis !== null && cad.value.possuiMoveis !== null && cad.value.isentoIrpf !== null)) &&
    cad.value.telefones.every(t =>
      t.numero?.trim()
      && t.titularContato
      && (t.titularContato !== 'nao' || (t.nomeTitularNumero?.trim() && t.relacaoTitularTipo))
      && (t.relacaoTitularTipo !== 'outro' || t.relacaoTitular?.trim())
    )
  )
}

// ── Kit Final: Preview de documentos via PDF (LibreOffice no backend) ──
const templatesStore = useTemplatesStore()

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Templates do kit — keyword para match no nome do template no banco
// Bancário: "Kit Contrato", "Kit Procuração", etc.
// Previdenciário: "Kit Contrato Previdenciario", "Kit Procuração Previdenciário", etc.
// Marketing: "Kit Contrato Marketing", "Kit Procuração Marketing", etc.
const KIT_TEMPLATE_DEFS_BANCARIO = [
  { key: 'contrato', label: 'Contrato', keyword: 'kit contrato' },
  { key: 'procuracao', label: 'Procuração', keyword: 'kit procuracao' },
  { key: 'hipossuficiencia', label: 'Decl. Hipossuficiência', keyword: 'kit hipossuficiencia' },
  { key: 'ciencia', label: 'Decl. Ciência', keyword: 'kit ciencia' },
  { key: 'domicilio', label: 'Decl. Domicílio', keyword: 'kit domicilio' },
]

const KIT_TEMPLATE_DEFS_PREVIDENCIARIO = [
  { key: 'contrato', label: 'Contrato', keyword: 'kit contrato previdenciario' },
  { key: 'procuracao', label: 'Procuração', keyword: 'kit procuracao previdenciario' },
  { key: 'hipossuficiencia', label: 'Decl. Hipossuficiência', keyword: 'kit hipossuficiencia previdenciario' },
  { key: 'domicilio', label: 'Decl. Domicílio', keyword: 'kit domicilio previdenciario' },
]

const KIT_TEMPLATE_DEFS_MARKETING = [
  { key: 'contrato', label: 'Contrato', keyword: 'kit contrato marketing' },
  { key: 'procuracao', label: 'Procuração', keyword: 'kit procuracao marketing' },
  { key: 'hipossuficiencia', label: 'Decl. Hipossuficiência', keyword: 'kit hipossuficiencia marketing' },
  { key: 'ciencia', label: 'Decl. Ciência', keyword: 'kit ciencia marketing' },
]

// Mapeamento resolvido: key → template id (preenchido no mount)
const resolvedTemplates = ref<{ id: number; key: string; label: string }[]>([])
const procuracaoTemplateId = computed(() => resolvedTemplates.value.find(t => t.key === 'procuracao')?.id ?? 0)

function normalize (s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function nameMatchesKeyword (name: string, keyword: string): boolean {
  const words = keyword.split(/\s+/)
  return words.every(w => name.includes(w))
}

async function resolveKitTemplates () {
  const allTemplates = await templatesStore.fetchAll({ active: true })
  const resolved: typeof resolvedTemplates.value = []
  const tipo = tipoKit.value
  const defs = tipo === 'previdenciario'
    ? KIT_TEMPLATE_DEFS_PREVIDENCIARIO
    : tipo === 'marketing'
      ? KIT_TEMPLATE_DEFS_MARKETING
      : KIT_TEMPLATE_DEFS_BANCARIO

  for (const def of defs) {
    const kw = normalize(def.keyword)
    const match = allTemplates.find(t => {
      const name = normalize(t.name)
      if (!nameMatchesKeyword(name, kw)) return false
      // Bancário usa keywords genéricos (ex.: "kit contrato"); precisa excluir
      // nomes que pertencem a outros tipos para não pegar templates errados.
      if (tipo === 'bancario' && (name.includes('previdenciario') || name.includes('marketing'))) return false
      if (tipo === 'previdenciario' && name.includes('marketing')) return false
      return true
    })
    if (match) {
      resolved.push({ id: match.id, key: def.key, label: def.label })
    }
  }
  resolvedTemplates.value = resolved
}

// Computed: templates fixos visíveis (domicílio só se comprovante não no nome)
const kitTemplatesVisiveis = computed(() => {
  return resolvedTemplates.value.filter(t => {
    if (t.key === 'domicilio' && cad.value.comprovanteNomeCliente !== 'nao') return false
    return true
  })
})

const docTab = ref('contrato')
const pdfBlobs = ref<Record<string, Blob>>({})
const docxBlobs = ref<Record<string, Blob>>({})
const pdfBlobUrls = ref<Record<string, string>>({})
const procuracaoActionDocxBlobs = ref<Blob[] | null>(null)
const docLoading = ref<Record<string, boolean>>({})
const iframeLoading = ref<Record<string, boolean>>({})
const docErrors = ref<Record<string, string>>({})
const docxContainers = ref<Record<string, HTMLElement | null>>({})


const advogadosStore = useAdvogadosStore()

// ──────────────────────────────────────────────────────────────────────────
// Etapa: Advogados (kanban Disponíveis ↔ Selecionados + snapshot no kit)
// ──────────────────────────────────────────────────────────────────────────
// As listas abaixo são fontes de verdade reais (não computed): o
// vuedraggable precisa mutá-las diretamente ao arrastar.
type AdvForKanban = Advogado | AdvogadoSnapshot
const advogadosSelecionados = ref<AdvForKanban[]>([])
const advogadosDisponiveis = ref<AdvForKanban[]>([])
const advogadosSnapshot = ref<AdvogadoSnapshot[]>([])
const advogadosWarnings = ref<string[]>([])
const advogadosBusca = ref('')
const advogadosLoading = ref(false)
const advogadosSavingNext = ref(false)
const advogadosUfNoUltimoLoad = ref<string>('')
const trocaUfDialog = ref(false)
const advogadosTabMobile = ref<'selecionados' | 'disponiveis'>('disponiveis')

const { smAndDown: advsKanbanMobile } = useDisplay()

const advogadosTodos = computed(() => advogadosStore.items)

function ordenarAdvs<T extends { is_socio: boolean; nome_completo: string }> (arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    if (a.is_socio !== b.is_socio) return a.is_socio ? -1 : 1
    return a.nome_completo.localeCompare(b.nome_completo)
  })
}

function advMatchesBusca (adv: AdvForKanban, q: string): boolean {
  if (!q) return true
  const nome = (adv.nome_completo || '').toLowerCase()
  const escr = (adv.escritorio_nome || '').toLowerCase()
  if (nome.includes(q) || escr.includes(q)) return true
  const oabs = (adv as any).oabs as Array<{ uf: string; numero_oab: string }> | undefined
  if (oabs && oabs.some(o => `${o.uf} ${o.numero_oab}`.toLowerCase().includes(q))) return true
  const numeroOab = (adv as AdvogadoSnapshot).numero_oab
  const uf = (adv as AdvogadoSnapshot).oab_uf
  if (numeroOab && `${uf || ''} ${numeroOab}`.toLowerCase().includes(q)) return true
  return false
}

function advCardVisivel (adv: AdvForKanban): boolean {
  return advMatchesBusca(adv, advogadosBusca.value.trim().toLowerCase())
}

/** Texto da OAB a exibir no card. Cascata: UF do cliente → SC → primeira → vazio. */
function getOabExibida (adv: AdvForKanban): { texto: string; fallback: boolean } {
  const uf = (cad.value.estado || '').toUpperCase()

  // Snapshot já vem com OAB resolvida pelo backend.
  const snap = adv as AdvogadoSnapshot
  if (snap.numero_oab) {
    return {
      texto: `${snap.oab_uf || '—'}: ${snap.numero_oab}`,
      fallback: snap.oab_fonte !== 'uf_cliente',
    }
  }

  // Advogado da store: aplica cascata local pra exibição.
  const oabs = (adv as any).oabs as Array<{ uf: string; numero_oab: string }> | undefined
  if (!oabs || oabs.length === 0) {
    return { texto: 'Sem OAB cadastrada', fallback: false }
  }
  const naUf = uf ? oabs.find(o => o.uf.toUpperCase() === uf) : null
  if (naUf) return { texto: `${naUf.uf}: ${naUf.numero_oab}`, fallback: false }
  const sc = oabs.find(o => o.uf.toUpperCase() === 'SC')
  if (sc) return { texto: `${sc.uf}: ${sc.numero_oab}`, fallback: true }
  const primeira = oabs[0]
  return { texto: `${primeira.uf}: ${primeira.numero_oab}`, fallback: true }
}

async function hidratarEtapaAdvogados () {
  advogadosLoading.value = true
  try {
    // Sempre força refresh — a store é persistida em localStorage e pode
    // estar com dados velhos (ex.: sem oabs[] de versões antigas do backend).
    await advogadosStore.fetchList()

    if (!kitId.value) {
      advogadosSelecionados.value = []
      advogadosDisponiveis.value = ordenarAdvs(advogadosTodos.value)
      advogadosSnapshot.value = []
      return
    }

    // 1) Já tem snapshot salvo? usa ele.
    const snapResp = await getAdvogadosSnapshot(kitId.value)
    if (snapResp.advogados_snapshot.length > 0) {
      const idsSel = new Set(snapResp.advogados_snapshot.map(a => a.id))
      advogadosSnapshot.value = snapResp.advogados_snapshot
      advogadosSelecionados.value = ordenarAdvs(snapResp.advogados_snapshot)
      advogadosDisponiveis.value = ordenarAdvs(
        advogadosTodos.value.filter(a => !idsSel.has(a.id)),
      )
      advogadosUfNoUltimoLoad.value = (cad.value.estado || '').toUpperCase()
      return
    }

    // 2) Sem snapshot → pré-seleção pelo backend.
    const sug = await getAdvogadosSugeridos(kitId.value)
    const idsSel = new Set(sug.advogados_ids)
    advogadosSelecionados.value = ordenarAdvs(
      advogadosTodos.value.filter(a => idsSel.has(a.id)),
    )
    advogadosDisponiveis.value = ordenarAdvs(
      advogadosTodos.value.filter(a => !idsSel.has(a.id)),
    )
    advogadosSnapshot.value = []
    advogadosUfNoUltimoLoad.value = sug.uf_cliente || (cad.value.estado || '').toUpperCase()
  } catch (e: any) {
    showError('Não foi possível carregar advogados.')
    console.error(e)
  } finally {
    advogadosLoading.value = false
  }
}

// Move um advogado entre as colunas (usado pelos botões +/−).
function adicionarAdvogado (id: number) {
  const idx = advogadosDisponiveis.value.findIndex(a => a.id === id)
  if (idx < 0) return
  const [adv] = advogadosDisponiveis.value.splice(idx, 1)
  advogadosSelecionados.value = ordenarAdvs([...advogadosSelecionados.value, adv])
}

function removerAdvogado (id: number) {
  const idx = advogadosSelecionados.value.findIndex(a => a.id === id)
  if (idx < 0) return
  const [adv] = advogadosSelecionados.value.splice(idx, 1)
  advogadosDisponiveis.value = ordenarAdvs([...advogadosDisponiveis.value, adv])
}

// Após cada drag, reordena as duas colunas (sócios primeiro, alfabético).
function onAdvDragEnd () {
  advogadosSelecionados.value = ordenarAdvs(advogadosSelecionados.value)
  advogadosDisponiveis.value = ordenarAdvs(advogadosDisponiveis.value)
}

async function salvarAdvogadosESeguir () {
  if (!kitId.value) {
    showError('Salve o cliente primeiro para definir os advogados.')
    return
  }
  advogadosSavingNext.value = true
  try {
    const ids = advogadosSelecionados.value.map(a => a.id)
    const res = await saveAdvogadosSnapshot(kitId.value, ids)
    advogadosSnapshot.value = res.advogados_snapshot
    advogadosWarnings.value = res.warnings || []
    advogadosUfNoUltimoLoad.value = (cad.value.estado || '').toUpperCase()
    if (advogadosWarnings.value.length === 0) {
      showSuccess('Advogados salvos.')
    }
    irParaEtapa('kit-final')
  } catch (e: any) {
    showError(friendlyError(e, 'kits', 'update'))
  } finally {
    advogadosSavingNext.value = false
  }
}

// Reset do snapshot (volta pra cálculo automático) quando o operador
// confirma o recálculo após mudança de UF.
async function recalcularAdvogadosPorMudancaUf () {
  trocaUfDialog.value = false
  if (!kitId.value) return
  try {
    await saveAdvogadosSnapshot(kitId.value, [])
    advogadosSnapshot.value = []
    await hidratarEtapaAdvogados()
    showSuccess('Advogados recalculados pela nova UF.')
  } catch (e: any) {
    showError(friendlyError(e, 'kits', 'update'))
  }
}

// Hidrata a etapa de Advogados sempre que o operador entra nela.
watch(etapaAtual, novaEtapa => {
  if (novaEtapa === 'advogados') {
    hidratarEtapaAdvogados()
  }
})

// Detecta mudança de UF e abre modal se já existir snapshot.
watch(() => cad.value.estado, async (novaUf, ufAnterior) => {
  if (!novaUf || !ufAnterior) return
  if (novaUf.toUpperCase() === ufAnterior.toUpperCase()) return
  if (!kitId.value || !advogadosSnapshot.value.length) return
  trocaUfDialog.value = true
})

// Helpers de etapa (ir para próxima/anterior)
function irParaEtapa (e: KitEtapa) {
  etapaAtual.value = e
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Formatadores para documentos
function fmtCPF (v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length !== 11) return v || ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function fmtCEP (v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8)
  if (d.length !== 8) return v || ''
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function advogadoInscrito (genero?: string) {
  return genero === 'feminino' ? 'inscrita' : 'inscrito'
}

function qualificarAdvogado (a: { nome_completo: string, nacionalidade: string, estado_civil: string, genero?: string, numero_oab: string, escritorio_nome?: string, escritorio_cnpj?: string }) {
  let texto = `${a.nome_completo}, ${a.nacionalidade}, ${a.estado_civil}, advogado, ${advogadoInscrito(a.genero)} na ${a.numero_oab}`
  if (a.escritorio_nome) {
    texto += `, neste ato representando o escritório ${a.escritorio_nome}, pessoa jurídica de direito privado, inscrito no CNPJ sob o nº ${a.escritorio_cnpj}`
  }
  return texto
}

function advogadoAtuaNoKit (
  tiposAcaoAdvogado: string[] | undefined,
  tiposAcaoSelecionados: Set<string>,
): boolean {
  // Sem configuração ou marcador 'todas' => atua em qualquer kit
  if (!tiposAcaoAdvogado || tiposAcaoAdvogado.length === 0) return true
  if (tiposAcaoAdvogado.includes('todas')) return true
  // Caso contrário, precisa ter pelo menos uma sobreposição com os tipos do kit
  return tiposAcaoAdvogado.some(t => tiposAcaoSelecionados.has(t))
}

async function montarContexto (): Promise<Record<string, any>> {
  const c = cad.value
  const isMasc = c.genero === 'masculino'

  // Flexão de gênero
  const inscrito = isMasc ? 'inscrito' : 'inscrita'
  const domiciliado = isMasc ? 'domiciliado' : 'domiciliada'
  const contratado = isMasc ? 'contratado' : 'contratada'

  const nacionalidade = c.nacionalidadeTipo === 'brasileiro'
    ? (isMasc ? 'brasileiro' : 'brasileira')
    : c.nacionalidade || ''

  const estadoCivilMap: Record<string, string> = {
    solteiro: isMasc ? 'solteiro' : 'solteira',
    casado: isMasc ? 'casado' : 'casada',
    divorciado: isMasc ? 'divorciado' : 'divorciada',
    viuvo: isMasc ? 'viúvo' : 'viúva',
    uniao_estavel: 'em união estável',
  }
  const estado_civil = c.estadoCivilTipo === 'outro'
    ? c.estadoCivil
    : (estadoCivilMap[c.estadoCivilTipo] || c.estadoCivilTipo)

  const profissaoMap: Record<string, string> = {
    aposentado: isMasc ? 'aposentado' : 'aposentada',
    pensionista: 'pensionista',
  }
  const profissao = c.profissaoTipo === 'outro'
    ? c.profissao
    : (profissaoMap[c.profissaoTipo] || c.profissaoTipo)

  const numeroEndereco = (c.numero || '').trim()
  const numeroFormatado = numeroEndereco && /^s\s*\/?\s*n$/i.test(numeroEndereco)
    ? numeroEndereco
    : (numeroEndereco ? `nº ${numeroEndereco}` : '')

  const enderecoParts = [
    c.rua,
    numeroFormatado,
    c.complemento,
    c.bairro,
  ].filter(Boolean).join(', ')
  const endereco = `${enderecoParts}, ${c.cidade}/${c.estado}, CEP ${fmtCEP(c.cep)}`

  const d = new Date()
  const local_data = `${c.cidade}/${c.estado}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

  // Bancos (com substituição pela abreviação da associação em contribuição sindical bancária)
  const bancoNomes = Array.from(new Set(
    acoes.value
      .map(a => {
        if (
          a.tipoAcao === 'contribuicao_sindical_nao_autorizada'
          && tipoKit.value === 'bancario'
          && a.associacaoId != null
        ) {
          const assoc = associacoesOptions.value.find(x => x.id === a.associacaoId)
          if (assoc) return (assoc.abreviacao || assoc.nome).toUpperCase().trim()
        }
        return (a.nomeBanco === 'Outro' ? a.bancoOutro : a.nomeBanco).toUpperCase().trim()
      })
      .filter(Boolean),
  ))
  const bancosBase = bancoNomes.length <= 1
    ? (bancoNomes[0] || '(BANCOS DA AÇÃO)')
    : bancoNomes.slice(0, -1).join(', ') + ' e ' + bancoNomes[bancoNomes.length - 1]
  // Para kit bancário, anexa o INSS ao final das instituições.
  // Exceção: clientes do Amazonas (AM) — não anexa o INSS nem no contrato.
  const clienteAM = c.estado?.toUpperCase() === 'AM'
  const bancos = tipoKit.value === 'bancario' && bancoNomes.length > 0 && !clienteAM
    ? (bancoNomes.length === 1
        ? `${bancoNomes[0]} e INSS – Instituto Nacional do Seguro Social`
        : `${bancoNomes.join(', ')} e INSS – Instituto Nacional do Seguro Social`)
    : bancosBase

  // Tipos de ação
  const tipoLabels = acoes.value.map(a => TIPOS_ACAO.find(t => t.value === a.tipoAcao)?.label || a.tipoAcao)
  const tiposAcaoSelecionados = new Set(acoes.value.map(a => a.tipoAcao).filter(Boolean))
  const tipos_acao = tipoLabels.length <= 1
    ? (tipoLabels[0] || '')
    : tipoLabels.slice(0, -1).join(', ') + ' e ' + tipoLabels[tipoLabels.length - 1]
  const tarifasQuestionadasList = acoes.value
    .filter(a => a.tipoAcao === 'tarifa_bancaria' && a.tarifaQuestionada)
    .map(resolveTarifaQuestionada)
    .filter(Boolean)
  const tarifas_questionadas = tarifasQuestionadasList.length <= 1
    ? (tarifasQuestionadasList[0] || '')
    : tarifasQuestionadasList.slice(0, -1).join(', ') + ' e ' + tarifasQuestionadasList[tarifasQuestionadasList.length - 1]

  // ── Advogados ──
  // Se o kit tem snapshot da etapa de Advogados, usa ele.
  // Senão (kit antigo, ou operador não passou pela etapa), fallback automático
  // por UF como antes.
  let oab_estado = '(OAB REFERENTE AO ESTADO DA AÇÃO)'
  let advogados_estado = ''
  let contratados_socios = ''
  let unidade_apoio = ''
  let socio1_oab = '(OAB REFERENTE AO ESTADO DA AÇÃO)'
  let socio2_oab = '(OAB REFERENTE AO ESTADO DA AÇÃO)'
  let oab_tiago = '(OAB REFERENTE AO ESTADO DA AÇÃO)'
  let oab_eduardo = '(OAB REFERENTE AO ESTADO DA AÇÃO)'

  const uf = c.estado?.toUpperCase()

  // Tenta snapshot do kit primeiro.
  let snapshotAdvs: AdvogadoSnapshot[] = []
  if (kitId.value && advogadosSnapshot.value.length > 0) {
    snapshotAdvs = advogadosSnapshot.value
  } else if (kitId.value) {
    try {
      const resp = await getAdvogadosSnapshot(kitId.value)
      snapshotAdvs = resp.advogados_snapshot || []
      if (snapshotAdvs.length) advogadosSnapshot.value = snapshotAdvs
    } catch (err) {
      console.warn('Falha ao buscar snapshot de advogados:', err)
    }
  }

  type AdvForFormat = {
    nome_completo: string
    nacionalidade: string
    estado_civil: string
    genero?: string
    is_socio: boolean
    numero_oab: string
    oab_fonte?: string
    escritorio_nome?: string
    escritorio_cnpj?: string
    unidade_apoio_nome?: string
    unidade_apoio_endereco?: string
  }

  let socios: AdvForFormat[] = []
  let naoSocios: AdvForFormat[] = []
  let advsTodos: AdvForFormat[] = []

  if (snapshotAdvs.length > 0) {
    advsTodos = snapshotAdvs
    socios = snapshotAdvs.filter(a => a.is_socio)
    naoSocios = snapshotAdvs.filter(a => !a.is_socio)
  } else if (uf) {
    try {
      const advs = await advogadosStore.fetchPorUf(uf)
      advsTodos = advs as AdvForFormat[]
      socios = (advs as AdvForFormat[])
        .filter(a => a.is_socio)
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
      naoSocios = (advs as any[])
        .filter(a => !a.is_socio && advogadoAtuaNoKit(a.tipos_acao, tiposAcaoSelecionados))
    } catch (err) {
      console.warn('Falha ao buscar advogados para UF', uf, err)
    }
  }

  if (socios.length > 0) {
    oab_estado = socios.map(s => s.numero_oab).filter(Boolean).join(' e ') || oab_estado
    contratados_socios = socios.map(qualificarAdvogado).join(' e ')
    socio1_oab = socios[0]?.numero_oab || socio1_oab
    socio2_oab = socios[1]?.numero_oab || socio2_oab

    const tiago = socios.find(s => normalize(s.nome_completo).includes('tiago'))
    const eduardo = socios.find(s => normalize(s.nome_completo).includes('eduardo'))
    if (tiago?.numero_oab) oab_tiago = tiago.numero_oab
    if (eduardo?.numero_oab) oab_eduardo = eduardo.numero_oab
  }

  if (naoSocios.length > 0) {
    advogados_estado = naoSocios.map(qualificarAdvogado).join('; e ')
  }

  // A unidade de apoio deve corresponder ao estado da ação (UF do cliente):
  // só usa a unidade de um advogado cuja OAB foi resolvida pela UF do cliente
  // (oab_fonte === 'uf_cliente'), nunca por fallback (SC ou 1ª cadastrada).
  const comUnidade = advsTodos.find(
    a => a.oab_fonte === 'uf_cliente' && a.unidade_apoio_nome && a.unidade_apoio_endereco,
  )
  if (comUnidade) {
    unidade_apoio = `, unidade de apoio administrativo na ${comUnidade.unidade_apoio_endereco}`
  }

  // Bloco assinatura
  let bloco_assinatura = '_________________________________________________\nASSINANTE'
  if (c.condicaoCliente === 'analfabeto') {
    bloco_assinatura = `QUANDO ANALFABETO:\n\n_________________________________________________\nDeclarante/Rogado\n\n_________________________________________________\nTestemunha 1 Nome/CPF: ${c.testemunha1Nome} / ${c.testemunha1Cpf}\n\n_________________________________________________\nTestemunha 2 Nome/CPF: ${c.testemunha2Nome} / ${c.testemunha2Cpf}`
  } else if (c.condicaoCliente === 'incapaz' || c.condicaoCliente === 'crianca_adolescente') {
    const label = c.condicaoCliente === 'crianca_adolescente' ? 'Responsável Legal (Criança/Adolescente)' : 'Responsável Legal (Incapaz)'
    bloco_assinatura = `_________________________________________________\n${label} - ${c.responsavelLegalNome} - CPF: ${c.responsavelLegalCpf}`
  }

  // Hipossuficiência
  const imoveis_sim_nao = c.possuiImoveis ? '( X ) SIM    (   ) NÃO' : '(   ) SIM    ( X ) NÃO'
  const moveis_sim_nao = c.possuiMoveis ? '( X ) SIM    (   ) NÃO' : '(   ) SIM    ( X ) NÃO'
  const irpf_sim_nao = c.isentoIrpf ? '( X ) SIM    (   ) NÃO' : '(   ) SIM    ( X ) NÃO'

  // Domicílio assinatura
  let bloco_assinatura_domicilio = bloco_assinatura
  if (c.condicaoCliente === 'analfabeto') {
    bloco_assinatura_domicilio = `QUANDO ANALFABETO:\n\n__________________________________________________\nDeclarante/titular do comprovante de endereço\n\n__________________________________________________\nAssinatura do rogado\n\nTESTEMUNHA: ${c.testemunha1Nome} CPF: ${c.testemunha1Cpf}\nTESTEMUNHA: ${c.testemunha2Nome} CPF: ${c.testemunha2Cpf}`
  }

  // Monta o texto de telefones separando em dois grupos:
  // (a) próprios do cliente — listados juntos: "X, Y e Z, pertencente(s) ao cliente"
  // (b) terceiros — cada um com sua descrição: "X, pertencente à NOME, relação do cliente"
  // Sem ponto final — o template já adiciona pontuação depois de {{ telefone }}.
  const telefone_final = (() => {
    const validos = c.telefones.filter(t => t.numero?.trim())
    if (validos.length === 0) return ''

    const terceiros = validos.filter(t =>
      t.titularContato === 'nao'
      && t.nomeTitularNumero?.trim()
      && formatarRelacaoTitular(t),
    )
    const proprios = validos.filter(t => !terceiros.includes(t))

    function juntar (items: string[]): string {
      if (items.length === 0) return ''
      if (items.length === 1) return items[0]
      if (items.length === 2) return `${items[0]} e ${items[1]}`
      return items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1]
    }

    const partes: string[] = []
    if (proprios.length > 0) {
      const sufixo = proprios.length === 1 ? 'pertencente' : 'pertencentes'
      partes.push(`${juntar(proprios.map(t => t.numero))}, ${sufixo} ao cliente`)
    }
    for (const t of terceiros) {
      const relacao = formatarRelacaoTitular(t)
      partes.push(`${t.numero}, pertencente à ${t.nomeTitularNumero.trim()}, ${relacao} ${isMasc ? 'do' : 'da'} cliente`)
    }
    return juntar(partes)
  })()

  return {
    nome_cliente: c.nome.toUpperCase(),
    nacionalidade,
    data_nascimento: c.dataNascimento ? new Date(c.dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '',
    estado_civil,
    profissao,
    cpf_cliente: fmtCPF(c.cpf),
    endereco,
    telefone: telefone_final,
    inscrito,
    domiciliado,
    contratado,
    o_contratante: isMasc ? 'O' : 'A',
    pelo: isMasc ? 'pelo' : 'pela',
    ao: isMasc ? 'ao' : 'à',
    do: isMasc ? 'do' : 'da',
    no: isMasc ? 'no' : 'na',
    informado: isMasc ? 'informado' : 'informada',
    impossibilitado: isMasc ? 'impossibilitado' : 'impossibilitada',
    oab_estado,
    socio1_oab,
    socio2_oab,
    oab_tiago,
    oab_eduardo,
    unidade_apoio,
    contratados_socios,
    advogados_estado,
    bancos,
    tipos_acao,
    tarifa_questionada: tarifasQuestionadasList[0] || '',
    tarifas_questionadas,
    instituicao_re: bancos,
    imoveis_sim_nao,
    moveis_sim_nao,
    irpf_sim_nao,
    local_data,
    bloco_assinatura,
    responsavel_imovel_nome: c.responsavelImovelNome,
    responsavel_imovel_cpf: fmtCPF(c.responsavelImovelCpf),
    bloco_assinatura_domicilio,
    // Dados para condicional de analfabeto nos templates
    condicao_cliente: c.condicaoCliente,
    rogado_nome: c.rogadoNome,
    rogado_cpf: fmtCPF(c.rogadoCpf),
    testemunha1_nome: c.testemunha1Nome,
    testemunha1_cpf: fmtCPF(c.testemunha1Cpf),
    testemunha2_nome: c.testemunha2Nome,
    testemunha2_cpf: fmtCPF(c.testemunha2Cpf),
    responsavel_legal_nome: c.responsavelLegalNome,
    responsavel_legal_cpf: fmtCPF(c.responsavelLegalCpf),
    // Cláusula de porcentagem com snapshot no kit. Resolve no backend
    // (variação por UF do cliente ou cai no padrão). Vazio se kit ainda
    // não foi salvo — fluxo só renderiza depois que o kit tem id.
    clausula_porcentagem: await resolverClausulaPorcentagem(),
  }
}

/** Congela e retorna o texto da cláusula de porcentagem para este kit. */
async function resolverClausulaPorcentagem (): Promise<string> {
  if (!kitId.value) return ''
  try {
    const res = await snapshotKit(kitId.value, true)
    return res.texto || ''
  } catch (err) {
    console.warn('Falha ao resolver cláusula de porcentagem:', err)
    return ''
  }
}

/** Nome do cliente seguro para nome de arquivo (sem acentos, só letras/números/_). */
function sanitizeNomeArquivo (nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
  return base || 'cliente'
}

function nomeClienteArquivo (): string {
  const raw = (cad.value.nome || clienteNome.value || 'cliente').trim()
  return sanitizeNomeArquivo(raw)
}

/** Base sem extensão: contrato_Nome, procuracao_Nome (um único doc com todas as ações), kit_completo_Nome */
function baseNomeDownloadDoc (key: string): string {
  const slug = nomeClienteArquivo()
  return `${key}_${slug}`
}

function baseNomeKitCompleto (): string {
  return `kit_completo_${nomeClienteArquivo()}`
}

// ── Docs fixos ──

async function fetchDocBlob (templateId: number, key: string) {
  if (!templateId) {
    docErrors.value[key] = '__NOT_FOUND__'
    return
  }

  // Procuração bancária tem lógica especial: uma página por ação
  // Procuração previdenciária é documento único (sem ações)
  if (key === 'procuracao' && tipoKit.value !== 'previdenciario') {
    await fetchProcuracaoMultipla()
    return
  }

  docLoading.value[key] = true
  docErrors.value[key] = ''
  // Invalida caches do .docx — o preview foi regerado, downloads não devem servir versão velha
  delete docxBlobs.value[key]
  try {
    const context = await montarContexto()
    const result = await templatesStore.renderPdf(templateId, {
      context,
      filename: baseNomeDownloadDoc(key),
    })
    pdfBlobs.value[key] = result.blob
  } catch (e: any) {
    console.error(`Erro ao gerar doc ${key}:`, e)
    if (e?.response?.status === 404) {
      docErrors.value[key] = '__NOT_FOUND__'
    } else {
      const msg = e?.response?.data?.detail || e?.message || 'Erro desconhecido'
      docErrors.value[key] = `Não foi possível gerar o documento: ${msg}`
    }
  } finally {
    docLoading.value[key] = false
  }
}

function renderBlobToEl (blob: Blob, container: HTMLElement, key: string) {
  // Revoga URL anterior do mesmo key para não vazar memória
  const prev = pdfBlobUrls.value[key]
  if (prev) URL.revokeObjectURL(prev)

  const url = URL.createObjectURL(blob)
  pdfBlobUrls.value[key] = url

  container.innerHTML = ''
  const iframe = document.createElement('iframe')
  // Parâmetros do leitor PDF do Chrome: oculta toolbar e ajusta zoom inicial
  iframe.src = `${url}#toolbar=0&navpanes=0&zoom=page-width`
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframeLoading.value[key] = true
  iframe.addEventListener('load', () => {
    iframeLoading.value[key] = false
  }, { once: true })
  container.append(iframe)
}

async function renderBlobToContainer (key: string) {
  const blob = pdfBlobs.value[key]
  if (!blob) return
  await nextTick()
  const container = docxContainers.value[key]
  if (!container) return
  try {
    renderBlobToEl(blob, container, key)
  } catch {
    docErrors.value[key] = 'Não foi possível renderizar a pré-visualização.'
  }
}

async function renderDocTemplate (templateId: number, key: string) {
  await fetchDocBlob(templateId, key)
  await nextTick()
  await nextTick()
  await renderBlobToContainer(key)
}

const docxLoading = ref<Record<string, boolean>>({})
const pdfLoading = ref<Record<string, boolean>>({})
const downloadAllDocLoading = ref(false)
const downloadAllPdfLoading = ref(false)

function triggerBlobDownload (blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Renderiza .docx para um key (lazy). Para procuração multipla, gera N por ação
// e compõe via /compose/. Cacheia em docxBlobs[key].
async function ensureDocxBlob (key: string): Promise<Blob | null> {
  if (docxBlobs.value[key]) return docxBlobs.value[key]
  const tpl = resolvedTemplates.value.find(t => t.key === key)
  if (!tpl) return null

  if (key === 'procuracao' && tipoKit.value !== 'previdenciario') {
    let actionBlobs = procuracaoActionDocxBlobs.value
    if (!actionBlobs || actionBlobs.length !== acoes.value.length) {
      actionBlobs = []
      for (const acao of acoes.value) {
        const ctx = await montarContextoProcuracao(acao)
        const result = await templatesStore.render(tpl.id, {
          context: ctx,
          filename: baseNomeDownloadDoc('procuracao'),
          skipPageNumbering: true,
        })
        actionBlobs.push(result.blob)
      }
      procuracaoActionDocxBlobs.value = actionBlobs
    }
    if (actionBlobs.length === 1) {
      docxBlobs.value[key] = actionBlobs[0]
    } else {
      const fd = new FormData()
      actionBlobs.forEach((b, i) => fd.append('files', b, `proc_${i}.docx`))
      fd.append('skip_page_numbering', 'true')
      const { data } = await api.post('/api/templates/compose/', fd, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      docxBlobs.value[key] = data as Blob
    }
    return docxBlobs.value[key]
  }

  const ctx = await montarContexto()
  const result = await templatesStore.render(tpl.id, {
    context: ctx,
    filename: baseNomeDownloadDoc(key),
  })
  docxBlobs.value[key] = result.blob
  return result.blob
}

async function downloadDoc (key: string) {
  docxLoading.value[key] = true
  try {
    const blob = await ensureDocxBlob(key)
    if (!blob) return
    triggerBlobDownload(blob, `${baseNomeDownloadDoc(key)}.docx`)
  } catch (e: any) {
    console.error('Erro ao baixar .docx:', e)
    showError(e?.response?.data?.detail || e?.message || 'Não foi possível baixar o documento .docx.')
  } finally {
    docxLoading.value[key] = false
  }
}

async function downloadPdf (key: string) {
  const blob = pdfBlobs.value[key]
  if (!blob) return
  triggerBlobDownload(blob, `${baseNomeDownloadDoc(key)}.pdf`)
}

async function ensureVisibleDocxBlobs (): Promise<boolean> {
  for (const template of kitTemplatesVisiveis.value) {
    if (docxBlobs.value[template.key]) continue
    await ensureDocxBlob(template.key)
    if (!docxBlobs.value[template.key]) {
      return false
    }
  }
  return true
}

/**
 * Monta a lista ordenada de .docx (SEM rodapé de paginação) para o PDF
 * completo. A procuração bancária/marketing é expandida: cada ação vira um
 * arquivo próprio, para que cada procuração reinicie sua própria paginação.
 * O backend (per_document_numbering) numera cada arquivo isoladamente.
 */
async function buildDocxFilesForCompletePdf (): Promise<{ blob: Blob; filename: string }[]> {
  const arquivos: { blob: Blob; filename: string }[] = []
  for (const template of kitTemplatesVisiveis.value) {
    const key = template.key
    // Procuração bancária/marketing: uma ação = um documento independente.
    if (key === 'procuracao' && tipoKit.value !== 'previdenciario') {
      if (!procuracaoTemplateId.value) continue
      let i = 0
      for (const acao of acoes.value) {
        const ctx = await montarContextoProcuracao(acao)
        const result = await templatesStore.render(procuracaoTemplateId.value, {
          context: ctx,
          filename: baseNomeDownloadDoc('procuracao'),
          skipPageNumbering: true,
        })
        i += 1
        arquivos.push({ blob: result.blob, filename: `procuracao_${i}.docx` })
      }
      continue
    }
    const ctx = await montarContexto()
    const result = await templatesStore.render(template.id, {
      context: ctx,
      filename: baseNomeDownloadDoc(key),
      skipPageNumbering: true,
    })
    arquivos.push({ blob: result.blob, filename: `${baseNomeDownloadDoc(key)}.docx` })
  }
  return arquivos
}

async function downloadAllPdf () {
  if (kitTemplatesVisiveis.value.length < 2) {
    const [template] = kitTemplatesVisiveis.value
    if (template?.key) {
      await downloadPdf(template.key)
    }
    return
  }

  downloadAllPdfLoading.value = true
  try {
    // Paginação por documento: cada doc (e cada ação da procuração) vai como
    // arquivo próprio, sem rodapé injetado. O backend numera cada um
    // isoladamente ('Página X de Y' ou nada se 1 página) e concatena os PDFs.
    const arquivos = await buildDocxFilesForCompletePdf()
    if (arquivos.length < 2) {
      showError('Não foi possível gerar todos os documentos para montar o PDF único.')
      return
    }

    const fd = new FormData()
    for (const { blob, filename } of arquivos) {
      fd.append('files', blob, filename)
    }
    fd.append('filename', baseNomeKitCompleto())
    fd.append('per_document_numbering', 'true')

    const { data } = await api.post('/api/templates/compose-to-pdf/', fd, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })

    triggerBlobDownload(data as Blob, `${baseNomeKitCompleto()}.pdf`)
    showSuccess('PDF único gerado com sucesso!')
  } catch (e: any) {
    console.error('Erro ao gerar PDF único:', e)
    showError(e?.response?.data?.detail || e?.message || 'Não foi possível gerar o PDF único.')
  } finally {
    downloadAllPdfLoading.value = false
  }
}

async function downloadAllDoc () {
  if (kitTemplatesVisiveis.value.length < 2) {
    const [template] = kitTemplatesVisiveis.value
    if (template?.key) {
      downloadDoc(template.key)
    }
    return
  }

  downloadAllDocLoading.value = true
  try {
    const ready = await ensureVisibleDocxBlobs()
    if (!ready) {
      showError('Não foi possível gerar todos os documentos para montar o DOCX único.')
      return
    }

    const fd = new FormData()
    for (const template of kitTemplatesVisiveis.value) {
      const blob = docxBlobs.value[template.key]
      if (!blob) continue
      fd.append('files', blob, `${baseNomeDownloadDoc(template.key)}.docx`)
    }

    const { data } = await api.post('/api/templates/compose/', fd, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    triggerBlobDownload(data as Blob, `${baseNomeKitCompleto()}.docx`)
    showSuccess('DOCX único gerado com sucesso!')
  } catch (e: any) {
    console.error('Erro ao gerar DOCX único:', e)
    showError(e?.response?.data?.detail || e?.message || 'Não foi possível gerar o DOCX único.')
  } finally {
    downloadAllDocLoading.value = false
  }
}

// ── Procuração especial: uma página por ação, tudo num único doc ──

/** Tarifa / seguro / contribuição: texto que entra entre parênteses na frase da procuração. */
function detalheBrutoProcuracao (acao: KitAcao): string {
  if (acao.tipoAcao === 'tarifa_bancaria') return resolveTarifaQuestionada(acao)
  if (acao.tipoAcao === 'seguro_nao_autorizado') return (acao.tipoSeguro || '').trim()
  if (acao.tipoAcao === 'contribuicao_sindical_nao_autorizada') return (acao.tipoContribuicao || '').trim()
  return ''
}

/** Detalhe em minúsculas para uso em "( mora cartão de crédito )" no Jinja. */
function formatarDetalheProcuracao (raw: string): string {
  if (!raw?.trim()) return ''
  return raw
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Frase quando não há número de contrato: "de Tarifa Bancária (mora cartão de crédito) em face do BRADESCO".
 * Se não houver detalhe, omite os parênteses.
 */
function fraseProcuracaoSemContrato (tipoLabel: string, detalheFormatado: string, bancoUpper: string): string {
  const banco = bancoUpper.toUpperCase()
  if (detalheFormatado) {
    return ` de ${detalheFormatado}`
  }
  return ''
}

async function montarContextoProcuracao (acao: KitAcao): Promise<Record<string, any>> {
  const base = await montarContexto()
  const bancoNome = (acao.nomeBanco === 'Outro' ? acao.bancoOutro : acao.nomeBanco).toUpperCase()
  let tipoLabel = TIPOS_ACAO.find(t => t.value === acao.tipoAcao)?.label || acao.tipoAcao
  const usaContrato = TIPOS_COM_CONTRATO.includes(acao.tipoAcao as TipoAcao)
  let procuracao_detalhe_tipo = usaContrato ? '' : formatarDetalheProcuracao(detalheBrutoProcuracao(acao))
  // Procuração nunca leva o sufixo "e INSS" — esse texto entra só no
  // contrato (ver montarContexto). Mantém o nome da variável por compat
  // com o caso especial de contribuição sindical mais abaixo.
  let bancoComInss = bancoNome

  // Caso especial: contribuição sindical não autorizada em kit bancário com associação.
  // tipos_acao → frase do tipo, bancos → abreviação, {{ do }} → "de(a)".
  let doPronome = base.do as string
  if (
    acao.tipoAcao === 'contribuicao_sindical_nao_autorizada'
    && tipoKit.value === 'bancario'
    && acao.associacaoId != null
  ) {
    const assoc = associacoesOptions.value.find(a => a.id === acao.associacaoId)
    if (assoc) {
      tipoLabel = 'contribuição não autorizada em benefício previdenciário'
      bancoComInss = assoc.abreviacao || assoc.nome
      procuracao_detalhe_tipo = ''
      doPronome = 'de(a)'
    }
  }

  return {
    ...base,
    do: doPronome,
    bancos: bancoComInss,
    tipos_acao: tipoLabel,
    tarifa_questionada: resolveTarifaQuestionada(acao),
    instituicao_re: bancoComInss,
    contrato_acao: `contrato nº ${acao.numeroContrato}`,
    procuracao_usa_numero_contrato: usaContrato,
    procuracao_detalhe_tipo,
    procuracao_frase_acao: usaContrato
      ? ''
      : fraseProcuracaoSemContrato(tipoLabel, procuracao_detalhe_tipo, bancoNome),
  }
}

async function fetchProcuracaoMultipla () {
  const key = 'procuracao'
  if (!procuracaoTemplateId.value) {
    docErrors.value[key] = '__NOT_FOUND__'
    return
  }
  docLoading.value[key] = true
  docErrors.value[key] = ''
  // Invalida caches do .docx — o preview foi regerado
  delete docxBlobs.value[key]
  procuracaoActionDocxBlobs.value = null

  try {
    // Caminho rápido: 1 ação -> render-pdf direto. skipPageNumbering: cada
    // procuração é um documento autônomo, "Página X de Y" não faz sentido.
    if (acoes.value.length === 1) {
      const ctx = await montarContextoProcuracao(acoes.value[0])
      const result = await templatesStore.renderPdf(procuracaoTemplateId.value, {
        context: ctx,
        filename: baseNomeDownloadDoc('procuracao'),
        skipPageNumbering: true,
      })
      pdfBlobs.value[key] = result.blob
      // Não cacheia o .docx por ação aqui; downloadDoc o gerará sob demanda.
      procuracaoActionDocxBlobs.value = null
      return
    }

    // N ações: renderiza .docx por ação (cacheado para reuso no Word) e
    // envia tudo para compose-to-pdf, que devolve o PDF combinado.
    const actionBlobs: Blob[] = []
    for (const acao of acoes.value) {
      const ctx = await montarContextoProcuracao(acao)
      const result = await templatesStore.render(procuracaoTemplateId.value, {
        context: ctx,
        filename: baseNomeDownloadDoc('procuracao'),
        skipPageNumbering: true,
      })
      actionBlobs.push(result.blob)
    }
    procuracaoActionDocxBlobs.value = actionBlobs

    const fd = new FormData()
    actionBlobs.forEach((b, i) => fd.append('files', b, `proc_${i}.docx`))
    fd.append('filename', baseNomeDownloadDoc('procuracao'))
    fd.append('skip_page_numbering', 'true')
    const { data } = await api.post('/api/templates/compose-to-pdf/', fd, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    pdfBlobs.value[key] = data as Blob
  } catch (e: any) {
    console.error('Erro ao gerar procurações:', e)
    if (e?.response?.status === 404) {
      docErrors.value[key] = '__NOT_FOUND__'
    } else {
      const msg = e?.response?.data?.detail || e?.message || 'Erro desconhecido'
      docErrors.value[key] = `Não foi possível gerar as procurações: ${msg}`
    }
  } finally {
    docLoading.value[key] = false
  }
}

// ── Watchers ──

// Busca todos os blobs quando entra no Kit Final.
// Sequencial: cada conversão LibreOffice no backend pesa ~150MB de RAM
// e ~1 core; rodar 5 em paralelo arrisca OOM em VPS pequenos.
watch(etapaAtual, async (val) => {
  if (val === 'kit-final' && cad.value.nome) {
    await resolveKitTemplates()
    for (const t of kitTemplatesVisiveis.value) {
      await fetchDocBlob(t.id, t.key)
    }
    await nextTick()
    await nextTick()
    await renderBlobToContainer(docTab.value)
  }
})

// Renderiza o blob quando muda de aba (docs fixos)
watch(docTab, async (key) => {
  if (pdfBlobs.value[key] && etapaAtual.value === 'kit-final') {
    await nextTick()
    await nextTick()
    await renderBlobToContainer(key)
  }
})

// Limpa object URLs dos iframes ao sair da view (evita vazamento de memória)
onBeforeUnmount(() => {
  for (const url of Object.values(pdfBlobUrls.value)) {
    if (url) URL.revokeObjectURL(url)
  }
  pdfBlobUrls.value = {}
})

/* ── Código legado removido — geração de texto puro ──
function gerarContrato () {
  ...era texto puro, agora usa docx-preview
}
*/

// placeholder
const _removed = null // eslint-disable-line
// ── Persistência ──
const savingMessage = ref('')

async function avancarComPersistencia () {
  if (etapaAtual.value === 'cliente') {
    if (!validateCadastro()) return
    if (!clienteId.value) return
    saving.value = true

    try {
      savingMessage.value = 'Salvando dados do cliente...'
      await kitsStore.saveCadastro(kitId.value, clienteId.value, cad.value)

      const proxima = tipoKit.value === 'previdenciario' ? 'advogados' : 'acoes'
      if (!isEditMode.value) {
        savingMessage.value = 'Salvando rascunho do kit...'
        const created = await kitsStore.createDraft(clienteId.value, tipoKit.value)
        await router.replace({
          name: 'producao-kits-editar',
          params: { id: created.id },
          query: { etapa: proxima },
        })
      } else {
        etapaAtual.value = proxima
      }
    } finally {
      saving.value = false
      savingMessage.value = ''
    }
    return
  }

  if (etapaAtual.value === 'acoes') {
    if (!validateAcoes()) return
    saving.value = true
    try {
      savingMessage.value = 'Salvando ações...'
      if (clienteId.value) {
        await kitsStore.saveCadastro(kitId.value, clienteId.value, cad.value)
      }
      const savedAcoes = await kitsStore.saveAcoes(kitId.value, acoes.value, acoesExistentes.value)
      acoesExistentes.value = savedAcoes
      acoes.value = savedAcoes.map(a => acaoFromAPI(a))
      etapaAtual.value = 'advogados'
    } finally {
      saving.value = false
      savingMessage.value = ''
    }
    return
  }

  if (etapaAtual.value === 'advogados') {
    saving.value = true
    try {
      savingMessage.value = 'Salvando advogados...'
      await salvarAdvogadosESeguir()
    } finally {
      saving.value = false
      savingMessage.value = ''
    }
  }
}

function etapaAnterior () {
  const prev = etapaIndex.value - 1
  if (prev >= 0) etapaAtual.value = etapas.value[prev]
}

function resetSelectedCliente () {
  clienteEncontrado.value = false
  clienteId.value = null
  clienteNaoEncontrado.value = false
  cpfBusca.value = ''
  docsPessoais.value = []
  relatedDocs.value.rogado = []
  relatedDocs.value.testemunha1 = []
  relatedDocs.value.testemunha2 = []
  relatedDocs.value.responsavel_legal = []
}

async function finalizarKit () {
  if (!kitId.value) return
  saving.value = true
  try {
    await kitsStore.finalizar(kitId.value)
    await router.push({ name: 'producao-kits' })
  } finally {
    saving.value = false
  }
}

async function marcarAssinado () {
  if (!kitId.value) return
  saving.value = true
  try {
    await kitsStore.assinar(kitId.value)
    cad.value.status = 'assinado'
  } finally {
    saving.value = false
  }
}

function abrirDialogZapSign () {
  zapsignStep.value = zapsignSignUrl.value ? 2 : 1
  zapsignDialog.value = true
}

async function confirmarEnvioZapSign () {
  if (!kitId.value) return
  zapsignLoading.value = true
  try {
    const result = await enviarParaAssinatura(kitId.value, {
      nivel: zapsignNivel.value,
      medio_tipo: zapsignMedioTipo.value,
      rubrica: zapsignComRubrica.value,
    })
    zapsignSignUrl.value = result.sign_url
    zapsignDocumentos.value = result.documentos
    zapsignStatus.value = 'pending'
    if (result.status && result.status !== cad.value.status) {
      cad.value.status = result.status as any
    }
    zapsignStep.value = 2
  } catch (e: any) {
    showError(friendlyError(e, 'kits', 'update'))
  } finally {
    zapsignLoading.value = false
  }
}

async function copiarLinkZapSign () {
  if (!zapsignSignUrl.value) return
  try {
    await navigator.clipboard.writeText(zapsignSignUrl.value)
    zapsignCopied.value = true
    setTimeout(() => { zapsignCopied.value = false }, 2000)
  } catch {
    showError('Não foi possível copiar. Copie o link manualmente.')
  }
}

async function verificarStatusZapSign () {
  if (!kitId.value) return
  zapsignVerificandoStatus.value = true
  try {
    const kit = await kitsStore.getDetail(kitId.value)
    if (!kit) return
    cad.value.status = kit.status as any
    zapsignStatus.value = kit.zapsign_status ?? null
    if (kit.status === 'assinado') {
      const bundled = (kit.documentos || []).filter(d => d.tipo === 'assinado_zapsign')
      documentosAssinados.value = bundled.length
        ? bundled
        : (kit.documentos || []).filter(d => d.zapsign_status === 'signed')
      zapsignDialog.value = false
      showSuccess('Kit assinado com sucesso! Todos os documentos foram assinados.')
    } else {
      showInfo('Ainda aguardando assinatura dos documentos.')
    }
  } catch (e: any) {
    showError(friendlyError(e, 'kits', 'fetch'))
  } finally {
    zapsignVerificandoStatus.value = false
  }
}

function compartilharWhatsAppTodos () {
  if (!zapsignSignUrl.value) return
  const nomes = zapsignDocumentos.value.map(d => `📄 ${d.tipo_display}`).join('\n')
  const linhas = `${nomes}\n\n🔗 Link de assinatura:\n${zapsignSignUrl.value}`
  const msg = encodeURIComponent(
    `Olá! Segue o link para você assinar os documentos:\n\n${linhas}`,
  )
  window.open(`https://wa.me/?text=${msg}`, '_blank')
}

// ── Load existing kit ──
onMounted(async () => {
  await Promise.all([resolveKitTemplates(), carregarBancosETarifas()])
  await kitsStore.fetchList()
  if (!isEditMode.value) return
  const kit = await kitsStore.getDetail(kitId.value)
  if (!kit) return

  tipoKit.value = kit.tipo || 'bancario'
  clienteId.value = kit.cliente
  clienteEncontrado.value = true
  if (kit.cliente_detail) {
    cad.value = clienteToCadastro(kit.cliente_detail)
    clienteNome.value = kit.cliente_detail.nome_completo || ''
    docsPessoais.value = kit.cliente_detail.documentos_pessoais || []
    relatedDocs.value.rogado = kit.cliente_detail.rogado_documentos || []
    relatedDocs.value.testemunha1 = kit.cliente_detail.testemunha1_documentos || []
    relatedDocs.value.testemunha2 = kit.cliente_detail.testemunha2_documentos || []
    relatedDocs.value.responsavel_legal = kit.cliente_detail.responsavel_legal_documentos || []
  }
  cad.value.status = kit.status

  // ZapSign — restaura link único se já enviado (extra_docs: token no kit, não por documento)
  zapsignStatus.value = kit.zapsign_status ?? null
  if (kit.zapsign_status === 'pending' && kit.zapsign_sign_url) {
    zapsignSignUrl.value = kit.zapsign_sign_url
    zapsignDocumentos.value = (kit.documentos || [])
      .filter(d => d.tipo !== 'assinado_zapsign')
      .map(d => ({ tipo: d.tipo, tipo_display: d.tipo_display }))
  }
  // Documentos assinados: carrega se kit já está assinado
  // extra_docs: um único "assinado_zapsign"; fluxo antigo: cada doc substituído individualmente
  if (kit.status === 'assinado') {
    const bundled = (kit.documentos || []).filter(d => d.tipo === 'assinado_zapsign')
    documentosAssinados.value = bundled.length
      ? bundled
      : (kit.documentos || []).filter(d => d.zapsign_status === 'signed')
  }

  // Preencher ações
  acoesExistentes.value = kit.acoes || []
  acoes.value = kit.acoes.map(a => acaoFromAPI(a))

  // Ir para a etapa correta: query param tem prioridade, senão usa o status
  const etapaQuery = route.query.etapa as string | undefined
  const isPrevid = tipoKit.value === 'previdenciario'
  if (etapaQuery === 'kit-final') {
    etapaAtual.value = 'kit-final'
  } else if (etapaQuery === 'advogados') {
    etapaAtual.value = 'advogados'
  } else if (etapaQuery === 'acoes' && !isPrevid) {
    etapaAtual.value = 'acoes'
  } else if (kit.status === 'acoes' && !isPrevid) {
    etapaAtual.value = 'acoes'
  } else if (isPrevid && kit.status !== 'rascunho') {
    etapaAtual.value = 'kit-final'
  } else if (kit.status === 'finalizado' || kit.status === 'assinado') {
    etapaAtual.value = 'kit-final'
  }
})
</script>

<template>
  <v-container class="novo-kit pa-0" fluid>
    <!-- Top bar -->
    <div class="topbar px-6">
      <v-btn class="text-none" prepend-icon="mdi-arrow-left" slim variant="text" :to="{ name: 'producao-kits' }">
        Voltar
      </v-btn>
      <div class="topbar-title">{{ isEditMode ? 'Editar Kit' : 'Novo Kit' }}</div>
      <div style="width: 70px" />
    </div>

    <v-divider />

    <div class="content-wrap px-6 py-6">
      <!-- Steps indicator -->
      <div class="steps mb-5">
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'cliente' ? 'step-icon--active' : (etapaIndex > 0 ? 'step-icon--done' : '')]" size="44">
            <v-icon :icon="etapaIndex > 0 ? 'mdi-check' : 'mdi-account-outline'" />
          </v-avatar>
          <span class="step-label">Cliente</span>
        </div>
        <template v-if="tipoKit !== 'previdenciario'">
          <div :class="['step-line', etapaIndex >= etapas.indexOf('acoes') ? 'step-line--done' : '']" />
          <div class="step">
            <v-avatar :class="['step-icon', etapaAtual === 'acoes' ? 'step-icon--active' : (etapaIndex > etapas.indexOf('acoes') ? 'step-icon--done' : '')]" size="44">
              <v-icon :icon="etapaIndex > etapas.indexOf('acoes') ? 'mdi-check' : 'mdi-scale-balance'" />
            </v-avatar>
            <span class="step-label">Ações</span>
          </div>
        </template>
        <div :class="['step-line', etapaIndex >= etapas.indexOf('advogados') ? 'step-line--done' : '']" />
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'advogados' ? 'step-icon--active' : (etapaIndex > etapas.indexOf('advogados') ? 'step-icon--done' : '')]" size="44">
            <v-icon :icon="etapaIndex > etapas.indexOf('advogados') ? 'mdi-check' : 'mdi-account-tie-outline'" />
          </v-avatar>
          <span class="step-label">Advogados</span>
        </div>
        <div :class="['step-line', etapaAtual === 'kit-final' ? 'step-line--done' : '']" />
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'kit-final' ? 'step-icon--active' : '']" size="44">
            <v-icon icon="mdi-eye-outline" />
          </v-avatar>
          <span class="step-label">Kit Final</span>
        </div>
      </div>

      <!-- Form card -->
      <v-card class="form-card" rounded="sm" variant="outlined">
        <v-card-text class="pa-6 pa-md-7">
          <v-window v-model="etapaAtual">

            <!-- ═══════════════ STEP 1: CLIENTE ═══════════════ -->
            <v-window-item value="cliente">

              <!-- Tipo do Kit -->
              <h2 class="section-title">Tipo do Kit</h2>
              <v-divider class="mb-5" />
              <v-row dense class="mb-6" align="center" justify="space-between">
                <v-col cols="12" md="4">
                  <v-select
                    v-model="tipoKit"
                    :disabled="isEditMode"
                    density="compact"
                    hide-details
                    :items="TIPOS_KIT"
                    item-title="label"
                    item-value="value"
                    label="Tipo do Kit"
                    prepend-inner-icon="mdi-tag-outline"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="auto">
                  <label class="field-label">Foto do cliente</label>
                  <div class="foto-cliente-wrap">
                    <template v-if="cad.fotoCliente">
                      <img :src="cad.fotoCliente.url" alt="Foto do cliente" class="foto-cliente-img">
                      <v-btn
                        class="foto-cliente-remove"
                        color="error"
                        icon="mdi-close"
                        size="x-small"
                        variant="flat"
                        @click="removeFotoCliente"
                      />
                    </template>
                    <div
                      v-else
                      class="foto-cliente-drop"
                      :class="{ 'foto-cliente-drop--disabled': !clienteId, 'foto-cliente-drop--uploading': fotoClienteUploading }"
                      @click="clienteId && ($refs.fotoClienteInput as HTMLInputElement)?.click()"
                    >
                      <input ref="fotoClienteInput" accept="image/jpeg,image/png,image/webp" hidden type="file" @change="onSelectFotoCliente">
                      <v-progress-circular v-if="fotoClienteUploading" color="primary" indeterminate size="20" width="2" />
                      <template v-else>
                        <v-icon icon="mdi-camera-outline" size="26" />
                        <span class="foto-cliente-hint">{{ clienteId ? 'Adicionar' : 'Busque o cliente' }}</span>
                      </template>
                    </div>
                  </div>
                </v-col>
              </v-row>

              <!-- Busca de cliente por CPF (só para novo kit) -->
              <template v-if="!isEditMode && !clienteEncontrado">
                <h2 class="section-title">Buscar Cliente</h2>
                <v-divider class="mb-5" />
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Informe o CPF do cliente para buscar no sistema.
                </p>
                <v-row align="center" dense>
                  <v-col cols="12" md="6">
                    <label class="field-label">CPF do cliente *</label>
                    <v-text-field
                      :model-value="cpfBusca"
                      class="compact-input"
                      density="compact"
                      hide-details="auto"
                      placeholder="000.000.000-00"
                      variant="outlined"
                      @keydown.enter="buscarClientePorCpf"
                      maxlength="14"
                      @update:model-value="cpfBusca = maskCPF($event)"
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-btn
                      class="mt-5"
                      color="primary"
                      :disabled="onlyDigits(cpfBusca).length !== 11"
                      :loading="buscandoCliente"
                      prepend-icon="mdi-magnify"
                      variant="tonal"
                      @click="buscarClientePorCpf"
                    >
                      Buscar
                    </v-btn>
                  </v-col>
                </v-row>

                <!-- Cliente não encontrado -->
                <v-alert v-if="clienteNaoEncontrado" class="mt-5" color="warning" icon="mdi-account-search-outline" variant="tonal">
                  <div class="d-flex align-center justify-space-between flex-wrap ga-3">
                    <span>Cliente não encontrado no sistema.</span>
                    <v-btn
                      v-if="can('clientes.criar')"
                      color="primary"
                      prepend-icon="mdi-account-plus-outline"
                      size="small"
                      variant="flat"
                      @click="abrirDrawerCadastro"
                    >
                      Cadastrar Cliente
                    </v-btn>
                  </div>
                </v-alert>
              </template>

              <!-- Formulário completo (quando cliente foi encontrado/criado ou editando kit existente) -->
              <template v-if="clienteEncontrado || isEditMode">

              <!-- Info do cliente selecionado -->
              <v-alert v-if="clienteNome && !isEditMode" class="mb-5" color="success" icon="mdi-account-check-outline" variant="tonal">
                <div class="d-flex align-center justify-space-between">
                  <span><strong>{{ clienteNome }}</strong> — CPF: {{ cad.cpf }}</span>
                  <v-btn
                    color="default"
                    size="x-small"
                    variant="text"
                    @click="resetSelectedCliente"
                  >
                    Trocar cliente
                  </v-btn>
                </div>
              </v-alert>

              <!-- Dados Pessoais -->
              <h2 class="section-title">Dados Pessoais</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12">
                  <label class="field-label">Nome completo *</label>
                  <v-text-field v-model="cad.nome" class="compact-input" density="compact" :error-messages="errors.nome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">CPF *</label>
                  <v-text-field :model-value="cad.cpf" class="compact-input" density="compact" disabled :error-messages="errors.cpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.cpf = maskCPF($event)" />
                </v-col>
                <v-col v-if="tipoKit === 'previdenciario'" cols="12" md="6">
                  <label class="field-label">Data de Nascimento *</label>
                  <v-text-field v-model="cad.dataNascimento" class="compact-input" density="compact" :error-messages="errors.dataNascimento" hide-details="auto" placeholder="DD/MM/AAAA" type="date" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Gênero *</label>
                  <v-select v-model="cad.genero" class="compact-input" density="compact" :error-messages="errors.genero" hide-details="auto" :items="opcoesGenero" placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Nacionalidade *</label>
                  <v-select v-model="cad.nacionalidadeTipo" class="compact-input" density="compact" :error-messages="errors.nacionalidadeTipo" hide-details="auto" :items="opcoesNacionalidade" placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col v-if="cad.nacionalidadeTipo === 'outro'" cols="12" md="6">
                  <label class="field-label">Qual nacionalidade? *</label>
                  <v-text-field v-model="cad.nacionalidade" class="compact-input" density="compact" :error-messages="errors.nacionalidade" hide-details="auto" placeholder="Ex: Argentino(a)" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Estado Civil</label>
                  <v-select v-model="cad.estadoCivilTipo" class="compact-input" clearable density="compact" :error-messages="errors.estadoCivilTipo" hide-details="auto" :items="opcoesEstadoCivil" placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col v-if="cad.estadoCivilTipo === 'outro'" cols="12" md="6">
                  <label class="field-label">Qual estado civil? *</label>
                  <v-text-field v-model="cad.estadoCivil" class="compact-input" density="compact" :error-messages="errors.estadoCivil" hide-details="auto" placeholder="Informe o estado civil" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Profissão</label>
                  <v-select v-model="cad.profissaoTipo" class="compact-input" clearable density="compact" :error-messages="errors.profissaoTipo" hide-details="auto" :items="opcoesProfissao" placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col v-if="cad.profissaoTipo === 'outro'" cols="12" md="6">
                  <label class="field-label">Qual profissão? *</label>
                  <v-text-field v-model="cad.profissao" class="compact-input" density="compact" :error-messages="errors.profissao" hide-details="auto" placeholder="Informe a profissão" variant="outlined" />
                </v-col>
              </v-row>

              <!-- Condição do Cliente -->
              <h2 class="section-title mt-8">Condição do Cliente</h2>
              <v-divider class="mb-5" />
              <label class="field-label">Condição do cliente *</label>
              <div class="conditions-grid mb-2">
                <v-btn
                  v-for="op in opcoesCondicao"
                  :key="op.value"
                  class="text-none"
                  :color="cad.condicaoCliente === op.value ? 'primary' : undefined"
                  :prepend-icon="op.icon"
                  :variant="cad.condicaoCliente === op.value ? 'flat' : 'outlined'"
                  @click="cad.condicaoCliente = op.value"
                >
                  {{ op.label }}
                </v-btn>
              </div>

              <!-- Analfabeto: alerta + rogado + testemunhas -->
              <template v-if="isAnalfabeto">
                <v-alert class="mt-6 mb-5" color="info" icon="mdi-information-outline" variant="tonal">
                  Para clientes analfabetos, é necessário informar um rogado e duas testemunhas.
                </v-alert>

                <!-- Rogado -->
                <v-card class="pessoa-card mb-4" rounded="sm" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="pessoa-card__header mb-3">
                      <v-icon icon="mdi-account-outline" size="small" />
                      <span class="pessoa-card__title">Rogado</span>
                    </div>
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <label class="field-label">Nome completo *</label>
                        <v-text-field v-model="cad.rogadoNome" class="compact-input" density="compact" :error-messages="errors.rogadoNome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                      </v-col>
                      <v-col cols="12" md="6">
                        <label class="field-label">CPF *</label>
                        <v-text-field :model-value="cad.rogadoCpf" class="compact-input" density="compact" :error-messages="errors.rogadoCpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.rogadoCpf = maskCPF($event)" />
                      </v-col>
                      <v-col cols="12">
                        <label class="field-label">Documento de identidade (opcional)</label>
                        <div v-if="relatedDocs.rogado.length" class="docs-list mb-3">
                          <div v-for="doc in relatedDocs.rogado" :key="doc.path" class="docs-list__item">
                            <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                              <img
                                v-if="isImage(doc.name)"
                                :src="doc.url"
                                :alt="doc.name"
                                class="docs-list__img"
                              >
                              <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                            </a>
                            <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                            <v-spacer />
                            <v-btn
                              color="error"
                              icon="mdi-close"
                              size="x-small"
                              variant="text"
                              @click="removeRelatedDoc('rogado', doc)"
                            />
                          </div>
                        </div>
                        <label class="upload-inline upload-inline--boxed">
                          <input
                            accept="image/*,.pdf,.doc,.docx"
                            hidden
                            multiple
                            type="file"
                            @change="onSelectRelatedDocs('rogado', $event)"
                          >
                          <v-icon v-if="!relatedDocsUploading.rogado" color="primary" icon="mdi-upload" size="small" />
                          <v-progress-circular v-else color="primary" indeterminate size="16" width="2" />
                          <span>{{ relatedDocsUploading.rogado ? 'Enviando...' : 'Clique para enviar arquivos' }}</span>
                        </label>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>

                <!-- Testemunha 1 -->
                <v-card class="pessoa-card mb-4" rounded="sm" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="pessoa-card__header mb-3">
                      <v-icon icon="mdi-account-outline" size="small" />
                      <span class="pessoa-card__title">Testemunha 1</span>
                      <v-chip class="ml-2" color="default" size="x-small" variant="tonal">Opcional</v-chip>
                    </div>
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <label class="field-label">Nome completo</label>
                        <v-text-field v-model="cad.testemunha1Nome" class="compact-input" density="compact" :error-messages="errors.testemunha1Nome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                      </v-col>
                      <v-col cols="12" md="6">
                        <label class="field-label">CPF</label>
                        <v-text-field :model-value="cad.testemunha1Cpf" class="compact-input" density="compact" :error-messages="errors.testemunha1Cpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.testemunha1Cpf = maskCPF($event)" />
                      </v-col>
                      <v-col cols="12">
                        <label class="field-label">Documento de identidade (opcional)</label>
                        <div v-if="relatedDocs.testemunha1.length" class="docs-list mb-3">
                          <div v-for="doc in relatedDocs.testemunha1" :key="doc.path" class="docs-list__item">
                            <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                              <img
                                v-if="isImage(doc.name)"
                                :src="doc.url"
                                :alt="doc.name"
                                class="docs-list__img"
                              >
                              <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                            </a>
                            <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                            <v-spacer />
                            <v-btn
                              color="error"
                              icon="mdi-close"
                              size="x-small"
                              variant="text"
                              @click="removeRelatedDoc('testemunha1', doc)"
                            />
                          </div>
                        </div>
                        <label class="upload-inline upload-inline--boxed">
                          <input
                            accept="image/*,.pdf,.doc,.docx"
                            hidden
                            multiple
                            type="file"
                            @change="onSelectRelatedDocs('testemunha1', $event)"
                          >
                          <v-icon v-if="!relatedDocsUploading.testemunha1" color="primary" icon="mdi-upload" size="small" />
                          <v-progress-circular v-else color="primary" indeterminate size="16" width="2" />
                          <span>{{ relatedDocsUploading.testemunha1 ? 'Enviando...' : 'Clique para enviar arquivos' }}</span>
                        </label>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>

                <!-- Testemunha 2 -->
                <v-card class="pessoa-card mb-4" rounded="sm" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="pessoa-card__header mb-3">
                      <v-icon icon="mdi-account-outline" size="small" />
                      <span class="pessoa-card__title">Testemunha 2</span>
                      <v-chip class="ml-2" color="default" size="x-small" variant="tonal">Opcional</v-chip>
                    </div>
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <label class="field-label">Nome completo</label>
                        <v-text-field v-model="cad.testemunha2Nome" class="compact-input" density="compact" :error-messages="errors.testemunha2Nome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                      </v-col>
                      <v-col cols="12" md="6">
                        <label class="field-label">CPF</label>
                        <v-text-field :model-value="cad.testemunha2Cpf" class="compact-input" density="compact" :error-messages="errors.testemunha2Cpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.testemunha2Cpf = maskCPF($event)" />
                      </v-col>
                      <v-col cols="12">
                        <label class="field-label">Documento de identidade (opcional)</label>
                        <div v-if="relatedDocs.testemunha2.length" class="docs-list mb-3">
                          <div v-for="doc in relatedDocs.testemunha2" :key="doc.path" class="docs-list__item">
                            <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                              <img
                                v-if="isImage(doc.name)"
                                :src="doc.url"
                                :alt="doc.name"
                                class="docs-list__img"
                              >
                              <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                            </a>
                            <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                            <v-spacer />
                            <v-btn
                              color="error"
                              icon="mdi-close"
                              size="x-small"
                              variant="text"
                              @click="removeRelatedDoc('testemunha2', doc)"
                            />
                          </div>
                        </div>
                        <label class="upload-inline upload-inline--boxed">
                          <input
                            accept="image/*,.pdf,.doc,.docx"
                            hidden
                            multiple
                            type="file"
                            @change="onSelectRelatedDocs('testemunha2', $event)"
                          >
                          <v-icon v-if="!relatedDocsUploading.testemunha2" color="primary" icon="mdi-upload" size="small" />
                          <v-progress-circular v-else color="primary" indeterminate size="16" width="2" />
                          <span>{{ relatedDocsUploading.testemunha2 ? 'Enviando...' : 'Clique para enviar arquivos' }}</span>
                        </label>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </template>

              <!-- Incapaz / Criança: alerta + responsável legal -->
              <template v-if="needsResponsavel">
                <v-alert class="mt-6 mb-5" color="info" icon="mdi-information-outline" variant="tonal">
                  É necessário informar o responsável legal do cliente.
                </v-alert>

                <v-card class="pessoa-card mb-4" rounded="sm" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="pessoa-card__header mb-3">
                      <v-icon icon="mdi-account-outline" size="small" />
                      <span class="pessoa-card__title">Responsável Legal</span>
                    </div>
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <label class="field-label">Nome completo *</label>
                        <v-text-field v-model="cad.responsavelLegalNome" class="compact-input" density="compact" :error-messages="errors.responsavelLegalNome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                      </v-col>
                      <v-col cols="12" md="6">
                        <label class="field-label">CPF *</label>
                        <v-text-field :model-value="cad.responsavelLegalCpf" class="compact-input" density="compact" :error-messages="errors.responsavelLegalCpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.responsavelLegalCpf = maskCPF($event)" />
                      </v-col>
                      <v-col cols="12">
                        <label class="field-label">Documento de identidade (opcional)</label>
                        <div v-if="relatedDocs.responsavel_legal.length" class="docs-list mb-3">
                          <div v-for="doc in relatedDocs.responsavel_legal" :key="doc.path" class="docs-list__item">
                            <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                              <img
                                v-if="isImage(doc.name)"
                                :src="doc.url"
                                :alt="doc.name"
                                class="docs-list__img"
                              >
                              <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                            </a>
                            <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                            <v-spacer />
                            <v-btn
                              color="error"
                              icon="mdi-close"
                              size="x-small"
                              variant="text"
                              @click="removeRelatedDoc('responsavel_legal', doc)"
                            />
                          </div>
                        </div>
                        <label class="upload-inline upload-inline--boxed">
                          <input
                            accept="image/*,.pdf,.doc,.docx"
                            hidden
                            multiple
                            type="file"
                            @change="onSelectRelatedDocs('responsavel_legal', $event)"
                          >
                          <v-icon v-if="!relatedDocsUploading.responsavel_legal" color="primary" icon="mdi-upload" size="small" />
                          <v-progress-circular v-else color="primary" indeterminate size="16" width="2" />
                          <span>{{ relatedDocsUploading.responsavel_legal ? 'Enviando...' : 'Clique para enviar arquivos' }}</span>
                        </label>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </template>

              <!-- Documentos pessoais do cliente (aparece em todas as condições) -->
              <div class="mt-6">
                <h2 class="section-title">Documentos pessoais do cliente</h2>
                <div class="doc-chips mb-3">
                  <span class="doc-chips__label">Sugestões:</span>
                  <v-chip color="primary" label size="small" variant="tonal">RG</v-chip>
                  <v-chip color="primary" label size="small" variant="tonal">CPF</v-chip>
                  <v-chip color="primary" label size="small" variant="tonal">CNH</v-chip>
                </div>

                <!-- Lista de documentos já enviados -->
                <div v-if="docsPessoais.length" class="docs-list mb-3">
                  <div v-for="doc in docsPessoais" :key="doc.path" class="docs-list__item">
                    <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                      <img
                        v-if="isImage(doc.name)"
                        :src="doc.url"
                        :alt="doc.name"
                        class="docs-list__img"
                      >
                      <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                    </a>
                    <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                    <v-spacer />
                    <v-btn
                      color="error"
                      icon="mdi-close"
                      size="x-small"
                      variant="text"
                      @click="removeDocPessoal(doc)"
                    />
                  </div>
                </div>

                <!-- Zona de upload (sempre visível para adicionar mais) -->
                <div
                  class="upload-zone"
                  :class="{ 'upload-zone--uploading': uploadingDocs }"
                  @click="($refs.docPessoalInput as HTMLInputElement)?.click()"
                  @dragover.prevent
                  @drop.prevent="onDropDocPessoal"
                >
                  <input
                    ref="docPessoalInput"
                    accept="image/*,.pdf,.doc,.docx"
                    hidden
                    multiple
                    type="file"
                    @change="onSelectDocPessoal"
                  >
                  <template v-if="uploadingDocs">
                    <v-progress-circular color="primary" indeterminate size="24" width="2" />
                    <span class="upload-zone__title mt-2">Enviando...</span>
                  </template>
                  <template v-else>
                    <v-icon class="upload-zone__icon" icon="mdi-upload" />
                    <span class="upload-zone__title">Clique ou arraste para enviar</span>
                    <span class="upload-zone__hint">PDF, DOC, DOCX, JPG ou PNG — múltiplos arquivos</span>
                  </template>
                </div>
              </div>

              <!-- Endereço -->
              <h2 class="section-title mt-8">Endereço do Cliente</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12" md="4">
                  <label class="field-label">CEP *</label>
                  <v-text-field :model-value="cad.cep" :append-inner-icon="buscandoCep ? 'mdi-loading mdi-spin' : undefined" class="compact-input" density="compact" :error-messages="errors.cep" hide-details="auto" placeholder="00000-000" variant="outlined" @update:model-value="cad.cep = maskCEP($event)" />
                </v-col>
                <v-col cols="12" md="8">
                  <label class="field-label">Nome da rua *</label>
                  <v-text-field v-model="cad.rua" class="compact-input" density="compact" :error-messages="errors.rua" hide-details="auto" placeholder="Ex: Rua das Flores" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Número *</label>
                  <v-text-field v-model="cad.numero" class="compact-input" density="compact" :error-messages="errors.numero" hide-details="auto" placeholder="Ex: 123 ou S/N" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Complemento</label>
                  <v-text-field v-model="cad.complemento" class="compact-input" density="compact" hide-details placeholder="Apto, Bloco, etc." variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Bairro *</label>
                  <v-text-field v-model="cad.bairro" class="compact-input" density="compact" :error-messages="errors.bairro" hide-details="auto" placeholder="Bairro" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Cidade *</label>
                  <v-text-field v-model="cad.cidade" class="compact-input" density="compact" :error-messages="errors.cidade" hide-details="auto" placeholder="Cidade" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Estado *</label>
                  <v-select v-model="cad.estado" class="compact-input" density="compact" :error-messages="errors.estado" hide-details="auto" :items="UF_LIST" placeholder="UF" variant="outlined" />
                </v-col>
              </v-row>

              <!-- Geolocalização da residência (antes era uma step própria) -->
              <h2 class="section-title mt-8">Geolocalização da Residência</h2>
              <v-divider class="mb-5" />
              <p class="text-medium-emphasis mb-4" style="font-size: .875rem;">
                Marque onde o cliente mora — use o botão de localização atual ou clique/arraste o pino no mapa. (Opcional)
              </p>

              <MapaLocalCliente
                v-model:latitude="cad.latitude"
                v-model:longitude="cad.longitude"
              />

              <!-- Fotos da residência -->
              <h2 class="section-title mt-8">Fotos da Residência</h2>
              <v-divider class="mb-5" />
              <label class="field-label">Fotos da rua e da casa (opcional, múltiplas — máx. {{ MAX_FOTOS_RESIDENCIA }})</label>
              <div v-if="cad.fotosResidencia.length" class="docs-list mb-3">
                <div v-for="doc in cad.fotosResidencia" :key="doc.path" class="docs-list__item">
                  <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                    <img v-if="isImage(doc.name)" :src="doc.url" :alt="doc.name" class="docs-list__img">
                    <v-icon v-else color="primary" :icon="docIcon(doc.name)" size="28" />
                  </a>
                  <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                  <v-spacer />
                  <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeFotoResidencia(doc)" />
                </div>
              </div>
              <div
                class="upload-zone mb-4"
                :class="{ 'upload-zone--uploading': fotosResidenciaUploading }"
                @click="($refs.fotosResidenciaInput as HTMLInputElement)?.click()"
                @dragover.prevent
                @drop.prevent="onDropFotosResidencia"
              >
                <input ref="fotosResidenciaInput" accept="image/jpeg,image/png,image/webp" hidden multiple type="file" @change="onSelectFotosResidencia">
                <template v-if="fotosResidenciaUploading">
                  <v-progress-circular color="primary" indeterminate size="24" width="2" />
                  <span class="upload-zone__title mt-2">Enviando...</span>
                </template>
                <template v-else>
                  <v-icon class="upload-zone__icon" icon="mdi-camera-outline" />
                  <span class="upload-zone__title">Clique ou arraste para enviar</span>
                  <span class="upload-zone__hint">JPG, PNG ou WEBP — múltiplas fotos (máx. {{ MAX_FOTOS_RESIDENCIA }})</span>
                </template>
              </div>

              <!-- Comprovante de Residência -->
              <h2 class="section-title mt-8">Comprovante de Residência</h2>
              <v-divider class="mb-5" />

              <label class="field-label">Comprovante de residência (opcional, múltiplos)</label>
              <div v-if="cad.comprovantesResidencia.length" class="docs-list mb-3">
                <div v-for="doc in cad.comprovantesResidencia" :key="doc.path" class="docs-list__item">
                  <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                    <img v-if="isImage(doc.name)" :src="doc.url" :alt="doc.name" class="docs-list__img">
                    <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                  </a>
                  <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                  <v-spacer />
                  <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeComprovante(doc)" />
                </div>
              </div>
              <div
                class="upload-zone mb-4"
                :class="{ 'upload-zone--uploading': comprovantesUploading }"
                @click="($refs.comprovanteInput as HTMLInputElement)?.click()"
                @dragover.prevent
                @drop.prevent="onDropComprovantes"
              >
                <input ref="comprovanteInput" accept="image/*,.pdf,.doc,.docx" hidden multiple type="file" @change="onSelectComprovantes">
                <template v-if="comprovantesUploading">
                  <v-progress-circular color="primary" indeterminate size="24" width="2" />
                  <span class="upload-zone__title mt-2">Enviando...</span>
                </template>
                <template v-else>
                  <v-icon class="upload-zone__icon" icon="mdi-upload" />
                  <span class="upload-zone__title">Clique ou arraste para enviar</span>
                  <span class="upload-zone__hint">PDF, DOC, DOCX, JPG ou PNG — múltiplos arquivos</span>
                </template>
              </div>

              <label class="field-label">O comprovante de residência está em nome do cliente? *</label>
              <v-select v-model="cad.comprovanteNomeCliente" class="compact-input" density="compact" :error-messages="errors.comprovanteNomeCliente" hide-details="auto" :items="[{ title: 'Sim', value: 'sim' }, { title: 'Não', value: 'nao' }]" placeholder="Selecione" variant="outlined" />

              <!-- Responsável do imóvel (quando comprovante não está no nome) -->
              <div v-if="comprovanteNaoCliente" class="resp-imovel-box mt-4">
                <v-row dense>
                  <v-col cols="12" md="6">
                    <label class="field-label">Nome do responsável pelo imóvel *</label>
                    <v-text-field v-model="cad.responsavelImovelNome" class="compact-input" density="compact" :error-messages="errors.responsavelImovelNome" hide-details="auto" placeholder="Nome completo" variant="outlined" />
                  </v-col>
                  <v-col cols="12" md="6">
                    <label class="field-label">CPF do responsável pelo imóvel *</label>
                    <v-text-field :model-value="cad.responsavelImovelCpf" class="compact-input" density="compact" :error-messages="errors.responsavelImovelCpf" hide-details="auto" maxlength="14" placeholder="000.000.000-00" variant="outlined" @update:model-value="cad.responsavelImovelCpf = maskCPF($event)" />
                  </v-col>
                  <v-col cols="12">
                    <label class="field-label">Documento do responsável (opcional, múltiplos)</label>
                    <div v-if="cad.responsavelImovelDocs.length" class="docs-list mb-3">
                      <div v-for="doc in cad.responsavelImovelDocs" :key="doc.path" class="docs-list__item">
                        <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                          <img v-if="isImage(doc.name)" :src="doc.url" :alt="doc.name" class="docs-list__img">
                          <v-icon v-else :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                        </a>
                        <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                        <v-spacer />
                        <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeResponsavelDoc(doc)" />
                      </div>
                    </div>
                    <div
                      class="upload-zone"
                      :class="{ 'upload-zone--uploading': responsavelDocsUploading }"
                      @click="($refs.responsavelDocInput as HTMLInputElement)?.click()"
                      @dragover.prevent
                      @drop.prevent="onDropResponsavelDocs"
                    >
                      <input ref="responsavelDocInput" accept="image/*,.pdf,.doc,.docx" hidden multiple type="file" @change="onSelectResponsavelDocs">
                      <template v-if="responsavelDocsUploading">
                        <v-progress-circular color="primary" indeterminate size="24" width="2" />
                        <span class="upload-zone__title mt-2">Enviando...</span>
                      </template>
                      <template v-else>
                        <v-icon class="upload-zone__icon" icon="mdi-upload" />
                        <span class="upload-zone__title">Clique ou arraste para enviar</span>
                        <span class="upload-zone__hint">PDF, DOC, DOCX, JPG ou PNG — múltiplos arquivos</span>
                      </template>
                    </div>
                  </v-col>
                </v-row>
              </div>

              <!-- Questionário Patrimonial -->
              <template v-if="tipoKit !== 'previdenciario'">
                <h2 class="section-title mt-8">Declaração de Hipossuficiência</h2>
                <v-divider class="mb-5" />
                <div class="mb-4">
                  <label class="field-label">Possuo bens imóveis? (Casa, apartamento, terreno) *</label>
                  <v-radio-group v-model="cad.possuiImoveis" class="compact-radios" :error-messages="errors.possuiImoveis" hide-details="auto" inline>
                    <v-radio :value="true" label="Sim" />
                    <v-radio :value="false" label="Não" />
                  </v-radio-group>
                </div>
                <div class="mb-4">
                  <label class="field-label">Possuo bens móveis? (Carro, motocicleta, caminhão) *</label>
                  <v-radio-group v-model="cad.possuiMoveis" class="compact-radios" :error-messages="errors.possuiMoveis" hide-details="auto" inline>
                    <v-radio :value="true" label="Sim" />
                    <v-radio :value="false" label="Não" />
                  </v-radio-group>
                </div>
                <div class="mb-4">
                  <label class="field-label">Isento do IRPF? (Imposto de Renda Pessoa Física) *</label>
                  <v-radio-group v-model="cad.isentoIrpf" class="compact-radios" :error-messages="errors.isentoIrpf" hide-details="auto" inline>
                    <v-radio :value="true" label="Sim" />
                    <v-radio :value="false" label="Não" />
                  </v-radio-group>
                </div>
              </template>

              <!-- Contato -->
              <h2 class="section-title mt-8">Contato</h2>
              <v-divider class="mb-5" />

              <div v-for="(tel, i) in cad.telefones" :key="i" class="telefone-bloco mb-4">
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-body-2 text-medium-emphasis">
                    Telefone {{ i + 1 }}
                  </span>
                  <v-btn
                    v-if="cad.telefones.length > 1"
                    color="error"
                    icon="mdi-trash-can-outline"
                    size="x-small"
                    variant="text"
                    @click="removeTelefone(i)"
                  />
                </div>
                <v-row dense>
                  <v-col cols="12" md="6">
                    <label class="field-label">Telefone *</label>
                    <v-text-field
                      :model-value="tel.numero"
                      class="compact-input"
                      density="compact"
                      :error-messages="errors[`telefone_${i}`]"
                      hide-details="auto"
                      placeholder="(49) 99999-9999"
                      variant="outlined"
                      @update:model-value="tel.numero = maskPhone($event)"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <label class="field-label">O titular do número é o cliente? *</label>
                    <v-select
                      v-model="tel.titularContato"
                      class="compact-input"
                      density="compact"
                      :error-messages="errors[`titularContato_${i}`]"
                      hide-details="auto"
                      :items="opcoesTitularContato"
                      placeholder="Selecione"
                      variant="outlined"
                    />
                  </v-col>
                </v-row>

                <v-row v-if="tel.titularContato === 'nao'" class="mt-1" dense>
                  <v-col cols="12" md="4">
                    <label class="field-label">Nome do titular do número *</label>
                    <v-text-field
                      v-model="tel.nomeTitularNumero"
                      class="compact-input"
                      density="compact"
                      :error-messages="errors[`nomeTitularNumero_${i}`]"
                      hide-details="auto"
                      placeholder="Nome completo"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <label class="field-label">Relação com o cliente *</label>
                    <v-select
                      v-model="tel.relacaoTitularTipo"
                      class="compact-input"
                      density="compact"
                      :error-messages="errors[`relacaoTitularTipo_${i}`]"
                      hide-details="auto"
                      :items="opcoesRelacaoTitular"
                      placeholder="Selecione"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col v-if="tel.relacaoTitularTipo === 'outro'" cols="12" md="4">
                    <label class="field-label">Qual relação? *</label>
                    <v-text-field
                      v-model="tel.relacaoTitular"
                      class="compact-input"
                      density="compact"
                      :error-messages="errors[`relacaoTitular_${i}`]"
                      hide-details="auto"
                      placeholder="Informe a relação"
                      variant="outlined"
                    />
                  </v-col>
                </v-row>
              </div>

              <div class="mb-2">
                <span class="add-acao-link" @click="addTelefone">+ Adicionar telefone</span>
              </div>

              </template><!-- /clienteEncontrado || isEditMode -->

            </v-window-item>

            <!-- ═══════════════ STEP 2: AÇÕES ═══════════════ -->
            <v-window-item value="acoes">
              <div class="d-flex align-center justify-space-between mb-2">
                <h2 class="section-title mb-0">Ações do Cliente</h2>
                <span v-if="acoes.length === 0" class="add-acao-link" @click="addAcao">+ Adicionar ação</span>
              </div>
              <v-divider class="mb-5" />

              <v-alert v-if="acoes.length === 0" class="mb-4" color="info" icon="mdi-information-outline" variant="tonal">
                Nenhuma ação cadastrada. Clique em "+ Adicionar ação" para começar.
              </v-alert>

              <div v-for="(acao, i) in acoes" :key="i" class="acao-card mb-4">
                <div class="d-flex align-center justify-space-between mb-4">
                  <span class="acao-card__title">Ação {{ i + 1 }}</span>
                  <v-icon class="acao-card__delete" icon="mdi-trash-can-outline" size="18" @click="removeAcao(i)" />
                </div>

                <label class="field-label">Tipo de ação *</label>
                <v-select
                  :model-value="acao.tipoAcao"
                  class="compact-input mb-4"
                  density="compact"
                  :error-messages="acoesErrors[i]?.tipoAcao"
                  hide-details="auto"
                  :items="TIPOS_ACAO"
                  item-title="label"
                  item-value="value"
                  placeholder="Selecione"
                  variant="outlined"
                  @update:model-value="updateAcao(i, 'tipoAcao', $event)"
                />

                <template v-if="acao.tipoAcao !== 'contribuicao_sindical_nao_autorizada'">
                  <label class="field-label">Banco</label>
                  <v-autocomplete
                    :model-value="acao.nomeBanco"
                    auto-select-first
                    class="compact-input mb-4"
                    clearable
                    density="compact"
                    :error-messages="acoesErrors[i]?.nomeBanco"
                    hide-details="auto"
                    :items="bancosOptions"
                    no-data-text="Nenhum banco encontrado"
                    placeholder="Digite para buscar"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'nomeBanco', $event)"
                  />

                  <!-- Banco outro -->
                  <template v-if="acao.nomeBanco === 'Outro'">
                    <label class="field-label">Nome do banco *</label>
                    <v-text-field
                      :model-value="acao.bancoOutro"
                      class="compact-input mb-4"
                      density="compact"
                      :error-messages="acoesErrors[i]?.bancoOutro"
                      hide-details="auto"
                      placeholder="Informe o nome do banco"
                      variant="outlined"
                      @update:model-value="updateAcao(i, 'bancoOutro', $event)"
                    />
                  </template>
                </template>

                <!-- Número do contrato (tipos com contrato) -->
                <template v-if="acaoNeedsContrato(acao.tipoAcao)">
                  <label class="field-label">Número do contrato *</label>
                  <v-text-field
                    :model-value="acao.numeroContrato"
                    class="compact-input mb-4"
                    density="compact"
                    :error-messages="acoesErrors[i]?.numeroContrato"
                    hide-details="auto"
                    placeholder="Número do contrato"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'numeroContrato', $event)"
                  />

                  <v-row dense>
                    <v-col cols="12" md="6">
                      <label class="field-label">Histórico de empréstimo (opcional)</label>
                      <div v-if="acaoDocs(acao, 'historicoEmprestimo').existing.length" class="docs-list mb-2">
                        <div v-for="doc in acaoDocs(acao, 'historicoEmprestimo').existing" :key="doc.path" class="docs-list__item">
                          <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                            <v-icon :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                          </a>
                          <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                          <v-spacer />
                          <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeAcaoUpload(i, 'historicoEmprestimo', doc.path)" />
                        </div>
                      </div>
                      <label class="upload-inline upload-inline--boxed">
                        <input accept="image/*,.pdf,.doc,.docx" hidden multiple type="file" @change="onSelectAcaoUpload(i, 'historicoEmprestimo', $event)">
                        <v-icon color="primary" icon="mdi-upload" size="small" />
                        <span>Clique para enviar arquivos</span>
                      </label>
                    </v-col>
                    <v-col cols="12" md="6">
                      <label class="field-label">Histórico de crédito (opcional)</label>
                      <div v-if="acaoDocs(acao, 'historicoCredito').existing.length" class="docs-list mb-2">
                        <div v-for="doc in acaoDocs(acao, 'historicoCredito').existing" :key="doc.path" class="docs-list__item">
                          <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                            <v-icon :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                          </a>
                          <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                          <v-spacer />
                          <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeAcaoUpload(i, 'historicoCredito', doc.path)" />
                        </div>
                      </div>
                      <label class="upload-inline upload-inline--boxed">
                        <input accept="image/*,.pdf,.doc,.docx" hidden multiple type="file" @change="onSelectAcaoUpload(i, 'historicoCredito', $event)">
                        <v-icon color="primary" icon="mdi-upload" size="small" />
                        <span>Clique para enviar arquivos</span>
                      </label>
                    </v-col>
                  </v-row>
                </template>

                <!-- Tarifa bancária -->
                <template v-if="acao.tipoAcao === 'tarifa_bancaria'">
                  <label class="field-label">Tarifa questionada *</label>
                  <v-select
                    :model-value="acao.tarifaQuestionada"
                    class="compact-input mb-4"
                    density="compact"
                    :error-messages="acoesErrors[i]?.tarifaQuestionada"
                    hide-details="auto"
                    :items="tarifasOptions"
                    placeholder="Selecione a tarifa"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'tarifaQuestionada', $event)"
                  />
                  <template v-if="acao.tarifaQuestionada === 'OUTROS'">
                    <label class="field-label">Qual tarifa? *</label>
                    <v-text-field
                      :model-value="acao.tarifaQuestionadaOutro"
                      class="compact-input mb-4"
                      density="compact"
                      :error-messages="acoesErrors[i]?.tarifaQuestionadaOutro"
                      hide-details="auto"
                      placeholder="Descreva a outra tarifa"
                      variant="outlined"
                      @update:model-value="updateAcao(i, 'tarifaQuestionadaOutro', $event)"
                    />
                  </template>

                  <label class="field-label">Extrato bancário (opcional)</label>
                  <div v-if="acaoDocs(acao, 'extratoBancario').existing.length" class="docs-list mb-2">
                    <div v-for="doc in acaoDocs(acao, 'extratoBancario').existing" :key="doc.path" class="docs-list__item">
                      <a :href="doc.url" class="docs-list__thumb" target="_blank" @click.stop>
                        <v-icon :color="/\\.pdf$/i.test(doc.name) ? 'error' : 'primary'" :icon="docIcon(doc.name)" size="28" />
                      </a>
                      <a :href="doc.url" class="docs-list__name" target="_blank" @click.stop>{{ doc.name }}</a>
                      <v-spacer />
                      <v-btn color="error" icon="mdi-close" size="x-small" variant="text" @click="removeAcaoUpload(i, 'extratoBancario', doc.path)" />
                    </div>
                  </div>
                  <label class="upload-inline upload-inline--boxed">
                    <input accept="image/*,.pdf,.doc,.docx" hidden multiple type="file" @change="onSelectAcaoUpload(i, 'extratoBancario', $event)">
                    <v-icon color="primary" icon="mdi-upload" size="small" />
                    <span>Clique para enviar arquivos</span>
                  </label>
                </template>

                <!-- Seguro não autorizado -->
                <template v-if="acao.tipoAcao === 'seguro_nao_autorizado'">
                  <label class="field-label">Tipo de seguro *</label>
                  <v-textarea
                    :model-value="acao.tipoSeguro"
                    class="compact-input"
                    density="compact"
                    :error-messages="acoesErrors[i]?.tipoSeguro"
                    hide-details="auto"
                    placeholder="Descreva o tipo de seguro"
                    rows="2"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'tipoSeguro', $event)"
                  />
                </template>

                <!-- Contribuição sindical: associação (apenas kit bancário) -->
                <template v-if="acao.tipoAcao === 'contribuicao_sindical_nao_autorizada' && tipoKit === 'bancario'">
                  <label class="field-label">Associação</label>
                  <v-select
                    :model-value="acao.associacaoId"
                    class="compact-input"
                    clearable
                    density="compact"
                    hide-details="auto"
                    item-title="label"
                    item-value="id"
                    :items="associacoesSelectItems"
                    :no-data-text="'Nenhuma associação cadastrada'"
                    placeholder="Selecione a associação"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'associacaoId', $event ?? null)"
                  />
                </template>

                <!-- Contribuição sindical: tipo livre (apenas kit marketing) -->
                <template v-if="acao.tipoAcao === 'contribuicao_sindical_nao_autorizada' && tipoKit === 'marketing'">
                  <label class="field-label">Tipo de contribuição *</label>
                  <v-textarea
                    :model-value="acao.tipoContribuicao"
                    class="compact-input"
                    density="compact"
                    :error-messages="acoesErrors[i]?.tipoContribuicao"
                    hide-details="auto"
                    placeholder="Descreva o tipo de contribuição"
                    rows="2"
                    variant="outlined"
                    @update:model-value="updateAcao(i, 'tipoContribuicao', $event)"
                  />
                </template>
              </div>

              <v-btn v-if="acoes.length > 0" class="add-acao-link" variant="tonal" prepend-icon="mdi-plus" @click="addAcao">Adicionar ação</v-btn>
            </v-window-item>

            <!-- ═══════════════ STEP: ADVOGADOS ═══════════════ -->
            <v-window-item value="advogados">
              <h2 class="section-title">Advogados do Kit</h2>
              <v-divider class="mb-3" />
              <p class="text-body-2 text-medium-emphasis mb-4">
                Selecione os advogados que vão constar no contrato e procuração.
                A pré-seleção segue a regra padrão (sócios da UF + não-sócios que atuam
                no tipo de ação). Você pode remover ou adicionar livremente.
              </p>

              <v-alert
                v-if="advogadosWarnings.length"
                class="mb-3"
                closable
                type="warning"
                variant="tonal"
                @click:close="advogadosWarnings = []"
              >
                <div v-for="(w, i) in advogadosWarnings" :key="i">{{ w }}</div>
              </v-alert>

              <div v-if="advogadosLoading" class="text-center py-8">
                <v-progress-circular color="primary" indeterminate size="36" />
                <div class="mt-2 text-body-2 text-medium-emphasis">Carregando advogados...</div>
              </div>

              <!-- Mobile: tabs -->
              <template v-else-if="advsKanbanMobile">
                <v-tabs v-model="advogadosTabMobile" color="primary" grow>
                  <v-tab value="disponiveis">
                    Disponíveis ({{ advogadosDisponiveis.length }})
                  </v-tab>
                  <v-tab value="selecionados">
                    Selecionados ({{ advogadosSelecionados.length }})
                  </v-tab>
                </v-tabs>
                <v-window v-model="advogadosTabMobile" class="mt-3">
                  <v-window-item value="disponiveis">
                    <v-text-field
                      v-model="advogadosBusca"
                      class="mb-2"
                      clearable
                      density="compact"
                      hide-details
                      placeholder="Buscar por nome, escritório ou OAB..."
                      prepend-inner-icon="mdi-magnify"
                    />
                    <div v-if="!advogadosDisponiveis.length" class="empty-coluna">
                      Nenhum advogado disponível.
                    </div>
                    <div
                      v-for="adv in advogadosDisponiveis"
                      :key="adv.id"
                      class="adv-card"
                    >
                      <div class="adv-card__info">
                        <div class="adv-card__nome">
                          {{ adv.nome_completo }}
                          <v-chip
                            v-if="adv.is_socio"
                            class="ml-1"
                            color="secondary"
                            size="x-small"
                            variant="tonal"
                          >
                            Sócio
                          </v-chip>
                        </div>
                        <div class="adv-card__sub">
                          <span>{{ getOabExibida(adv).texto }}</span>
                        </div>
                      </div>
                      <v-btn icon="mdi-plus" size="small" variant="text" color="primary" @click="adicionarAdvogado(adv.id)" />
                    </div>
                  </v-window-item>
                  <v-window-item value="selecionados">
                    <div v-if="!advogadosSelecionados.length" class="empty-coluna">
                      Nenhum advogado selecionado.
                    </div>
                    <div
                      v-for="adv in advogadosSelecionados"
                      :key="adv.id"
                      class="adv-card adv-card--selecionado"
                    >
                      <div class="adv-card__info">
                        <div class="adv-card__nome">
                          {{ adv.nome_completo }}
                          <v-chip
                            v-if="adv.is_socio"
                            class="ml-1"
                            color="secondary"
                            size="x-small"
                            variant="tonal"
                          >
                            Sócio
                          </v-chip>
                        </div>
                        <div class="adv-card__sub">
                          <span>{{ getOabExibida(adv).texto }}</span>
                        </div>
                      </div>
                      <v-btn icon="mdi-minus" size="small" variant="text" color="error" @click="removerAdvogado(adv.id)" />
                    </div>
                  </v-window-item>
                </v-window>
              </template>

              <!-- Desktop: kanban duas colunas com drag-and-drop -->
              <div v-else class="adv-kanban">
                <div class="adv-coluna">
                  <div class="adv-coluna__header">
                    <v-icon icon="mdi-drag-vertical" size="18" />
                    Disponíveis
                    <v-chip size="small" variant="tonal">{{ advogadosDisponiveis.length }}</v-chip>
                  </div>
                  <div class="adv-coluna__body">
                    <v-text-field
                      v-model="advogadosBusca"
                      class="mb-2"
                      clearable
                      density="compact"
                      hide-details
                      placeholder="Buscar por nome, escritório ou OAB..."
                      prepend-inner-icon="mdi-magnify"
                    />
                    <div v-if="!advogadosDisponiveis.length" class="empty-coluna">
                      Nenhum advogado disponível.
                    </div>
                    <draggable
                      :list="advogadosDisponiveis"
                      class="adv-dropzone"
                      group="advogados"
                      item-key="id"
                      :animation="180"
                      ghost-class="adv-card--ghost"
                      drag-class="adv-card--dragging"
                      @end="onAdvDragEnd"
                    >
                      <template #item="{ element: adv }">
                        <div v-show="advCardVisivel(adv)" class="adv-card adv-card--draggable">
                          <v-icon class="adv-card__handle" icon="mdi-drag" size="16" />
                          <div class="adv-card__info">
                            <div class="adv-card__nome">
                              {{ adv.nome_completo }}
                              <v-chip
                                v-if="adv.is_socio"
                                class="ml-1"
                                color="secondary"
                                size="x-small"
                                variant="tonal"
                              >
                                Sócio
                              </v-chip>
                            </div>
                            <div class="adv-card__sub">
                              <span>{{ getOabExibida(adv).texto }}</span>
                            </div>
                          </div>
                          <v-btn icon="mdi-plus" size="small" variant="text" color="primary" @click="adicionarAdvogado(adv.id)" />
                        </div>
                      </template>
                    </draggable>
                  </div>
                </div>

                <div class="adv-coluna">
                  <div class="adv-coluna__header">
                    <v-icon icon="mdi-check-circle-outline" size="18" />
                    Selecionados
                    <v-chip color="primary" size="small" variant="tonal">{{ advogadosSelecionados.length }}</v-chip>
                  </div>
                  <div class="adv-coluna__body">
                    <div v-if="!advogadosSelecionados.length" class="empty-coluna">
                      Arraste um advogado pra cá ou use o botão "+".
                    </div>
                    <draggable
                      :list="advogadosSelecionados"
                      class="adv-dropzone"
                      group="advogados"
                      item-key="id"
                      :animation="180"
                      ghost-class="adv-card--ghost"
                      drag-class="adv-card--dragging"
                      @end="onAdvDragEnd"
                    >
                      <template #item="{ element: adv }">
                        <div class="adv-card adv-card--selecionado adv-card--draggable">
                          <v-icon class="adv-card__handle" icon="mdi-drag" size="16" />
                          <div class="adv-card__info">
                            <div class="adv-card__nome">
                              {{ adv.nome_completo }}
                              <v-chip
                                v-if="adv.is_socio"
                                class="ml-1"
                                color="secondary"
                                size="x-small"
                                variant="tonal"
                              >
                                Sócio
                              </v-chip>
                            </div>
                            <div class="adv-card__sub">
                              <span>{{ getOabExibida(adv).texto }}</span>
                            </div>
                          </div>
                          <v-btn icon="mdi-minus" size="small" variant="text" color="error" @click="removerAdvogado(adv.id)" />
                        </div>
                      </template>
                    </draggable>
                  </div>
                </div>
              </div>
            </v-window-item>

            <!-- ═══════════════ STEP 3: KIT FINAL ═══════════════ -->
            <v-window-item value="kit-final">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center ga-2 flex-wrap">
                  <h2 class="section-title mb-0">Pré-visualização dos Documentos</h2>
                  <v-btn
                    v-if="kitTemplatesVisiveis.length"
                    color="primary"
                    :loading="downloadAllDocLoading"
                    prepend-icon="mdi-file-word-outline"
                    size="small"
                    variant="tonal"
                    @click="downloadAllDoc"
                  >
                    Baixar tudo (.docx)
                  </v-btn>
                  <v-btn
                    v-if="kitTemplatesVisiveis.length"
                    color="error"
                    :loading="downloadAllPdfLoading"
                    prepend-icon="mdi-file-pdf-box"
                    size="small"
                    variant="tonal"
                    @click="downloadAllPdf"
                  >
                    Baixar tudo (.pdf)
                  </v-btn>
                </div>
                <v-chip v-if="cad.status === 'assinado'" color="success" prepend-icon="mdi-check-circle" variant="tonal">
                  Assinado
                </v-chip>
              </div>
              <v-divider class="mb-5" />

              <template v-if="kitTemplatesVisiveis.length > 0">
                <v-tabs v-model="docTab" bg-color="transparent" color="primary" density="compact">
                  <v-tab v-for="t in kitTemplatesVisiveis" :key="t.key" :value="t.key" class="text-none">
                    {{ t.label }}
                  </v-tab>
                </v-tabs>

                <v-window v-model="docTab" class="mt-4">
                  <v-window-item v-for="t in kitTemplatesVisiveis" :key="t.key" :value="t.key">
                    <!-- Loading (geração no servidor) -->
                    <div v-if="docLoading[t.key]" class="d-flex flex-column align-center justify-center py-12">
                      <v-progress-circular color="primary" indeterminate size="48" width="4" />
                      <div class="text-body-2 text-medium-emphasis mt-4">Gerando {{ t.label }}...</div>
                    </div>

                    <!-- Error: template file missing -->
                    <v-alert v-else-if="docErrors[t.key] === '__NOT_FOUND__'" class="mb-4" type="warning" variant="tonal">
                      <div class="font-weight-bold mb-1">Arquivo do template não encontrado</div>
                      <div class="text-body-2">
                        O modelo "{{ t.label }}" precisa ser enviado novamente.
                        Acesse a página de Templates e faça o upload do arquivo .docx.
                      </div>
                    </v-alert>

                    <!-- Error: generic — preview falhou; ainda permitimos baixar o Word -->
                    <v-alert v-else-if="docErrors[t.key]" class="mb-4" type="error" variant="tonal">
                      {{ docErrors[t.key] }}
                      <template #append>
                        <div class="d-flex ga-2">
                          <v-btn
                            :loading="docxLoading[t.key]"
                            prepend-icon="mdi-file-word-outline"
                            size="small"
                            variant="text"
                            @click="downloadDoc(t.key)"
                          >
                            Baixar .docx
                          </v-btn>
                          <v-btn size="small" variant="text" @click="renderDocTemplate(t.id, t.key)">Tentar novamente</v-btn>
                        </div>
                      </template>
                    </v-alert>

                    <!-- Preview -->
                    <template v-else>
                      <div class="d-flex justify-end ga-2 mb-3">
                        <v-btn
                          color="primary"
                          :disabled="!pdfBlobs[t.key]"
                          :loading="docxLoading[t.key]"
                          prepend-icon="mdi-file-word-outline"
                          size="small"
                          variant="tonal"
                          @click="downloadDoc(t.key)"
                        >
                          .docx
                        </v-btn>
                        <v-btn
                          color="error"
                          :disabled="!pdfBlobs[t.key]"
                          :loading="pdfLoading[t.key]"
                          prepend-icon="mdi-file-pdf-box"
                          size="small"
                          variant="tonal"
                          @click="downloadPdf(t.key)"
                        >
                          .pdf
                        </v-btn>
                        <v-btn
                          prepend-icon="mdi-refresh"
                          size="small"
                          variant="text"
                          @click="renderDocTemplate(t.id, t.key)"
                        >
                          Atualizar
                        </v-btn>
                      </div>
                      <div class="docx-container-wrapper">
                        <div :ref="(el: any) => { docxContainers[t.key] = el }" class="docx-container" />
                        <div v-if="iframeLoading[t.key]" class="docx-iframe-loading">
                          <v-progress-circular color="primary" indeterminate size="48" width="4" />
                          <div class="text-body-2 text-medium-emphasis mt-4">Renderizando {{ t.label }}...</div>
                        </div>
                      </div>
                    </template>
                  </v-window-item>
                </v-window>

              </template>

              <!-- Documentos Assinados via ZapSign -->
              <div v-if="documentosAssinados.length" class="mt-6">
                <v-divider class="mb-4" />
                <div class="d-flex align-center ga-2 mb-3">
                  <v-icon color="success" icon="mdi-check-circle" />
                  <span class="text-subtitle-1 font-weight-medium">Documentos Assinados</span>
                </div>
                <v-list density="compact" lines="one" rounded="lg" border>
                  <v-list-item
                    v-for="doc in documentosAssinados"
                    :key="doc.id"
                    :prepend-icon="'mdi-file-pdf-box'"
                    :title="doc.tipo_display"
                  >
                    <template #append>
                      <v-btn
                        color="primary"
                        density="compact"
                        prepend-icon="mdi-download"
                        size="small"
                        variant="tonal"
                        :href="doc.arquivo"
                        target="_blank"
                      >
                        Baixar
                      </v-btn>
                    </template>
                  </v-list-item>
                </v-list>
              </div>

              <!-- Botões de assinatura -->
              <div v-if="cad.status !== 'assinado'" class="d-flex justify-center align-center ga-3 mt-6 flex-wrap">
                <v-chip
                  v-if="zapsignStatus === 'pending'"
                  color="warning"
                  prepend-icon="mdi-clock-outline"
                  variant="tonal"
                >
                  Aguardando assinatura no ZapSign
                </v-chip>

                <v-btn
                  color="primary"
                  :disabled="saving"
                  prepend-icon="mdi-draw"
                  size="large"
                  variant="tonal"
                  @click="abrirDialogZapSign"
                >
                  {{ zapsignStatus === 'pending' ? 'Ver links ZapSign' : 'Gerar Assinatura pelo ZapSign' }}
                </v-btn>

                <v-btn color="success" :disabled="saving" prepend-icon="mdi-pen" size="large" variant="tonal" @click="marcarAssinado">
                  Marcar como Assinado
                </v-btn>
              </div>

              <!-- Dialog ZapSign: 2 passos (configurar → links) -->
              <v-dialog v-model="zapsignDialog" max-width="560" persistent>
                <v-card rounded="lg">
                  <v-card-title class="d-flex align-center ga-2 pt-4 px-6">
                    <v-icon color="primary" :icon="zapsignStep === 1 ? 'mdi-shield-check-outline' : 'mdi-draw'" />
                    {{ zapsignStep === 1 ? 'Configurar Assinatura' : 'Links de Assinatura' }}
                  </v-card-title>

                  <v-window v-model="zapsignStep">
                    <!-- Passo 1: configuração de segurança -->
                    <v-window-item :value="1">
                      <v-card-text class="px-6 pt-2 pb-2">
                        <p class="text-body-2 text-medium-emphasis mb-4">
                          Escolha o nível de segurança para a assinatura eletrônica.
                        </p>

                        <!-- Nível de segurança -->
                        <div class="d-flex flex-column ga-2 mb-4">
                          <v-card
                            v-for="op in [
                              { value: 'basico', icon: 'mdi-pen', label: 'Básico', desc: 'Assinatura desenhada na tela' },
                              { value: 'medio', icon: 'mdi-shield-half-full', label: 'Médio', desc: 'Assinatura na tela + token de verificação' },
                              { value: 'avancado', icon: 'mdi-shield-check', label: 'Avançado', desc: 'Assinatura na tela + selfie + foto do documento' },
                            ]"
                            :key="op.value"
                            :color="zapsignNivel === op.value ? 'primary' : undefined"
                            :variant="zapsignNivel === op.value ? 'tonal' : 'outlined'"
                            class="cursor-pointer"
                            rounded="lg"
                            @click="zapsignNivel = op.value as any"
                          >
                            <v-card-text class="d-flex align-center ga-3 py-3">
                              <v-icon :icon="op.icon" size="24" />
                              <div class="flex-1-1">
                                <div class="font-weight-medium text-body-1">{{ op.label }}</div>
                                <div class="text-body-2 text-medium-emphasis">{{ op.desc }}</div>
                              </div>
                              <v-icon
                                :icon="zapsignNivel === op.value ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                                :color="zapsignNivel === op.value ? 'primary' : 'default'"
                              />
                            </v-card-text>
                          </v-card>
                        </div>

                        <!-- Token: email ou SMS (apenas para Médio) -->
                        <v-expand-transition>
                          <div v-if="zapsignNivel === 'medio'" class="mb-4">
                            <p class="text-body-2 font-weight-medium mb-2">Método de verificação</p>
                            <v-btn-toggle
                              v-model="zapsignMedioTipo"
                              class="w-100"
                              color="primary"
                              density="comfortable"
                              divided
                              mandatory
                              rounded="lg"
                              variant="outlined"
                            >
                              <v-btn value="email" class="flex-1-1" prepend-icon="mdi-email-outline">
                                Token por E-mail
                              </v-btn>
                              <v-btn value="sms" class="flex-1-1" prepend-icon="mdi-message-outline">
                                Token por SMS
                              </v-btn>
                            </v-btn-toggle>
                          </div>
                        </v-expand-transition>

                        <v-divider class="mb-3" />

                        <!-- Rubrica -->
                        <v-switch
                          v-model="zapsignComRubrica"
                          color="primary"
                          density="compact"
                          hide-details
                          label="Adicionar rubrica nas primeiras 2 páginas"
                        />
                      </v-card-text>
                      <v-card-actions class="px-6 pb-4">
                        <v-btn variant="text" @click="zapsignDialog = false">Cancelar</v-btn>
                        <v-spacer />
                        <v-btn
                          color="primary"
                          :loading="zapsignLoading"
                          prepend-icon="mdi-draw"
                          variant="flat"
                          @click="confirmarEnvioZapSign"
                        >
                          Gerar Assinatura
                        </v-btn>
                      </v-card-actions>
                    </v-window-item>

                    <!-- Passo 2: link único de assinatura -->
                    <v-window-item :value="2">
                      <v-card-text class="px-6 pt-2 pb-2">
                        <p class="text-body-2 text-medium-emphasis mb-4">
                          Compartilhe o link abaixo com o cliente. Ele abrirá todos os documentos em sequência para assinar de uma vez.
                        </p>

                        <!-- Link único destacado -->
                        <v-card variant="tonal" color="primary" rounded="lg" class="mb-4">
                          <v-card-text class="pa-3">
                            <p class="text-caption text-medium-emphasis mb-1">Link de assinatura</p>
                            <p class="text-body-2 font-weight-medium text-truncate mb-3">
                              {{ zapsignSignUrl }}
                            </p>
                            <div class="d-flex ga-2 flex-wrap">
                              <v-btn
                                :color="zapsignCopied ? 'success' : 'primary'"
                                :prepend-icon="zapsignCopied ? 'mdi-check' : 'mdi-content-copy'"
                                density="comfortable"
                                variant="flat"
                                size="small"
                                @click="copiarLinkZapSign"
                              >
                                {{ zapsignCopied ? 'Copiado!' : 'Copiar link' }}
                              </v-btn>
                              <v-btn
                                color="primary"
                                density="comfortable"
                                prepend-icon="mdi-open-in-new"
                                variant="outlined"
                                size="small"
                                :href="zapsignSignUrl ?? undefined"
                                target="_blank"
                              >
                                Abrir
                              </v-btn>
                              <v-btn
                                color="success"
                                density="comfortable"
                                prepend-icon="mdi-whatsapp"
                                variant="outlined"
                                size="small"
                                @click="compartilharWhatsAppTodos"
                              >
                                WhatsApp
                              </v-btn>
                            </div>
                          </v-card-text>
                        </v-card>

                        <!-- Lista de documentos incluídos -->
                        <p class="text-caption text-medium-emphasis mb-2">
                          Documentos incluídos neste link ({{ zapsignDocumentos.length }}):
                        </p>
                        <v-list density="compact" class="pa-0 bg-transparent">
                          <v-list-item
                            v-for="doc in zapsignDocumentos"
                            :key="doc.tipo"
                            :prepend-icon="'mdi-file-document-outline'"
                            class="px-0"
                          >
                            <v-list-item-title class="text-body-2">
                              {{ doc.tipo_display }}
                            </v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-card-text>
                      <v-card-actions class="px-6 pb-4">
                        <v-btn prepend-icon="mdi-arrow-left" variant="text" @click="zapsignStep = 1">
                          Reconfigurar
                        </v-btn>
                        <v-spacer />
                        <v-btn
                          color="primary"
                          :loading="zapsignVerificandoStatus"
                          prepend-icon="mdi-refresh"
                          variant="tonal"
                          @click="verificarStatusZapSign"
                        >
                          Verificar Status
                        </v-btn>
                        <v-btn variant="text" @click="zapsignDialog = false">Fechar</v-btn>
                      </v-card-actions>
                    </v-window-item>
                  </v-window>
                </v-card>
              </v-dialog>

              <!-- Sem dados -->
              <v-alert v-if="!kitTemplatesVisiveis.length && !acoes.length" color="info" icon="mdi-information-outline" variant="tonal">
                Preencha o cadastro para gerar os documentos.
              </v-alert>
            </v-window-item>

          </v-window>
        </v-card-text>
      </v-card>

      <!-- Action buttons -->
      <div class="d-flex align-center mt-4 mb-2 sticky-actions">
        <v-btn :disabled="etapaIndex <= 0" prepend-icon="mdi-arrow-left" variant="outlined" @click="etapaAnterior">
          Anterior
        </v-btn>
        <v-spacer />
        <span v-if="saving && savingMessage" class="text-caption text-medium-emphasis mr-3">
          {{ savingMessage }}
        </span>
        <v-btn v-if="etapaAtual !== 'kit-final'" :disabled="!podeAvancar || saving" :loading="saving" append-icon="mdi-arrow-right" color="primary" @click="avancarComPersistencia">
          Próximo
        </v-btn>
        <v-btn
          v-else
          v-show="can('kits.editar') || can('kits.criar')"
          color="success"
          :disabled="saving"
          :loading="saving"
          prepend-icon="mdi-check"
          @click="finalizarKit"
        >
          Finalizar Kit
        </v-btn>
      </div>
    </div>
    <!-- ━━━ SidePanel cadastrar cliente ━━━ -->
    <SidePanel v-model="drawerCadastro" :width="720">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon icon="mdi-account-plus-outline" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">Novo cliente</div>
          <div class="text-caption text-medium-emphasis">Cadastrar cliente para o kit</div>
        </div>
      </template>

      <v-tabs v-model="drawerTab" color="primary">
        <v-tab prepend-icon="mdi-account-outline" value="pessoal">Dados Pessoais</v-tab>
        <v-tab prepend-icon="mdi-map-marker-outline" value="endereco">Endereço</v-tab>
      </v-tabs>

      <v-tabs-window v-model="drawerTab">
        <!-- Tab: Dados Pessoais -->
        <v-tabs-window-item value="pessoal">
          <v-form @submit.prevent="salvarClienteDrawer">
            <v-row dense>
              <v-col cols="12" md="8">
                <v-text-field v-model="drawerForm.nome_completo" :error-messages="drawerFieldErrors.nome_completo" label="Nome completo *" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field :model-value="drawerForm.cpf" :error-messages="drawerFieldErrors.cpf" label="CPF *" maxlength="14" placeholder="000.000.000-00" @update:model-value="drawerForm.cpf = maskCPF($event)" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="drawerForm.rg" :error-messages="drawerFieldErrors.rg" label="RG" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="drawerForm.orgao_expedidor" :error-messages="drawerFieldErrors.orgao_expedidor" label="Órgão expedidor" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="drawerForm.nacionalidade" :error-messages="drawerFieldErrors.nacionalidade" label="Nacionalidade" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="drawerForm.estado_civil" :error-messages="drawerFieldErrors.estado_civil" label="Estado civil" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="drawerForm.profissao" :error-messages="drawerFieldErrors.profissao" label="Profissão" />
              </v-col>
            </v-row>
          </v-form>
        </v-tabs-window-item>

        <!-- Tab: Endereço -->
        <v-tabs-window-item value="endereco">
          <v-form @submit.prevent="salvarClienteDrawer">
            <v-row dense>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="drawerForm.cep"
                  append-inner-icon="mdi-magnify"
                  label="CEP"
                  :loading="drawerCepLoading"
                  @blur="drawerLookupCEP"
                  @click:append-inner="drawerLookupCEP"
                />
                <div v-if="drawerCepStatus" class="text-caption text-medium-emphasis mt-n2 mb-2">{{ drawerCepStatus }}</div>
              </v-col>
              <v-col cols="12" md="5">
                <v-text-field v-model="drawerForm.logradouro" :error-messages="drawerFieldErrors.logradouro" label="Logradouro" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="drawerForm.numero" :error-messages="drawerFieldErrors.numero" label="Número" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="drawerForm.bairro" :error-messages="drawerFieldErrors.bairro" label="Bairro" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="drawerForm.cidade" :error-messages="drawerFieldErrors.cidade" label="Cidade" />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field v-model="drawerForm.uf" :error-messages="drawerFieldErrors.uf" label="UF" maxlength="2" />
              </v-col>
            </v-row>
          </v-form>
        </v-tabs-window-item>
      </v-tabs-window>

      <template #actions>
        <v-btn variant="text" @click="drawerCadastro = false">Cancelar</v-btn>
        <v-btn color="primary" prepend-icon="mdi-check" @click="salvarClienteDrawer">Salvar</v-btn>
      </template>
    </SidePanel>

    <!-- Modal: UF do cliente mudou após selecionar advogados -->
    <v-dialog v-model="trocaUfDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="warning" icon="mdi-alert-circle-outline" />
          UF do cliente foi alterada
        </v-card-title>
        <v-card-text>
          Você alterou a UF do cliente após ter escolhido os advogados deste kit.
          Deseja recalcular a seleção com base na nova UF, ou manter a seleção atual?
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="trocaUfDialog = false">Manter seleção atual</v-btn>
          <v-btn color="primary" prepend-icon="mdi-refresh" variant="elevated" @click="recalcularAdvogadosPorMudancaUf">
            Recalcular
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.novo-kit {
  background: #f7f8fb;
  min-height: calc(100vh - 64px);
}

.topbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
}

.topbar-title {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1;
}

.content-wrap {
  max-width: 1240px;
  margin: 0 auto;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 120px;
}

.step-line {
  width: 260px;
  max-width: 23vw;
  height: 2px;
  background: #e3e5ec;
  margin-top: -26px;
  transition: background 0.3s;
}

.step-line--done {
  background: #ffb322;
}

.step-icon {
  background: #eef0f5;
  color: #7b8191;
  transition: all 0.3s;
}

.step-icon--active {
  background: #ffb322;
  color: #fff;
  box-shadow: 0 0 0 3px rgba(255, 179, 34, 0.18);
}

.step-icon--done {
  background: #4caf50;
  color: #fff;
}

.step-label {
  font-size: 1rem;
  color: #616775;
  font-weight: 600;
}

.form-card {
  border-color: #e8e8ef !important;
  background: #fff;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.field-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2a2f3a;
  margin-bottom: 4px;
}

/* Foto 3x4 do cliente */
.foto-cliente-wrap {
  position: relative;
  width: 96px;
}
.foto-cliente-img {
  width: 96px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  display: block;
}
.foto-cliente-remove {
  position: absolute;
  top: -8px;
  right: -8px;
}
.foto-cliente-drop {
  width: 96px;
  aspect-ratio: 3 / 4;
  border: 2px dashed rgba(0, 0, 0, 0.22);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: #6b7280;
  transition: border-color 0.15s, background-color 0.15s;
}
.foto-cliente-drop:hover {
  border-color: #0F2B46;
  background-color: rgba(15, 43, 70, 0.04);
}
.foto-cliente-drop--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.foto-cliente-drop--disabled:hover {
  border-color: rgba(0, 0, 0, 0.22);
  background-color: transparent;
}
.foto-cliente-drop--uploading {
  cursor: progress;
}
.foto-cliente-hint {
  font-size: 0.72rem;
  text-align: center;
  line-height: 1.1;
}

.conditions-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

/* Garante que cada botão respeite a célula do grid e não estoure horizontal. */
.conditions-grid > .v-btn {
  min-width: 0;
  width: 100%;
}

.conditions-grid > .v-btn :deep(.v-btn__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.sticky-actions {
  position: sticky;
  bottom: 8px;
  background: rgba(247, 248, 251, 0.92);
  backdrop-filter: blur(2px);
  border: 1px solid #e8e8ef;
  border-radius: 4px;
  padding: 10px 12px;
}

.pessoa-card {
  border-color: #e8e8ef !important;
  background: #fcfcfd;
}

.pessoa-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pessoa-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2a2f3a;
}

.upload-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1.5px dashed #c8cdd8;
  border-radius: 4px;
  background: #f8f9fc;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font-size: 0.88rem;
  color: #5a6070;
}

.upload-inline:hover {
  border-color: #3b6cb4;
  background: #f0f4fb;
  color: #3b6cb4;
}

.upload-inline--boxed {
  width: 100%;
  justify-content: center;
}

.native-file-wrap {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafbfd;
}

.native-file-wrap input[type="file"] {
  font-size: 0.88rem;
  color: #5a6070;
}

.native-file-wrap input[type="file"]::file-selector-button {
  padding: 4px 12px;
  margin-right: 10px;
  border: 1px solid #d0d4dd;
  border-radius: 6px;
  background: #fff;
  color: #4a5060;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.native-file-wrap input[type="file"]::file-selector-button:hover {
  background: #f0f2f5;
}

.resp-imovel-box {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  background: #fff;
}

.add-acao-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b6cb4;
  cursor: pointer;
  transition: color 0.15s;
}

.add-acao-link:hover {
  color: #1e4a8a;
}

.acao-card {
  border: 1px solid #eaecf0;
  border-radius: 4px;
  padding: 24px;
  background: #fff;
}

.telefone-bloco {
  border: 1px solid #eaecf0;
  border-radius: 4px;
  padding: 16px;
  background: #fff;
}

.acao-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2a2f3a;
}

.acao-card__delete {
  color: #e57373;
  cursor: pointer;
  transition: color 0.15s;
}

.acao-card__delete:hover {
  color: #d32f2f;
}


.doc-chips {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-chips__label {
  font-size: 0.85rem;
  color: #8b91a0;
}

.docs-list__item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f8fafe;
  margin-bottom: 6px;
}

.docs-list__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f2f5;
  margin-right: 10px;
}

.docs-list__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.docs-list__name {
  font-size: 0.85rem;
  font-weight: 500;
  color: #0F2B46;
  text-decoration: none;
}

.docs-list__name:hover {
  text-decoration: underline;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 2px dashed #d0d4dd;
  border-radius: 4px;
  background: #fafbfd;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone:hover {
  border-color: #ffb322;
  background: #fffbf2;
}

.upload-zone--has-file {
  border-style: solid;
  border-color: #4caf50;
  background: #f4faf5;
  padding: 16px;
}

.upload-zone__icon {
  font-size: 36px;
  color: #9ca3b0;
}

.upload-zone:hover .upload-zone__icon {
  color: #ffb322;
}

.upload-zone__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #4a5060;
}

.upload-zone__hint {
  font-size: 0.8rem;
  color: #8b91a0;
}

.upload-zone__file {
  display: flex;
  align-items: center;
}

.upload-zone__filename {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2e7d32;
  word-break: break-all;
}

.docx-container-wrapper {
  position: relative;
}

.docx-iframe-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #eef1f6;
  border-radius: 10px;
  z-index: 2;
}

.docx-container {
  background: #eef1f6;
  border: 1px solid #d9dfeb;
  border-radius: 10px;
  height: 80vh;
  min-height: 600px;
  overflow: hidden;
}

.docx-container iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

:deep(.compact-input .v-field) {
  min-height: 40px !important;
}

:deep(.compact-input .v-field__input) {
  min-height: 40px !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}

:deep(.compact-radios .v-selection-control) {
  min-height: 30px;
}

@media (max-width: 960px) {
  .section-title {
    font-size: 1.1rem;
  }

  .topbar-title {
    font-size: 1.3rem;
  }

  .step-line {
    display: none;
  }

  .steps {
    justify-content: space-between;
  }

  .conditions-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* xs: phones — apertar paddings laterais e enxugar steps. */
@media (max-width: 599.98px) {
  /* O wrapper externo (v-container do MainLayout) já está px-1; aqui
     anulamos os px-6 utilitários internos pra ganhar largura. */
  .topbar.px-6 {
    padding-left: 12px !important;
    padding-right: 12px !important;
    height: 56px;
  }

  .content-wrap.px-6 {
    padding-left: 4px !important;
    padding-right: 4px !important;
    padding-top: 12px !important;
    padding-bottom: 12px !important;
  }

  /* Form card respira menos no mobile — derruba o pa-6/pa-md-7. */
  .form-card :deep(.v-card-text) {
    padding: 12px !important;
  }

  /* Pessoa-card e demais cards aninhados também ficam menores. */
  .pessoa-card :deep(.v-card-text) {
    padding: 12px !important;
  }

  .topbar-title {
    font-size: 1.05rem;
  }

  /* Steps mais compactos: avatar menor, label menor, sem min-width gigante. */
  .steps {
    gap: 4px;
  }

  .step {
    min-width: 0;
    flex: 1 1 0;
  }

  .step-icon {
    width: 36px !important;
    height: 36px !important;
  }

  .step-icon :deep(.v-icon) {
    font-size: 18px;
  }

  .step-label {
    font-size: 0.78rem;
    text-align: center;
    line-height: 1.15;
  }

  .conditions-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Etapa de Advogados (kanban) ─────────────────────────── */
.adv-kanban {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.adv-coluna {
  border: 1px solid #e8e8ef;
  border-radius: 10px;
  background: #fafbfd;
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.adv-coluna__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #e8e8ef;
  font-weight: 700;
  color: #0F2B46;
  font-size: 0.95rem;
}

.adv-coluna__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.adv-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e8e8ef;
  border-radius: 8px;
  transition: border-color 0.15s, background 0.15s;
}

.adv-card:hover {
  border-color: #cda660;
}

.adv-card--selecionado {
  background: rgba(205, 166, 96, 0.08);
  border-color: rgba(205, 166, 96, 0.35);
}

.adv-card__info {
  flex: 1;
  min-width: 0;
}

.adv-card__nome {
  font-weight: 600;
  font-size: 0.9rem;
  color: #2a2f3a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.adv-card__sub {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-coluna {
  text-align: center;
  color: #8a94a6;
  font-size: 0.85rem;
  padding: 24px 8px;
  border: 1.5px dashed #d4d8e0;
  border-radius: 8px;
}

.adv-dropzone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}

.adv-card--draggable {
  cursor: grab;
}

.adv-card--draggable:active {
  cursor: grabbing;
}

.adv-card__handle {
  color: #8a94a6;
  flex-shrink: 0;
}

.adv-card--draggable:hover .adv-card__handle {
  color: #0F2B46;
}

/* Item "fantasma" no destino enquanto arrasta. */
.adv-card--ghost {
  opacity: 0.4;
  background: rgba(205, 166, 96, 0.12) !important;
  border-style: dashed !important;
}

/* Item sendo arrastado (acompanha o cursor). */
.adv-card--dragging {
  transform: rotate(2deg);
  box-shadow: 0 8px 16px rgba(15, 43, 70, 0.2);
}
</style>

