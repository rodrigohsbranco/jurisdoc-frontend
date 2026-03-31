<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { type Cliente, useClientesStore } from "@/stores/clientes";
import {
  type BankDescricao,
  type ContaBancaria,
  useContasStore,
} from "@/stores/contas";
import { onlyDigits } from "@/utils/formatters";
import { useBankCatalog } from "@/composables/useBankCatalog";
import { useSnackbar } from "@/composables/useSnackbar";
import { friendlyError } from "@/utils/errorMessages";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const CUSTOM_BANKS = [
  { label: "DEPÓSITO DIRETO NO CARTÃO", ispb: "CARD-DEP" },
  { label: "BANCO OLE BONSUCESSO CONSIGNADO S.A.", ispb: "CARD-OLE" },
] as const;

const route = useRoute();
const router = useRouter();
const contas = useContasStore();
const clientes = useClientesStore();
const { bankItems, bankLoading, loadBankCatalog, extractCompeFromLabel, findBankMetaByLabel } = useBankCatalog(CUSTOM_BANKS);
const { showSuccess, showError } = useSnackbar();

const clienteId = computed(() => Number(route.params.id));
const cliente = ref<Cliente | null>(null);

const loading = computed(() => contas.loading);
const error = computed(() => contas.error);

const bankSearch = ref("");

// === Identificador do banco escolhido (ISPB preferido; ou COMPE/slug) ===
const bankIspb = ref<string>(""); // chave para backend (banco_id)

// === Variações de descrição por banco (no servidor) ===
const bankNotes = ref<BankDescricao[]>([]);
const selectedNoteId = ref<number | null>(null);

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

// tabela (client-side)
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "banco_nome", order: "asc" },
]);

// diálogo criar/editar
const dialog = ref(false);
const editing = ref<ContaBancaria | null>(null);
const form = ref<Partial<ContaBancaria>>({
  banco_nome: "",
  agencia: "",
  conta: "",
  digito: "",
  tipo: "corrente",
  is_principal: false,
});

function bankLabel(): string {
  return typeof form.value.banco_nome === "string"
    ? (form.value.banco_nome || "").trim()
    : (form.value as any).banco_nome?.label?.trim?.() || "";
}
function resetForm() {
  form.value = {
    banco_nome: "",
    agencia: "",
    conta: "",
    digito: "",
    tipo: "corrente",
    is_principal: false,
  };
}

function openCreate() {
  editing.value = null;
  resetForm();
  dialog.value = true;
  // reseta variações
  bankIspb.value = "";
  bankNotes.value = [];
  selectedNoteId.value = null;
}

async function openEdit(c: ContaBancaria) {
  editing.value = c;
  form.value = { ...c };
  dialog.value = true;
  await loadBankCatalog();
  await onBankChange(String(form.value.banco_nome || ""));
}

function normalizeBankId(input: string): string {
  // Uppercase + remove acentos
  let v = (input || "").toUpperCase();
  v = v.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  // Espaços/pontos -> hífen; remove o que não for A-Z/0-9/_/-
  v = v.replace(/[\s\.]+/g, "-").replace(/[^A-Z0-9_-]/g, "");
  // Compacta múltiplos hífens/underscores e tira das pontas
  v = v.replace(/[-_]{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  // Limita a 32 chars e evita terminar em hífen
  if (v.length > 32) v = v.slice(0, 32).replace(/[-_]+$/g, "");
  // Garante algo minimamente válido
  if (v.length < 3) v = (v + "-BANK").slice(0, 3);
  return v;
}

async function refreshNotes() {
  bankNotes.value = [];
  selectedNoteId.value = null;
  if (!bankIspb.value) return;
  const list = await contas.listDescricoes(bankIspb.value);
  bankNotes.value = list;
  const ativa = list.find((n) => n.is_ativa);
  selectedNoteId.value = ativa ? ativa.id : (list[0]?.id ?? null);
}

// dispara ao trocar o banco no combobox
async function onBankChange(val: any) {
  const label = typeof val === "string" ? val : (val?.label ?? "");
  // limpa estado
  bankIspb.value = "";
  bankNotes.value = [];
  selectedNoteId.value = null;

  if (!label) return;

  await loadBankCatalog(); // garante catálogo em memória quando vindo de "Editar"
  const meta = findBankMetaByLabel(label);
  const compe = meta?.code || extractCompeFromLabel(label);

  // prioriza ISPB; se não houver, usa COMPE ou o próprio label como slug
  bankIspb.value = meta?.ispb || compe || normalizeBankId(label);

  // carrega variações do servidor (ativa primeiro)
  try {
    await refreshNotes();
  } catch {
    // erro já vai para store.error; não bloqueia o formulário
  }
}

async function addNote() {
  const nomeBanco = bankLabel();
  if (!bankIspb.value || !nomeBanco) return;
  try {
    await contas.createDescricaoBanco({
      banco_id: bankIspb.value,
      banco_nome: nomeBanco,
      nome_banco: nomeBanco, // sugiro iniciar igual ao nome do banco selecionado
      cnpj: "",
      endereco: "",
      is_ativa: false,
    });
    await refreshNotes();
  } catch {
    /* erro já vai para store.error */
  }
}

async function setActiveNote(id: number | null) {
  if (!id) return;
  try {
    await contas.setDescricaoAtiva(id);
    // refreshNotes já chamado em store.setDescricaoAtiva; ainda assim garantimos estado:
    await refreshNotes();
  } catch {
    /* erro já vai para store.error */
  }
}

async function updateNoteText(note: BankDescricao) {
  try {
    await contas.updateDescricaoBanco(note.id, {
      nome_banco: note.nome_banco,
      cnpj: note.cnpj,
      endereco: note.endereco,
    });
  } catch {
    /* erro já vai para store.error */
  }
}

async function save() {
  try {
    // extrai o nome do banco como STRING (combobox pode entregar objeto)
    const nomeBanco =
      typeof form.value.banco_nome === "string"
        ? form.value.banco_nome.trim()
        : (form.value as any).banco_nome?.label?.trim?.() || "";

    // validações simples
    if (!nomeBanco) throw new Error("Informe o nome do banco.");
    if (!form.value.agencia || !String(form.value.agencia).trim())
      throw new Error("Informe a agência.");
    if (!form.value.conta || !String(form.value.conta).trim())
      throw new Error("Informe a conta.");

    // extras: apenas o banco_id (descrições são geridas pelas ações acima)
    const safeBankId =
      bankIspb.value ||
      extractCompeFromLabel(nomeBanco) ||
      normalizeBankId(nomeBanco);

    const extras = { banco_id: safeBankId };

    // sanitização
    const payload: any = {
      ...form.value,
      banco_nome: nomeBanco, // <-- garante string
      cliente: clienteId.value,
      agencia: onlyDigits(String(form.value.agencia || "")),
      conta: onlyDigits(String(form.value.conta || "")),
      digito: form.value.digito ? onlyDigits(String(form.value.digito)) : "",
      tipo: form.value.tipo || "corrente",
    };

    await (editing.value
      ? contas.update(editing.value.id, { ...payload, ...extras })
      : contas.create(payload, extras));

    dialog.value = false;
    // limpa estado
    bankNotes.value = [];
    selectedNoteId.value = null;
    bankIspb.value = "";
  } catch (error_: any) {
    contas.error = friendlyError(error_, 'contas', editing.value ? 'update' : 'create');
  }
}

async function remove(acc: ContaBancaria) {
  confirmMessage.value = `Excluir a conta ${acc.banco_nome} (${acc.agencia}/${acc.conta}${
    acc.digito ? "-" + acc.digito : ""
  })?`;
  confirmAction.value = async () => {
    try {
      await contas.remove(acc.id);
      showSuccess("Conta excluída com sucesso!");
    } catch (error_: any) {
      contas.error = friendlyError(error_, 'contas', 'remove');
    }
  };
  confirmVisible.value = true;
}

async function makePrincipal(acc: ContaBancaria) {
  try {
    await contas.setPrincipal(acc.id);
  } catch (error_: any) {
    contas.error = friendlyError(error_, 'contas', 'update');
  }
}

function goBack() {
  router.push({ name: "clientes" });
}

const headers = [
  { title: "Banco", key: "banco_nome" },
  { title: "Agência", key: "agencia" },
  { title: "Conta", key: "conta" },
  { title: "Tipo", key: "tipo" },
  { title: "Principal", key: "is_principal", sortable: true },
  { title: "Ações", key: "actions", sortable: false, align: "end" as const },
];

const contasDoCliente = computed(() => contas.byCliente(clienteId.value));

async function load() {
  if (!Number.isFinite(clienteId.value)) {
    router.replace({ name: "clientes" });
    return;
  }
  try {
    cliente.value = await clientes.getDetail(clienteId.value);
  } catch {
    cliente.value = {
      id: clienteId.value,
      nome_completo: "Cliente",
      cidade: "",
      uf: "",
    } as any;
  }
  await contas.fetchForCliente(clienteId.value, {});
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-2 mb-1">
          <v-btn icon size="small" variant="text" @click="goBack">
            <v-icon icon="mdi-arrow-left" />
          </v-btn>
          <h1 class="text-h5 font-weight-bold text-primary">Contas bancárias</h1>
        </div>
        <p class="text-body-2 text-medium-emphasis ml-10">
          Cliente: <strong>{{ cliente?.nome_completo || "#" + clienteId }}</strong>
          <span v-if="cliente?.cidade"> &mdash; {{ cliente.cidade }}/{{ cliente?.uf }}</span>
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-bank-plus" @click="openCreate">
        Nova conta
      </v-btn>
    </div>

    <!-- Table card -->
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-4">
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            hide-details
            label="Buscar contas..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 320px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" type="error">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="contasDoCliente"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.agencia="{ item }">
            {{ item.agencia || "—" }}
          </template>

          <template #item.conta="{ item }">
            {{ item.conta }}<span v-if="item.digito">-{{ item.digito }}</span>
          </template>

          <template #item.tipo="{ item }">
            <v-chip variant="tonal">
              {{ item.tipo === "poupanca" ? "Poupança" : "Corrente" }}
            </v-chip>
          </template>

          <template #item.is_principal="{ item }">
            <v-chip
              v-if="item.is_principal"
              color="secondary"
              variant="elevated"
            >
              Principal
            </v-chip>
            <v-btn
              v-else
              color="secondary"
              size="small"
              variant="text"
              @click="makePrincipal(item)"
            >
              Definir principal
            </v-btn>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex ga-1 justify-end">
              <v-btn color="primary" icon size="small" variant="text" @click="openEdit(item)">
                <v-icon icon="mdi-pencil-outline" size="18" />
                <v-tooltip activator="parent" location="top">Editar</v-tooltip>
              </v-btn>
              <v-btn color="error" icon size="small" variant="text" @click="remove(item)">
                <v-icon icon="mdi-delete-outline" size="18" />
                <v-tooltip activator="parent" location="top">Excluir</v-tooltip>
              </v-btn>
            </div>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-bank-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhuma conta cadastrada para este cliente</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <SidePanel v-model="dialog" :width="640">
      <template #header>
        <v-icon class="mr-2" :icon="editing ? 'mdi-pencil-outline' : 'mdi-bank-plus'" color="primary" />
        {{ editing ? "Editar conta" : "Nova conta" }}
      </template>

      <v-form @submit.prevent="save">
        <v-row dense>
          <v-col cols="12" md="6">
            <v-combobox
              v-model="form.banco_nome"
              v-model:search="bankSearch"
              clearable
              item-title="label"
              item-value="label"
              :items="bankItems"
              label="Banco"
              :loading="bankLoading"
              required
              :return-object="false"
              :rules="[
                (v) =>
                  (typeof v === 'string' && v.trim().length > 0) ||
                  (v &&
                    typeof v === 'object' &&
                    v.label &&
                    String(v.label).trim().length > 0) ||
                  'Obrigatório',
              ]"
              @focus="loadBankCatalog"
              @update:model-value="onBankChange"
            />
          </v-col>

          <v-col cols="6" md="3">
            <v-text-field
              v-model="form.agencia"
              label="Agência"
              required
              :rules="[
                (v) =>
                  (!!v && String(v).trim().length > 0) || 'Obrigatório',
              ]"
              @blur="form.agencia = onlyDigits(String(form.agencia || ''))"
            />
          </v-col>

          <v-col cols="6" md="3">
            <v-text-field
              v-model="form.conta"
              label="Conta"
              required
              :rules="[
                (v) =>
                  (!!v && String(v).trim().length > 0) || 'Obrigatório',
              ]"
              @blur="form.conta = onlyDigits(String(form.conta || ''))"
            />
          </v-col>

          <v-col cols="6" md="3">
            <v-text-field
              v-model="form.digito"
              label="Dígito"
              @blur="form.digito = onlyDigits(String(form.digito || ''))"
            />
          </v-col>

          <v-col cols="6" md="3">
            <v-select
              v-model="form.tipo"
              :items="[
                { title: 'Corrente', value: 'corrente' },
                { title: 'Poupança', value: 'poupanca' },
              ]"
              label="Tipo"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-switch
              v-model="form.is_principal"
              color="secondary"
              hide-details
              label="Definir como principal"
            />
            <div class="text-caption text-medium-emphasis mt-1">
              Apenas uma conta principal por cliente.
            </div>
          </v-col>

          <!-- ===== Variações de descrição por banco ===== -->
          <v-col cols="12">
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-2">Descrições do banco</div>
              <v-spacer />
              <v-btn
                :disabled="!bankIspb || !bankLabel()"
                prepend-icon="mdi-plus"
                size="small"
                variant="text"
                @click="addNote"
              >
                Adicionar
              </v-btn>
            </div>

            <div v-if="!bankIspb" class="text-body-2 text-medium-emphasis">
              Selecione um banco para ver/criar descrições.
            </div>

            <div v-else>
              <div
                v-if="bankNotes.length === 0"
                class="text-body-2 text-medium-emphasis"
              >
                Nenhuma descrição cadastrada para este banco. Clique em
                <strong>Adicionar</strong> para criar uma.
              </div>

              <v-radio-group
                v-model="selectedNoteId"
                class="mt-1"
                hide-details
                inline
                @update:model-value="(v: any) => setActiveNote(Number(v))"
              >
                <v-row dense>
                  <v-col v-for="note in bankNotes" :key="note.id" cols="12">
                    <div class="d-flex align-start ga-2">
                      <v-radio
                        aria-label="Selecionar descrição"
                        class="mt-3"
                        density="comfortable"
                        :ripple="false"
                        :value="note.id"
                      />

                      <v-card
                        class="pa-3 mb-2"
                        color="secondary"
                        :variant="note.is_ativa ? 'tonal' : 'outlined'"
                        width="100%"
                      >
                        <v-row dense>
                          <v-col cols="12" lg="4" md="6">
                            <v-text-field
                              v-model="note.nome_banco"
                              :disabled="note.id !== selectedNoteId"
                              label="Nome do banco"
                              @blur="updateNoteText(note)"
                            />
                          </v-col>

                          <v-col cols="12" lg="4" md="6">
                            <v-text-field
                              v-model="note.cnpj"
                              :disabled="note.id !== selectedNoteId"
                              label="CNPJ"
                              @blur="updateNoteText(note)"
                            />
                          </v-col>

                          <v-col cols="12" lg="4">
                            <v-text-field
                              v-model="note.endereco"
                              :disabled="note.id !== selectedNoteId"
                              label="Endereço"
                              @blur="updateNoteText(note)"
                            />
                          </v-col>
                        </v-row>

                        <div class="text-caption text-medium-emphasis mt-1">
                          {{
                            note.is_ativa
                              ? "Esta variação está ativa e será usada por padrão."
                              : "Para usar esta variação agora, selecione o rádio ao lado."
                          }}
                        </div>
                      </v-card>
                      <v-btn
                        v-if="!note.is_ativa"
                        color="error"
                        prepend-icon="mdi-delete"
                        size="small"
                        variant="text"
                        @click="
                          async () => {
                            try {
                              await contas.removeDescricaoBanco(
                                note.id,
                                note.banco_id,
                              );
                              await refreshNotes();
                            } catch (e) {
                              // opcional: log/alert
                            }
                          }
                        "
                      />
                    </div>
                  </v-col>
                </v-row>
              </v-radio-group>
            </div>
          </v-col>
        </v-row>
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="save">Salvar</v-btn>
      </template>
    </SidePanel>

    <ConfirmDialog
      v-model="confirmVisible"
      title="Confirmar exclusão"
      :message="confirmMessage"
      confirm-text="Excluir"
      @confirm="confirmAction?.()"
    />
  </v-container>
</template>
