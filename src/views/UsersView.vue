<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import {
    createUser,
    deleteUser,
    listUsers,
    setUserPassword,
    updateUser,
    type User,
  } from '@/services/users'

  // estado básico
  const loading = ref(false)
  const items = ref<User[]>([])
  const error = ref('')

  // busca e paginação/ordenação (tudo client-side)
  const search = ref('')
  const page = ref(1)
  const itemsPerPage = ref(10)
  const sortBy = ref<{ key: string, order?: 'asc' | 'desc' }[]>([
    { key: 'username', order: 'asc' },
  ])

  // diálogos
  const dialog = ref(false)
  const editing = ref<User | null>(null)
  const form = ref<Partial<User> & { password?: string }>({
    is_admin: false,
    is_active: true,
  })
  const pwdDialog = ref(false)
  const pwdTarget = ref<User | null>(null)
  const newPassword = ref('')

  // cabeçalhos (simples; sem tipagem avançada)
  const headers = [
    { title: 'Usuário', key: 'username' },
    { title: 'Nome', key: 'first_name' },
    { title: 'Sobrenome', key: 'last_name' },
    { title: 'Email', key: 'email' },
    { title: 'Admin', key: 'is_admin', sortable: true },
    { title: 'Ativo', key: 'is_active', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'end' as const },
  ]

  // carregar todos os usuários (uma vez) — simples e eficiente para volumes modestos
  async function fetchUsers () {
    loading.value = true
    error.value = ''
    try {
      // pega bastante de uma vez; se um dia crescer muito, voltamos ao server-side
      const data = await listUsers({ page: 1, page_size: 1000 })
      items.value = data.results
    } catch (error_: any) {
      error.value = error_?.response?.data?.detail || 'Falha ao carregar usuários.'
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchUsers)

  function openCreate () {
    editing.value = null
    form.value = {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      is_admin: false,
      is_active: true,
      password: '',
    }
    dialog.value = true
  }

  function openEdit (u: User) {
    editing.value = u
    // não carregamos senha existente
    form.value = { ...u, password: undefined }
    dialog.value = true
  }

  async function save () {
    try {
      if (editing.value) {
        // editando
        const { password, ...rest } = form.value
        await updateUser(editing.value.id, rest)
        // atualiza lista localmente
        const idx = items.value.findIndex(i => i.id === editing.value!.id)
        if (idx !== -1)
          items.value[idx] = { ...items.value[idx], ...(rest as any) }
      } else {
        // criando (senha obrigatória)
        if (!form.value.password || form.value.password.length < 6) {
          throw new Error('Senha mínima de 6 caracteres.')
        }
        const created = await createUser(form.value as any)
        items.value.unshift(created) // coloca no topo
      }
      dialog.value = false
    } catch (error_: any) {
      error.value = error_?.response?.data?.detail || error_?.message || 'Erro ao salvar.'
    }
  }

  async function remove (u: User) {
    try {
      await deleteUser(u.id)
      items.value = items.value.filter(i => i.id !== u.id)
    } catch (error_: any) {
      error.value = error_?.response?.data?.detail || 'Não foi possível excluir.'
    }
  }

  function openSetPassword (u: User) {
    pwdTarget.value = u
    newPassword.value = ''
    pwdDialog.value = true
  }

  async function applyPassword () {
    if (!pwdTarget.value) return
    if (newPassword.value.length < 6) {
      error.value = 'Senha mínima de 6 caracteres.'
      return
    }
    try {
      await setUserPassword(pwdTarget.value.id, newPassword.value)
      pwdDialog.value = false
    } catch (error_: any) {
      error.value = error_?.response?.data?.detail || 'Falha ao alterar senha.'
    }
  }
</script>

<template>
  <v-container fluid>
    <v-card class="rounded-xl" elevation="2">
      <v-card-title class="d-flex align-center">
        <span>Usuários</span>
        <v-spacer />
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Buscar"
          prepend-inner-icon="mdi-magnify"
          style="max-width: 300px"
        />
        <v-btn class="ml-2" color="primary" @click="openCreate">
          <v-icon icon="mdi-account-plus" start /> Novo usuário
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loading"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.is_admin="{ item }">
            <v-chip
              :color="item.is_admin ? 'secondary' : undefined"
              size="small"
              variant="tonal"
            >
              {{ item.is_admin ? "Admin" : "—" }}
            </v-chip>
          </template>

          <template #item.is_active="{ item }">
            <v-switch
              color="success"
              density="compact"
              hide-details
              :model-value="item.is_active"
              @update:model-value="
                (val) => {
                  updateUser(item.id, { is_active: !!val })
                    .then(() => {
                      item.is_active = !!val;
                    })
                    .catch(() => {
                      /* volta visual se falhar */
                    });
                }
              "
            />
          </template>

          <template #item.actions="{ item }">
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn
              color="indigo"
              icon
              size="small"
              variant="text"
              @click="openSetPassword(item)"
            >
              <v-icon icon="mdi-lock-reset" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="remove(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum usuário encontrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialog" max-width="560">
      <v-card>
        <v-card-title>{{
          editing ? "Editar usuário" : "Novo usuário"
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="save">
            <v-text-field v-model="form.username" label="Usuário" required />
            <v-text-field v-model="form.first_name" label="Nome" />
            <v-text-field v-model="form.last_name" label="Sobrenome" />
            <v-text-field v-model="form.email" label="Email" type="email" />
            <v-switch
              v-model="form.is_admin"
              color="secondary"
              label="Administrador"
            />
            <v-switch v-model="form.is_active" color="success" label="Ativo" />

            <v-text-field
              v-if="!editing"
              v-model="(form as any).password"
              label="Senha"
              required
              :rules="[(v) => (!!v && v.length >= 6) || 'Mínimo 6 caracteres']"
              type="password"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="save">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog definir senha -->
    <v-dialog v-model="pwdDialog" max-width="480">
      <v-card>
        <v-card-title>Definir nova senha</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newPassword"
            label="Nova senha"
            type="password"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pwdDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="applyPassword">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
