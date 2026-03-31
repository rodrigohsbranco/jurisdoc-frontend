<script setup lang="ts">
import { computed, ref } from 'vue'

type Etapa = 'cadastro' | 'acoes' | 'kit-final'
type Binario = 'Sim' | 'Não' | ''

const etapas: Etapa[] = ['cadastro', 'acoes', 'kit-final']
const etapaAtual = ref<Etapa>('cadastro')
const etapaIndex = computed(() => etapas.indexOf(etapaAtual.value))

// Cadastro
const nomeCompleto = ref('')
const cpf = ref('')
const genero = ref('')
const nacionalidade = ref('')
const estadoCivil = ref('')
const profissao = ref('')
const condicaoCliente = ref('Alfabetizado')
const rua = ref('')
const numero = ref('')
const complemento = ref('')
const bairro = ref('')
const cidade = ref('')
const uf = ref('')
const cep = ref('')
const comprovanteResidencia = ref<File | null>(null)
const comprovanteNoNome = ref('')
const possuiImoveis = ref<Binario>('')
const possuiMoveis = ref<Binario>('')
const isentoIrpf = ref<Binario>('')
const telefoneCliente = ref('')
const titularContato = ref('')

// Ações
const tipoAcao = ref('')
const bancoAcao = ref('')
const numeroContrato = ref('')

const opcoesGenero = ['Masculino', 'Feminino', 'Outro']
const opcoesNacionalidade = ['Brasileira', 'Estrangeira']
const opcoesEstadoCivil = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)']
const opcoesProfissao = ['Aposentado(a)', 'Servidor(a) público(a)', 'Autônomo(a)', 'Outros']
const opcoesUf = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
const opcoesSimNao = ['Sim', 'Não']
const opcoesTitularContato = ['Cliente', 'Representante', 'Terceiro']
const opcoesTipoAcao = ['RMC', 'Portabilidade', 'Refinanciamento']
const opcoesBancoAcao = ['Banco PAN', 'Banco BMG', 'Banco Daycoval']

const isCadastroValido = computed(() => {
  return (
    !!nomeCompleto.value.trim() &&
    !!cpf.value.trim() &&
    !!genero.value &&
    !!nacionalidade.value &&
    !!estadoCivil.value &&
    !!profissao.value &&
    !!condicaoCliente.value &&
    !!rua.value.trim() &&
    !!numero.value.trim() &&
    !!bairro.value.trim() &&
    !!cidade.value.trim() &&
    !!uf.value &&
    !!cep.value.trim() &&
    !!comprovanteNoNome.value &&
    !!possuiImoveis.value &&
    !!possuiMoveis.value &&
    !!isentoIrpf.value &&
    !!telefoneCliente.value.trim() &&
    !!titularContato.value
  )
})

const isAcoesValido = computed(() => {
  return !!tipoAcao.value && !!bancoAcao.value && !!numeroContrato.value.trim()
})

const podeAvancar = computed(() => {
  if (etapaAtual.value === 'cadastro') return isCadastroValido.value
  if (etapaAtual.value === 'acoes') return isAcoesValido.value
  return false
})

function proximaEtapa () {
  if (!podeAvancar.value) return
  const next = etapaIndex.value + 1
  if (next < etapas.length) etapaAtual.value = etapas[next]
}

function etapaAnterior () {
  const prev = etapaIndex.value - 1
  if (prev >= 0) etapaAtual.value = etapas[prev]
}
</script>

<template>
  <v-container class="novo-kit pa-0" fluid>
    <div class="topbar px-6">
      <v-btn class="text-none" prepend-icon="mdi-arrow-left" slim variant="text" :to="{ name: 'producao-kits' }">
        Voltar
      </v-btn>
      <div class="topbar-title">Novo Kit</div>
      <div style="width: 70px" />
    </div>

    <v-divider />

    <div class="content-wrap px-6 py-6">
      <div class="steps mb-5">
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'cadastro' ? 'step-icon--active' : '']" size="44">
            <v-icon icon="mdi-account-outline" />
          </v-avatar>
          <span class="step-label">Cadastro</span>
        </div>
        <div class="step-line" />
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'acoes' ? 'step-icon--active' : '']" size="44">
            <v-icon icon="mdi-scale-balance" />
          </v-avatar>
          <span class="step-label">Ações</span>
        </div>
        <div class="step-line" />
        <div class="step">
          <v-avatar :class="['step-icon', etapaAtual === 'kit-final' ? 'step-icon--active' : '']" size="44">
            <v-icon icon="mdi-eye-outline" />
          </v-avatar>
          <span class="step-label">Kit Final</span>
        </div>
      </div>

      <v-card class="form-card" rounded="xl" variant="outlined">
        <v-card-text class="pa-6 pa-md-7">
          <v-window v-model="etapaAtual">
            <v-window-item value="cadastro">
              <h2 class="section-title">Dados Pessoais</h2>
              <v-divider class="mb-5" />

              <v-row dense>
                <v-col cols="12">
                  <label class="field-label">Nome do cliente *</label>
                  <v-text-field v-model="nomeCompleto" class="compact-input" density="compact" hide-details placeholder="Nome completo" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">CPF *</label>
                  <v-text-field v-model="cpf" class="compact-input" density="compact" hide-details placeholder="000.000.000-00" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Gênero *</label>
                  <v-select v-model="genero" :items="opcoesGenero" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Nacionalidade *</label>
                  <v-select v-model="nacionalidade" :items="opcoesNacionalidade" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Estado Civil *</label>
                  <v-select v-model="estadoCivil" :items="opcoesEstadoCivil" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Profissão *</label>
                  <v-select v-model="profissao" :items="opcoesProfissao" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
              </v-row>

              <h2 class="section-title mt-8">Condição do Cliente</h2>
              <v-divider class="mb-5" />
              <label class="field-label">Condição do cliente *</label>
              <div class="conditions-grid mb-2">
                <v-btn
                  v-for="op in ['Alfabetizado', 'Analfabeto', 'Incapaz', 'Criança/Adolescente']"
                  :key="op"
                  class="text-none"
                  :color="condicaoCliente === op ? 'primary' : undefined"
                  :variant="condicaoCliente === op ? 'flat' : 'outlined'"
                  @click="condicaoCliente = op"
                >
                  {{ op }}
                </v-btn>
              </div>

              <h2 class="section-title mt-8">Endereço do Cliente</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12" md="8">
                  <label class="field-label">Nome da rua *</label>
                  <v-text-field v-model="rua" class="compact-input" density="compact" hide-details placeholder="Ex: Rua das Flores" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Número *</label>
                  <v-text-field v-model="numero" class="compact-input" density="compact" hide-details placeholder="Ex: 123 ou S/N" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Complemento</label>
                  <v-text-field v-model="complemento" class="compact-input" density="compact" hide-details placeholder="Apto, Bloco, etc." variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Bairro *</label>
                  <v-text-field v-model="bairro" class="compact-input" density="compact" hide-details placeholder="Bairro" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Cidade *</label>
                  <v-text-field v-model="cidade" class="compact-input" density="compact" hide-details placeholder="Cidade" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Estado *</label>
                  <v-select v-model="uf" :items="opcoesUf" class="compact-input" density="compact" hide-details placeholder="UF" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">CEP *</label>
                  <v-text-field v-model="cep" class="compact-input" density="compact" hide-details placeholder="00000-000" variant="outlined" />
                </v-col>
              </v-row>

              <h2 class="section-title mt-8">Comprovante de Residência</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12">
                  <label class="field-label">Comprovante de residência (opcional)</label>
                  <v-file-input
                    v-model="comprovanteResidencia"
                    class="compact-input"
                    density="compact"
                    hide-details
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <label class="field-label">O comprovante de residência está em nome do cliente? *</label>
                  <v-select v-model="comprovanteNoNome" :items="opcoesSimNao" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
              </v-row>

              <h2 class="section-title mt-8">Questionário Patrimonial e Fiscal</h2>
              <v-divider class="mb-5" />
              <div class="mb-4">
                <label class="field-label">Possuo bens imóveis? (Casa, apartamento, terreno) *</label>
                <v-radio-group v-model="possuiImoveis" class="compact-radios" inline hide-details>
                  <v-radio label="Sim" value="Sim" />
                  <v-radio label="Não" value="Não" />
                </v-radio-group>
              </div>
              <div class="mb-4">
                <label class="field-label">Possuo bens móveis? (Carro, motocicleta, caminhão) *</label>
                <v-radio-group v-model="possuiMoveis" class="compact-radios" inline hide-details>
                  <v-radio label="Sim" value="Sim" />
                  <v-radio label="Não" value="Não" />
                </v-radio-group>
              </div>
              <div class="mb-4">
                <label class="field-label">Isento do IRPF? (Imposto de Renda Pessoa Física) *</label>
                <v-radio-group v-model="isentoIrpf" class="compact-radios" inline hide-details>
                  <v-radio label="Sim" value="Sim" />
                  <v-radio label="Não" value="Não" />
                </v-radio-group>
              </div>

              <h2 class="section-title mt-8">Contato</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12" md="6">
                  <label class="field-label">Telefone do cliente *</label>
                  <v-text-field v-model="telefoneCliente" class="compact-input" density="compact" hide-details placeholder="(49) 99999-9999" variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                  <label class="field-label">Titular do contato? *</label>
                  <v-select v-model="titularContato" :items="opcoesTitularContato" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="acoes">
              <h2 class="section-title">Ações</h2>
              <v-divider class="mb-5" />
              <v-row dense>
                <v-col cols="12" md="4">
                  <label class="field-label">Tipo de ação *</label>
                  <v-select v-model="tipoAcao" :items="opcoesTipoAcao" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Banco *</label>
                  <v-select v-model="bancoAcao" :items="opcoesBancoAcao" class="compact-input" density="compact" hide-details placeholder="Selecione" variant="outlined" />
                </v-col>
                <v-col cols="12" md="4">
                  <label class="field-label">Número do contrato *</label>
                  <v-text-field v-model="numeroContrato" class="compact-input" density="compact" hide-details placeholder="Digite o contrato" variant="outlined" />
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="kit-final">
              <h2 class="section-title">Kit Final</h2>
              <v-divider class="mb-5" />
              <v-alert color="success" icon="mdi-check-circle-outline" variant="tonal">
                Cadastro e ações preenchidos. Pronto para finalizar o kit.
              </v-alert>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card>

      <div class="d-flex mt-4 mb-2 sticky-actions">
        <v-btn :disabled="etapaIndex <= 0" prepend-icon="mdi-arrow-left" variant="outlined" @click="etapaAnterior">
          Anterior
        </v-btn>
        <v-spacer />
        <v-btn v-if="etapaAtual !== 'kit-final'" :disabled="!podeAvancar" append-icon="mdi-arrow-right" color="primary" @click="proximaEtapa">
          Próximo
        </v-btn>
        <v-btn v-else color="success" prepend-icon="mdi-check">
          Finalizar Kit
        </v-btn>
      </div>
    </div>
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
}

.step-icon {
  background: #eef0f5;
  color: #7b8191;
}

.step-icon--active {
  background: #ffb322;
  color: #fff;
  box-shadow: 0 0 0 3px rgba(255, 179, 34, 0.18);
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

.conditions-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.sticky-actions {
  position: sticky;
  bottom: 8px;
  background: rgba(247, 248, 251, 0.92);
  backdrop-filter: blur(2px);
  border: 1px solid #e8e8ef;
  border-radius: 12px;
  padding: 10px 12px;
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
</style>
