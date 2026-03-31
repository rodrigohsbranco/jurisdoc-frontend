<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  createUser,
  deleteUser,
  listUsers,
  setUserPassword,
  updateUser,
  type User,
} from "@/services/users";
import { useSnackbar } from "@/composables/useSnackbar";
import { friendlyError } from "@/utils/errorMessages";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const { showSuccess, showError } = useSnackbar();

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
const form = ref<Partial<User> & { password?: string }>({
  is_admin: false,
  is_active: true,
});
const pwdDialog = ref(false);
const pwdTarget = ref<User | null>(null);
const newPassword = ref("");

const totalUsuarios = computed(() => items.value.length);

const headers = [
  { title: "Usuário", key: "username" },
  { title: "Email", key: "email" },
  { title: "Perfil", key: "is_admin", sortable: true },
  { title: "Status", key: "is_active", sortable: true },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

async function fetchUsers() {
  loading.value = true;
  error.value = "";
  try {
    items.value = await listUsers({});
  } catch (error_: any) {
    error.value = friendlyError(error_, 'usuarios', 'list');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchUsers);

function getInitials(user: User) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (!name) return user.username.slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function fullName(user: User) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || null;
}

function openCreate() {
  editing.value = null;
  form.value = {
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    is_admin: false,
    is_active: true,
    password: "",
  };
  dialog.value = true;
}

function openEdit(u: User) {
  editing.value = u;
  form.value = { ...u, password: undefined };
  dialog.value = true;
}

async function save() {
  try {
    if (editing.value) {
      const { password, ...rest } = form.value;
      const updated = await updateUser(editing.value.id, rest);
      const idx = items.value.findIndex((i) => i.id === editing.value!.id);
      if (idx !== -1) items.value[idx] = { ...items.value[idx], ...(rest as any) };
      showSuccess("Usuário atualizado com sucesso!");
    } else {
      if (!form.value.password || form.value.password.length < 6) {
        throw new Error("Senha mínima de 6 caracteres.");
      }
      const created = await createUser(form.value as any);
      items.value.unshift(created);
      showSuccess("Usuário criado com sucesso!");
    }
    dialog.value = false;
  } catch (error_: any) {
    error.value = friendlyError(error_, 'usuarios', editing.value ? 'update' : 'create');
  }
}

async function remove(u: User) {
  confirmMessage.value = `Excluir o usuário "${u.username}"?`;
  confirmAction.value = async () => {
    try {
      await deleteUser(u.id);
      items.value = items.value.filter((i) => i.id !== u.id);
      showSuccess("Usuário excluído com sucesso!");
    } catch (error_: any) {
      error.value = friendlyError(error_, 'usuarios', 'remove');
    }
  };
  confirmVisible.value = true;
}

async function toggleActive(u: User, val: boolean) {
  try {
    await updateUser(u.id, { is_active: val });
    u.is_active = val;
    showSuccess(val ? "Usuário ativado!" : "Usuário desativado!");
  } catch {
    showError("Falha ao alterar status.");
  }
}

function openSetPassword(u: User) {
  pwdTarget.value = u;
  newPassword.value = "";
  pwdDialog.value = true;
}

async function applyPassword() {
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
    error.value = friendlyError(error_, 'usuarios', 'password');
  }
}
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Usuários</h1>
          <v-chip v-if="totalUsuarios" color="primary" size="small" variant="tonal">
            {{ totalUsuarios }} {{ totalUsuarios === 1 ? 'usuário' : 'usuários' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Gerenciamento de usuários do sistema</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        Novo usuário
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
            placeholder="Buscar por nome, usuário, email..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" closable type="error" @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <!-- Usuário com avatar -->
          <template #item.username="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <span class="text-caption font-weight-bold">{{ getInitials(item) }}</span>
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.username }}</div>
                <div v-if="fullName(item)" class="text-caption text-medium-emphasis">
                  {{ fullName(item) }}
                </div>
              </div>
            </div>
          </template>

          <!-- Email -->
          <template #item.email="{ item }">
            <span v-if="item.email" class="text-body-2">{{ item.email }}</span>
            <span v-else class="text-medium-emphasis">--</span>
          </template>

          <!-- Perfil -->
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

          <!-- Status -->
          <template #item.is_active="{ item }">
            <v-chip
              :color="item.is_active ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ item.is_active ? "Ativo" : "Inativo" }}
            </v-chip>
          </template>

          <!-- Ações (menu) -->
          <template #item.actions="{ item }">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-dots-vertical"
                  size="small"
                  variant="text"
                />
              </template>
              <v-list density="compact" min-width="200">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  @click="openEdit(item)"
                />
                <v-list-item
                  prepend-icon="mdi-lock-reset"
                  title="Redefinir senha"
                  @click="openSetPassword(item)"
                />
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

    <!-- Dialog criar/editar -->
    <SidePanel v-model="dialog" :width="560">
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
        <v-text-field v-model="form.username" label="Usuário" required />
        <v-row dense class="mt-1">
          <v-col cols="6">
            <v-text-field v-model="form.first_name" label="Nome" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.last_name" label="Sobrenome" />
          </v-col>
        </v-row>
        <v-text-field v-model="form.email" class="mt-1" label="Email" type="email" />

        <div class="text-caption text-medium-emphasis text-uppercase mb-2 mt-4" style="letter-spacing: 0.05em">
          Permissões
        </div>
        <div class="d-flex ga-6 flex-wrap">
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

        <v-text-field
          v-if="!editing"
          v-model="(form as any).password"
          class="mt-5"
          label="Senha"
          required
          :rules="[(v: string) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']"
          type="password"
        />
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
