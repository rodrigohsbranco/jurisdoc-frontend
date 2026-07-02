<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  createUser,
  deleteUser,
  listUsers,
  setUserPassword,
  updateUser,
  type EnderecoUser,
  type User,
} from "@/services/users";
import { usePermissoesStore } from "@/stores/permissoes";
import { useSnackbar } from "@/composables/useSnackbar";
import { useCepLookup } from "@/composables/useCepLookup";
import { friendlyError } from "@/utils/errorMessages";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const { showSuccess, showError } = useSnackbar();
const permissoesStore = usePermissoesStore();
const { cepLoading, cepStatus, lookupCEP } = useCepLookup();

// estado
const loading = ref(false);
const items = ref<User[]>([]);
const error = ref("");

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

// busca e ordenação
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "username", order: "asc" },
]);

// diálogos
const dialog = ref(false);
const editing = ref<User | null>(null);

type FormState = {
  username: string;
  nome_completo: string;
  email: string;
  telefone: string;
  endereco: EnderecoUser;
  is_admin: boolean;
  is_active: boolean;
  permissao: number | null;
  password: string;
  avatar?: File | null;
  avatar_preview?: string | null;
};

const form = ref<FormState>(emptyForm());
const enderecoOpen = ref<string[]>([]);

const pwdDialog = ref(false);
const pwdTarget = ref<User | null>(null);
const newPassword = ref("");

const totalUsuarios = computed(() => items.value.length);

// Cards mobile (< md). Busca local + paginação 10 por página.
const { smAndDown: mobile } = useDisplay();
const filteredItems = computed(() => {
  const q = search.value?.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter(u => {
    const haystack = [u.username, u.nome_completo, u.email].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
});
const mobilePage = ref(1);
const mobilePageSize = 10;
const mobileTotalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / mobilePageSize)));
const paginatedItems = computed(() => {
  const start = (mobilePage.value - 1) * mobilePageSize;
  return filteredItems.value.slice(start, start + mobilePageSize);
});
watch([search, () => items.value.length], () => { mobilePage.value = 1; });

const headers = [
  { title: "Usuário", key: "username" },
  { title: "Email", key: "email" },
  { title: "Permissão", key: "permissao", sortable: false, width: 160 },
  { title: "Perfil", key: "is_admin", sortable: true, width: 110 },
  { title: "Status", key: "is_active", sortable: true, width: 100 },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

function emptyForm (): FormState {
  return {
    username: "",
    nome_completo: "",
    email: "",
    telefone: "",
    endereco: {},
    is_admin: false,
    is_active: true,
    permissao: null,
    password: "",
    avatar: null,
    avatar_preview: null,
  };
}

async function fetchUsers () {
  loading.value = true;
  error.value = "";
  try {
    items.value = await listUsers({});
  } catch (error_: any) {
    error.value = friendlyError(error_, "usuarios", "list");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([fetchUsers(), permissoesStore.fetchList()]);
});

function getInitials (user: User) {
  const name = user.nome_completo || user.username || "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function openCreate () {
  editing.value = null;
  form.value = emptyForm();
  enderecoOpen.value = [];
  dialog.value = true;
}

function openEdit (u: User) {
  editing.value = u;
  form.value = {
    username: u.username,
    nome_completo: u.nome_completo || "",
    email: u.email || "",
    telefone: u.telefone || "",
    endereco: (u.endereco as EnderecoUser) || {},
    is_admin: !!u.is_admin,
    is_active: !!u.is_active,
    permissao: u.permissao ?? null,
    password: "",
    avatar: null,
    avatar_preview: u.avatar || null,
  };
  enderecoOpen.value = [];
  dialog.value = true;
}

function onAvatarChange (file: File | File[] | null) {
  const f = Array.isArray(file) ? file[0] : file;
  if (!f) {
    form.value.avatar = null;
    return;
  }
  form.value.avatar = f;
  const reader = new FileReader();
  reader.onload = e => {
    form.value.avatar_preview = e.target?.result as string;
  };
  reader.readAsDataURL(f);
}

function onCepBlur () {
  const cep = form.value.endereco.cep || "";
  lookupCEP(cep, ({ logradouro, bairro, cidade, uf }) => {
    form.value.endereco = {
      ...form.value.endereco,
      logradouro,
      bairro,
      cidade,
      uf,
    };
  });
}

async function save () {
  try {
    const payload: any = {
      username: form.value.username,
      nome_completo: form.value.nome_completo,
      email: form.value.email,
      telefone: form.value.telefone,
      endereco: form.value.endereco,
      is_admin: form.value.is_admin,
      is_active: form.value.is_active,
      permissao: form.value.permissao,
    };
    if (form.value.avatar instanceof File) payload.avatar = form.value.avatar;

    if (editing.value) {
      await updateUser(editing.value.id, payload);
      await fetchUsers();
      showSuccess("Usuário atualizado com sucesso!");
    } else {
      if (!form.value.password || form.value.password.length < 6) {
        throw new Error("Senha mínima de 6 caracteres.");
      }
      payload.password = form.value.password;
      await createUser(payload);
      await fetchUsers();
      showSuccess("Usuário criado com sucesso!");
    }
    dialog.value = false;
  } catch (error_: any) {
    error.value = friendlyError(error_, "usuarios", editing.value ? "update" : "create");
  }
}

async function remove (u: User) {
  confirmMessage.value = `Excluir o usuário "${u.username}"?`;
  confirmAction.value = async () => {
    try {
      await deleteUser(u.id);
      items.value = items.value.filter(i => i.id !== u.id);
      showSuccess("Usuário excluído com sucesso!");
    } catch (error_: any) {
      error.value = friendlyError(error_, "usuarios", "remove");
    }
  };
  confirmVisible.value = true;
}

async function toggleActive (u: User, val: boolean) {
  try {
    await updateUser(u.id, { is_active: val });
    u.is_active = val;
    showSuccess(val ? "Usuário ativado!" : "Usuário desativado!");
  } catch {
    showError("Falha ao alterar status.");
  }
}

function openSetPassword (u: User) {
  pwdTarget.value = u;
  newPassword.value = "";
  pwdDialog.value = true;
}

async function applyPassword () {
  if (!pwdTarget.value) return;
  if (newPassword.value.length < 6) {
    error.value = "Senha mínima de 6 caracteres.";
    return;
  }
  try {
    await setUserPassword(pwdTarget.value.id, newPassword.value);
    pwdDialog.value = false;
    showSuccess("Senha alterada com sucesso!");
  } catch (error_: any) {
    error.value = friendlyError(error_, "usuarios", "password");
  }
}

// dropdown de permissão exibe os perfis carregados via store
const permissoesOptions = computed(() =>
  permissoesStore.items.map(p => ({ value: p.id, title: p.nome })),
);

function permissaoNomeDe (u: User) {
  return u.permissao_detalhe?.nome
    || permissoesStore.items.find(p => p.id === u.permissao)?.nome
    || null;
}

watch(() => form.value.is_admin, val => {
  if (val) form.value.permissao = null; // admin não precisa de perfil
});
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Usuários</h1>
          <v-chip v-if="totalUsuarios" color="primary" size="small" variant="tonal">
            {{ totalUsuarios }} {{ totalUsuarios === 1 ? "usuário" : "usuários" }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Gerenciamento de usuários do sistema</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        Novo usuário
      </v-btn>
    </div>

    <!-- Tabela -->
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-4">
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            hide-details
            placeholder="Buscar por nome, usuário, email..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" closable type="error" @click:close="error = ''">
          {{ error }}
        </v-alert>

        <!-- Lista de cards em mobile -->
        <div v-if="mobile" class="mobile-list">
          <div v-if="loading" class="text-center py-8 text-medium-emphasis">
            <v-progress-circular color="primary" indeterminate size="28" />
            <div class="mt-2 text-body-2">Carregando...</div>
          </div>
          <div v-else-if="!filteredItems.length" class="text-center py-8 text-medium-emphasis">
            <v-icon class="mb-2" icon="mdi-account-off-outline" size="36" />
            <div class="text-body-2">Nenhum usuário encontrado</div>
          </div>
          <article v-for="item in paginatedItems" :key="item.id" class="mobile-card">
            <div class="mobile-card__actions">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
                </template>
                <v-list density="compact" min-width="200">
                  <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="openEdit(item)" />
                  <v-list-item prepend-icon="mdi-lock-reset" title="Redefinir senha" @click="openSetPassword(item)" />
                  <v-list-item
                    :prepend-icon="item.is_active ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
                    :title="item.is_active ? 'Desativar' : 'Ativar'"
                    @click="toggleActive(item, !item.is_active)"
                  />
                  <v-divider class="my-1" />
                  <v-list-item class="text-error" prepend-icon="mdi-delete-outline" title="Excluir" @click="remove(item)" />
                </v-list>
              </v-menu>
            </div>

            <div class="mobile-card__header" style="padding-right: 36px">
              <v-avatar color="primary" size="40" variant="tonal">
                <v-img v-if="item.avatar" :src="item.avatar" cover />
                <span v-else class="text-caption font-weight-bold">{{ getInitials(item) }}</span>
              </v-avatar>
              <div class="mobile-card__header-text">
                <div class="mobile-card__title">{{ item.username }}</div>
                <div v-if="item.nome_completo" class="mobile-card__subtitle">{{ item.nome_completo }}</div>
                <div v-if="item.email" class="mobile-card__subtitle">{{ item.email }}</div>
              </div>
            </div>

            <div class="mobile-card__divider" />

            <div class="mobile-card__chips">
              <v-chip
                :color="item.is_admin ? 'secondary' : undefined"
                :prepend-icon="item.is_admin ? 'mdi-shield-crown-outline' : 'mdi-account-outline'"
                size="x-small"
                variant="tonal"
              >
                {{ item.is_admin ? "Admin" : "Usuário" }}
              </v-chip>
              <v-chip :color="item.is_active ? 'success' : 'error'" size="x-small" variant="tonal">
                {{ item.is_active ? "Ativo" : "Inativo" }}
              </v-chip>
              <v-chip
                v-if="permissaoNomeDe(item)"
                prepend-icon="mdi-shield-check-outline"
                size="x-small"
                variant="tonal"
              >
                {{ permissaoNomeDe(item) }}
              </v-chip>
              <v-chip v-else-if="!item.is_admin" size="x-small" variant="tonal" color="grey">
                Sem perfil
              </v-chip>
            </div>
          </article>

          <div v-if="filteredItems.length > mobilePageSize" class="mobile-pagination">
            <div class="mobile-pagination__info">
              {{ (mobilePage - 1) * mobilePageSize + 1 }}–{{
                Math.min(mobilePage * mobilePageSize, filteredItems.length)
              }} de {{ filteredItems.length }}
            </div>
            <v-pagination v-model="mobilePage" density="comfortable" :length="mobileTotalPages" :total-visible="4" />
          </div>
        </div>

        <v-data-table
          v-else
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.username="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <v-img v-if="item.avatar" :src="item.avatar" cover />
                <span v-else class="text-caption font-weight-bold">{{ getInitials(item) }}</span>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.username }}</div>
                <div v-if="item.nome_completo" class="text-caption text-medium-emphasis">
                  {{ item.nome_completo }}
                </div>
              </div>
            </div>
          </template>

          <template #item.email="{ item }">
            <span v-if="item.email" class="text-body-2">{{ item.email }}</span>
            <span v-else class="text-medium-emphasis">--</span>
          </template>

          <template #item.permissao="{ item }">
            <v-chip
              v-if="permissaoNomeDe(item)"
              prepend-icon="mdi-shield-check-outline"
              size="small"
              variant="tonal"
            >
              {{ permissaoNomeDe(item) }}
            </v-chip>
            <span v-else-if="item.is_admin" class="text-caption text-medium-emphasis">
              (admin)
            </span>
            <span v-else class="text-caption text-medium-emphasis">Sem perfil</span>
          </template>

          <template #item.is_admin="{ item }">
            <v-chip
              :color="item.is_admin ? 'secondary' : 'default'"
              :prepend-icon="item.is_admin ? 'mdi-shield-crown-outline' : 'mdi-account-outline'"
              size="small"
              variant="tonal"
            >
              {{ item.is_admin ? "Admin" : "Usuário" }}
            </v-chip>
          </template>

          <template #item.is_active="{ item }">
            <v-chip :color="item.is_active ? 'success' : 'error'" size="small" variant="tonal">
              {{ item.is_active ? "Ativo" : "Inativo" }}
            </v-chip>
          </template>

          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="openEdit(item)" />
                <v-list-item prepend-icon="mdi-lock-reset" title="Redefinir senha" @click="openSetPassword(item)" />
                <v-list-item
                  :prepend-icon="item.is_active ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
                  :title="item.is_active ? 'Desativar' : 'Ativar'"
                  @click="toggleActive(item, !item.is_active)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="remove(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-account-off-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum usuário encontrado</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Form criar/editar -->
    <SidePanel v-model="dialog" :width="640">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-account-plus-outline'" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">{{ editing ? "Editar usuário" : "Novo usuário" }}</div>
          <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.username }}</div>
        </div>
      </template>

      <v-form @submit.prevent="save">
        <!-- Avatar -->
        <div class="d-flex align-center ga-4 mb-4">
          <v-avatar color="primary" size="64" variant="tonal">
            <v-img v-if="form.avatar_preview" :src="form.avatar_preview" cover />
            <span v-else class="text-body-1 font-weight-bold">
              {{ (form.nome_completo || form.username || "?").slice(0, 2).toUpperCase() }}
            </span>
          </v-avatar>
          <div class="flex-grow-1">
            <v-file-input
              accept="image/*"
              density="compact"
              hide-details
              label="Avatar (opcional)"
              prepend-icon=""
              prepend-inner-icon="mdi-image-outline"
              show-size
              @update:model-value="onAvatarChange"
            />
          </div>
        </div>

        <!-- Identificação -->
        <div class="section-title">Identificação</div>
        <v-text-field
          v-model="form.username"
          density="comfortable"
          label="Usuário (login)"
          required
        />
        <v-text-field
          v-model="form.nome_completo"
          class="mt-1"
          density="comfortable"
          label="Nome completo"
        />
        <v-row dense class="mt-1">
          <v-col cols="7">
            <v-text-field
              v-model="form.email"
              density="comfortable"
              label="Email"
              type="email"
            />
          </v-col>
          <v-col cols="5">
            <v-text-field
              v-model="form.telefone"
              density="comfortable"
              label="Telefone"
              placeholder="(00) 00000-0000"
            />
          </v-col>
        </v-row>

        <!-- Endereço (colapsável) -->
        <v-expansion-panels v-model="enderecoOpen" class="mt-3" multiple variant="accordion">
          <v-expansion-panel value="end">
            <v-expansion-panel-title>
              <v-icon class="mr-2" icon="mdi-map-marker-outline" size="18" />
              Endereço (opcional)
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row dense>
                <v-col cols="4">
                  <v-text-field
                    v-model="form.endereco.cep"
                    density="comfortable"
                    label="CEP"
                    :loading="cepLoading"
                    @blur="onCepBlur"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="form.endereco.logradouro" density="comfortable" label="Logradouro" />
                </v-col>
                <v-col cols="2">
                  <v-text-field v-model="form.endereco.numero" density="comfortable" label="Nº" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="form.endereco.complemento" density="comfortable" label="Complemento" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="form.endereco.bairro" density="comfortable" label="Bairro" />
                </v-col>
                <v-col cols="8">
                  <v-text-field v-model="form.endereco.cidade" density="comfortable" label="Cidade" />
                </v-col>
                <v-col cols="4">
                  <v-text-field v-model="form.endereco.uf" density="comfortable" label="UF" maxlength="2" />
                </v-col>
              </v-row>
              <div v-if="cepStatus" class="text-caption text-medium-emphasis mt-1">{{ cepStatus }}</div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- Acesso -->
        <div class="section-title mt-4">Acesso</div>
        <v-row dense>
          <v-col cols="12">
            <v-select
              v-model="form.permissao"
              clearable
              density="comfortable"
              :disabled="form.is_admin"
              :hint="form.is_admin ? 'Administradores têm acesso total — perfil não é necessário.' : 'Selecione um perfil ou crie um em Permissões.'"
              item-title="title"
              item-value="value"
              :items="permissoesOptions"
              label="Permissão (perfil)"
              persistent-hint
              prepend-inner-icon="mdi-shield-check-outline"
            />
          </v-col>
        </v-row>
        <div class="d-flex ga-6 flex-wrap mt-3">
          <v-switch
            v-model="form.is_admin"
            color="secondary"
            density="compact"
            hide-details
            label="Administrador"
          />
          <v-switch
            v-model="form.is_active"
            color="success"
            density="compact"
            hide-details
            label="Ativo"
          />
        </div>

        <!-- Senha (somente create) -->
        <template v-if="!editing">
          <div class="section-title mt-4">Senha</div>
          <v-text-field
            v-model="form.password"
            density="comfortable"
            label="Senha"
            required
            :rules="[(v: string) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']"
            type="password"
          />
        </template>
      </v-form>

      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="save">Salvar</v-btn>
      </template>
    </SidePanel>

    <!-- Dialog definir senha -->
    <SidePanel v-model="pwdDialog" :width="440">
      <template #header>
        <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
          <v-icon icon="mdi-lock-reset" size="18" />
        </v-avatar>
        <div>
          <div class="text-body-1 font-weight-bold">Redefinir senha</div>
          <div v-if="pwdTarget" class="text-caption text-medium-emphasis">{{ pwdTarget.username }}</div>
        </div>
      </template>

      <v-text-field
        v-model="newPassword"
        label="Nova senha"
        :rules="[(v: string) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']"
        type="password"
      />

      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="pwdDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="elevated" @click="applyPassword">Aplicar</v-btn>
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

<style scoped>
.section-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(15, 43, 70, 0.65);
  font-weight: 700;
  margin-bottom: 8px;
}
</style>
