import { emptyAcao, emptyCadastro, type Kit, type KitAcao, type KitCadastro, type KitStatus } from '@/types/kits'

let idSeq = 2

let db: Kit[] = [
  {
    id: 1,
    status: 'acoes',
    cadastro: {
      ...emptyCadastro(),
      nome: 'Gabriel Willian Dacaz',
      cpf: '110.646.299-89',
      genero: 'masculino',
      nacionalidadeTipo: 'brasileiro',
      estadoCivilTipo: 'solteiro',
      profissaoTipo: 'aposentado',
      condicaoCliente: 'alfabetizado',
      telefone: '(49) 99999-9999',
      titularContato: 'sim',
      rua: 'Rua das Flores',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Joaçaba',
      estado: 'SC',
      cep: '89600-000',
      comprovanteNomeCliente: 'sim',
      possuiImoveis: false,
      possuiMoveis: false,
      isentoIrpf: true,
      status: 'acoes',
    },
    acoes: [{
      ...emptyAcao(),
      tipoAcao: 'rmc',
      nomeBanco: 'Pan',
      numeroContrato: '123456789',
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function clone<T> (v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export async function listKitsMock (): Promise<Kit[]> {
  return clone(db)
}

export async function getKitMock (id: number): Promise<Kit | null> {
  const item = db.find(k => k.id === id) || null
  return clone(item)
}

export async function createKitMock (cadastro?: Partial<KitCadastro>): Promise<Kit> {
  const now = new Date().toISOString()
  const created: Kit = {
    id: idSeq++,
    status: 'rascunho',
    cadastro: { ...emptyCadastro(), ...(cadastro || {}) },
    acoes: [],
    createdAt: now,
    updatedAt: now,
  }
  db = [created, ...db]
  return clone(created)
}

export async function updateKitCadastroMock (id: number, cadastro: KitCadastro): Promise<Kit | null> {
  const idx = db.findIndex(k => k.id === id)
  if (idx === -1) return null
  db[idx] = {
    ...db[idx],
    cadastro: clone(cadastro),
    updatedAt: new Date().toISOString(),
  }
  return clone(db[idx])
}

export async function updateKitAcoesMock (id: number, acoes: KitAcao[]): Promise<Kit | null> {
  const idx = db.findIndex(k => k.id === id)
  if (idx === -1) return null
  db[idx] = {
    ...db[idx],
    status: 'acoes',
    acoes: clone(acoes),
    updatedAt: new Date().toISOString(),
  }
  return clone(db[idx])
}

export async function setKitStatusMock (id: number, status: KitStatus): Promise<Kit | null> {
  const idx = db.findIndex(k => k.id === id)
  if (idx === -1) return null
  db[idx] = {
    ...db[idx],
    status,
    updatedAt: new Date().toISOString(),
  }
  return clone(db[idx])
}
