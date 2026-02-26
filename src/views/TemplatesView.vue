<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  type FieldsResponse,
  type TemplateField,
  type TemplateItem,
  useTemplatesStore,
} from "@/stores/templates";

const templates = useTemplatesStore();

// =============================
// Tabela
// =============================
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "name", order: "asc" },
]);

const headers = [
  { title: "Nome", key: "name" },
  { title: "Arquivo", key: "file" },
  { title: "Ativo", key: "active" },
  { title: "Ações", key: "actions", sortable: false, align: "end" as const },
];

// =============================
// Criar/editar
// =============================
const dialogUpsert = ref(false);
const editing = ref<TemplateItem | null>(null);
const form = reactive<{ name: string; active: boolean; file: File | null }>({
  name: "",
  active: true,
  file: null,
});

function openCreate() {
  editing.value = null;
  form.name = "";
  form.active = true;
  form.file = null;
  dialogUpsert.value = true;
}

function openEdit(item: TemplateItem) {
  editing.value = item;
  form.name = item.name;
  form.active = item.active;
  form.file = null;
  dialogUpsert.value = true;
}

async function saveUpsert() {
  try {
    if (!form.name.trim()) throw new Error("Informe o nome do template.");
    if (!editing.value && !form.file)
      throw new Error("Selecione o arquivo .docx.");

    await (editing.value
      ? templates.update(editing.value.id, {
          name: form.name.trim(),
          active: form.active,
          ...(form.file ? { file: form.file } : {}),
        })
      : templates.create({
          name: form.name.trim(),
          file: form.file as File,
          active: form.active,
        }));
    dialogUpsert.value = false;
  } catch (error_) {
    // store já preenche lastError
    console.error(error_);
  }
}

function onPickFile(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  form.file = files && files.length > 0 ? files[0] : null;
}

// =============================
// Remover
// =============================
async function removeTemplate(item: TemplateItem) {
  if (!confirm(`Excluir o template "${item.name}"?`)) return;
  try {
    await templates.remove(item.id);
  } catch (error_) {
    console.error(error_);
  }
}

// =============================
// Campos
// =============================
const dialogFields = ref(false);
const fieldsLoading = ref(false);
const fieldsOf = ref<FieldsResponse | null>(null);
const fieldsOfItem = ref<TemplateItem | null>(null);

async function openFields(item: TemplateItem) {
  fieldsLoading.value = true;
  fieldsOfItem.value = item;
  fieldsOf.value = null;
  dialogFields.value = true;
  try {
    fieldsOf.value = await templates.fetchFields(item.id, { force: true });
  } catch (error_) {
    console.error(error_);
  } finally {
    fieldsLoading.value = false;
  }
}

// =============================
// Render
// =============================
const dialogRender = ref(false);
const renderItem = ref<TemplateItem | null>(null);
const renderFields = ref<TemplateField[]>([]);
const renderContext = ref<Record<string, any>>({});
const renderFilename = ref("");
const rendering = ref(false);

// Caso queira ativar no futuro
// async function openRender (item: TemplateItem) {
//   try {
//     const f = await templates.fetchFields(item.id)
//     if (f.syntax && f.syntax.toLowerCase().includes('angle')) {
//       templates.lastError =
//         'Este template ainda usa << >>. Atualize para {{ }} antes de gerar.'
//       return
//     }
//     renderItem.value = item
//     renderFields.value = f.fields
//     renderContext.value = {}
//     renderFilename.value = `${item.name}.docx`
//     dialogRender.value = true
//   } catch (e) {
//     console.error(e)
//   }
// }

async function doRender() {
  if (!renderItem.value) return;
  rendering.value = true;
  try {
    const result = await templates.render(renderItem.value.id, {
      context: renderContext.value,
      filename: renderFilename.value.trim() || undefined,
    });
    templates.downloadRendered(result);
    dialogRender.value = false;
  } catch (error_) {
    console.error(error_);
  } finally {
    rendering.value = false;
  }
}

// =============================
// Computed & inicialização
// =============================
const loadingList = computed(() => templates.loadingList);
const error = computed(() => templates.lastError);
const items = computed(() => templates.items);

async function load() {
  await templates.fetch({});
}

onMounted(load);
</script>

<template>
  <v-container fluid>
    <!-- Cabeçalho -->
    <v-card class="rounded mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Templates (.docx)</div>
          <div class="text-body-2 text-medium-emphasis">
            Upload, campos e geração de documentos
          </div>
        </div>
        <v-spacer />
        <v-btn color="primary" prepend-icon="mdi-file-word" @click="openCreate">
          Novo template
        </v-btn>
      </v-card-title>
    </v-card>

    <!-- Lista -->
    <v-card class="rounded" elevation="2">
      <v-card-title class="d-flex align-center">
        <v-responsive max-width="300px" class="mt-2" >
          <v-text-field
            v-model="search"
            clearable
            density="compact"
            variant="outlined"
            hide-details
            label="Buscar"
            prepend-inner-icon="mdi-magnify"
          />
        </v-responsive>
      </v-card-title>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>

        <v-data-table
          v-model:sort-by="sortBy"
          class="rounded-lg"
          :headers="headers"
          item-key="id"
          :items="items"
          :loading="loadingList"
          loading-text="Carregando..."
          :search="search"
        >
          <template #item.file="{ item }">
            <v-btn
              :href="item.file"
              prepend-icon="mdi-download"
              rel="noopener"
              size="small"
              target="_blank"
              variant="text"
            >
              Download
            </v-btn>
          </template>

          <template #item.active="{ item }">
            <v-chip
              :color="item.active ? 'secondary' : undefined"
              size="small"
              variant="elevated"
            >
              {{ item.active ? "Ativo" : "Inativo" }}
            </v-chip>
          </template>

          <template #item.actions="{ item }">
            <v-btn icon size="small" variant="text" @click="openFields(item)">
              <v-icon icon="mdi-code-braces" />
            </v-btn>
            <!-- Para ativar depois:
            <v-btn icon size="small" variant="text" @click="openRender(item)">
              <v-icon icon="mdi-download" />
            </v-btn> -->
            <v-btn icon size="small" variant="text" @click="openEdit(item)">
              <v-icon icon="mdi-pencil" />
            </v-btn>
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="removeTemplate(item)"
            >
              <v-icon icon="mdi-delete" />
            </v-btn>
          </template>

          <template #no-data>
            <v-sheet class="pa-6 text-center text-medium-emphasis">
              Nenhum template cadastrado.
            </v-sheet>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Dialog criar/editar -->
    <v-dialog v-model="dialogUpsert" max-width="720">
      <v-card>
        <v-card-title>{{
          editing ? "Editar template" : "Novo template"
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveUpsert">
            <v-row dense>
              <v-col cols="12" md="8">
                <v-text-field v-model="form.name" label="Nome" required />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="form.active"
                  color="secondary"
                  hide-details
                  label="Ativo"
                />
              </v-col>
              <v-col cols="12">
                <v-file-input
                  accept=".docx"
                  :hint="
                    editing
                      ? 'Envie para substituir o arquivo atual (opcional).'
                      : ''
                  "
                  label="Arquivo (.docx)"
                  persistent-hint
                  prepend-icon="mdi-file-word"
                  @change="onPickFile"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveUpsert">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog campos -->
    <v-dialog v-model="dialogFields" max-width="760">
      <v-card>
        <v-card-title class="d-flex align-center">
          <div>
            <div class="text-subtitle-1">Campos do template</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ fieldsOfItem?.name }} — Sintaxe: {{ fieldsOf?.syntax || "—" }}
            </div>
          </div>
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="
              fieldsOf?.syntax &&
              fieldsOf.syntax.toLowerCase().includes('angle')
            "
            class="mb-4"
            type="warning"
            variant="tonal"
          >
            Este arquivo ainda possui marcadores no formato
            <code>&lt;&lt; &gt;&gt;</code>. Atualize para Jinja
            <code>{{ "{" }}{{ "}" }}</code
            >.
          </v-alert>

          <v-skeleton-loader v-if="fieldsLoading" type="table" />
          <template v-else>
            <v-alert
              v-if="!fieldsOf || fieldsOf.fields.length === 0"
              type="info"
              variant="tonal"
            >
              Nenhum campo detectado.
            </v-alert>
            <v-table v-else density="comfortable">
              <thead>
                <tr>
                  <th>Campo original</th>
                  <th>name (normalizado)</th>
                  <th>tipo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in fieldsOf!.fields" :key="f.name">
                  <td>{{ f.raw }}</td>
                  <td>
                    <code>{{ f.name }}</code>
                  </td>
                  <td>{{ f.type }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogFields = false">Fechar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog render -->
    <v-dialog v-model="dialogRender" max-width="840">
      <v-card>
        <v-card-title>Gerar documento</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="doRender">
            <v-text-field
              v-model="renderFilename"
              class="mb-4"
              label="Nome do arquivo (.docx)"
            />
            <div class="text-subtitle-2 mb-2">Preencha os campos</div>
            <v-row dense>
              <template v-for="f in renderFields" :key="f.name">
                <v-col cols="12" md="6">
                  <component
                    :is="f.type === 'bool' ? 'v-switch' : 'v-text-field'"
                    v-model="renderContext[f.name]"
                    :hide-details="f.type === 'bool'"
                    :label="f.raw || f.name"
                    :type="f.type === 'int' ? 'number' : 'text'"
                  />
                </v-col>
              </template>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogRender = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="rendering" @click="doRender"
            >Gerar & baixar</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* ajustes visuais suaves */
</style>
