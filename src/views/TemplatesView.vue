<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  type FieldsResponse,
  type TemplateItem,
  useTemplatesStore,
} from "@/stores/templates";
import { useSnackbar } from "@/composables/useSnackbar";
import { friendlyError } from "@/utils/errorMessages";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SidePanel from "@/components/SidePanel.vue";

const templates = useTemplatesStore();
const { showSuccess } = useSnackbar();

// Confirm dialog
const confirmVisible = ref(false);
const confirmMessage = ref("");
const confirmAction = ref<(() => void) | null>(null);

// =============================
// Tabela
// =============================
const search = ref("");
const sortBy = ref<{ key: string; order?: "asc" | "desc" }[]>([
  { key: "name", order: "asc" },
]);
const expanded = ref<readonly any[]>([]);
const page = ref(1);
const itemsPerPage = ref(10);

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    load();
  }, 400);
});

const headers = [
  { title: "", key: "data-table-expand", width: "40px" },
  { title: "Template", key: "name" },
  { title: "Status", key: "active" },
  { title: "", key: "actions", sortable: false, width: "48px" },
];

// =============================
// Expanded row: campos
// =============================
const fieldsCache = ref<Record<number, FieldsResponse | null>>({});
const fieldsLoadingFor = ref<number | null>(null);

async function loadFieldsForExpand(itemId: number) {
  if (fieldsCache.value[itemId]) return;
  fieldsLoadingFor.value = itemId;
  try {
    const resp = await templates.fetchFields(itemId, { force: true });
    fieldsCache.value[itemId] = resp;
  } catch {
    fieldsCache.value[itemId] = null;
  } finally {
    fieldsLoadingFor.value = null;
  }
}

function onExpandRow(expandedRows: readonly any[]) {
  expanded.value = expandedRows;
  for (const id of expandedRows) {
    if (!fieldsCache.value[id]) {
      loadFieldsForExpand(id);
    }
  }
}

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
    showSuccess(editing.value ? "Template atualizado!" : "Template criado!");
    await load();
  } catch (error_: any) {
    templates.lastError = friendlyError(error_, 'templates', editing.value ? 'update' : 'create');
  }
}

function onPickFile(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  form.file = files && files.length > 0 ? files[0] : null;
}

// =============================
// Remover
// =============================
function downloadTemplate(item: TemplateItem) {
  if (!item.file) return
  const a = document.createElement('a')
  a.href = item.file
  a.download = `${item.name}.docx`
  a.click()
}

async function removeTemplate(item: TemplateItem) {
  confirmMessage.value = `Excluir o template "${item.name}"?`;
  confirmAction.value = async () => {
    try {
      await templates.remove(item.id);
      showSuccess("Template excluído com sucesso!");
      await load();
    } catch (error_: any) {
      templates.lastError = friendlyError(error_, 'templates', 'remove');
    }
  };
  confirmVisible.value = true;
}

// =============================
// Toggle ativo
// =============================
async function toggleActive(item: TemplateItem) {
  try {
    await templates.setActive(item.id, !item.active);
    showSuccess(item.active ? "Template desativado!" : "Template ativado!");
    await load();
  } catch {
    // store já preenche lastError
  }
}

// =============================
// Computed & inicialização
// =============================
const loadingList = computed(() => templates.loadingList);
const error = computed(() => templates.lastError);
const items = computed(() => templates.items);
const totalTemplates = computed(() => templates.totalItems);

async function load() {
  const sort = sortBy.value[0];
  const ordering = sort ? `${sort.order === 'desc' ? '-' : ''}${sort.key}` : undefined;
  await templates.fetch({
    search: search.value || undefined,
    ordering,
    page: page.value,
    page_size: itemsPerPage.value,
  });
}

watch(page, load);
watch(itemsPerPage, () => { page.value = 1; load(); });
watch(sortBy, () => { page.value = 1; load(); }, { deep: true });

onMounted(load);
</script>

<template>
  <v-container fluid>
    <!-- Page header -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <div class="d-flex align-center ga-3">
          <h1 class="text-h5 font-weight-bold text-primary">Templates</h1>
          <v-chip v-if="totalTemplates" color="primary" size="small" variant="tonal">
            {{ totalTemplates }} {{ totalTemplates === 1 ? 'template' : 'templates' }}
          </v-chip>
        </div>
        <p class="text-body-2 text-medium-emphasis mt-1">Upload e gerenciamento de modelos .docx</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-file-word" @click="openCreate">
        Novo template
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
            placeholder="Buscar por nome..."
            prepend-inner-icon="mdi-magnify"
            style="max-width: 360px"
          />
        </div>

        <v-alert v-if="error" class="mb-4" closable type="error" @click:close="templates.lastError = null">
          {{ error }}
        </v-alert>

        <v-data-table-server
          v-model:expanded="expanded"
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
          :headers="headers"
          item-key="id"
          item-value="id"
          :items="items"
          :items-length="totalTemplates"
          :loading="loadingList"
          loading-text="Carregando..."
          show-expand
          @update:expanded="onExpandRow"
        >
          <!-- Nome com avatar -->
          <template #item.name="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar class="mr-3" color="primary" size="34" variant="tonal">
                <v-icon icon="mdi-file-word-outline" size="18" />
              </v-avatar>
              <div>
                <div class="text-body-2 font-weight-medium">{{ item.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  <a
                    :href="item.file"
                    class="text-decoration-none text-medium-emphasis"
                    rel="noopener"
                    target="_blank"
                    @click.stop
                  >
                    <v-icon icon="mdi-download" size="12" class="mr-1" />Download .docx
                  </a>
                </div>
              </div>
            </div>
          </template>

          <!-- Status -->
          <template #item.active="{ item }">
            <v-chip
              :color="item.active ? 'success' : 'default'"
              size="small"
              variant="tonal"
            >
              {{ item.active ? "Ativo" : "Inativo" }}
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
              <v-list density="compact" min-width="180">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  @click="openEdit(item)"
                />
                <v-list-item
                  prepend-icon="mdi-download-outline"
                  title="Download .docx"
                  @click="downloadTemplate(item)"
                />
                <v-list-item
                  :prepend-icon="item.active ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  :title="item.active ? 'Desativar' : 'Ativar'"
                  @click="toggleActive(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  class="text-error"
                  prepend-icon="mdi-delete-outline"
                  title="Excluir"
                  @click="removeTemplate(item)"
                />
              </v-list>
            </v-menu>
          </template>

          <!-- Expanded row: campos do template -->
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length">
                <div class="expanded-detail pa-4">
                  <div class="detail-label mb-3">Campos detectados</div>

                  <div v-if="fieldsLoadingFor === item.id" class="d-flex align-center ga-2 py-2">
                    <v-progress-circular color="primary" indeterminate size="18" width="2" />
                    <span class="text-body-2 text-medium-emphasis">Analisando template...</span>
                  </div>

                  <template v-else-if="fieldsCache[item.id]">
                    <v-alert
                      v-if="fieldsCache[item.id]!.syntax?.toLowerCase().includes('angle')"
                      class="mb-3"
                      density="compact"
                      type="warning"
                      variant="tonal"
                    >
                      Template usa sintaxe antiga <code>&lt;&lt; &gt;&gt;</code>. Atualize para Jinja <code>{{ "{" }}{{ "}" }}</code>.
                    </v-alert>

                    <div v-if="fieldsCache[item.id]!.fields.length === 0" class="text-body-2 text-medium-emphasis">
                      Nenhum campo detectado neste template.
                    </div>

                    <div v-else class="d-flex flex-wrap ga-2">
                      <v-chip
                        v-for="f in fieldsCache[item.id]!.fields"
                        :key="f.name"
                        color="primary"
                        size="small"
                        variant="tonal"
                      >
                        <span class="font-weight-medium">{{ f.name }}</span>
                        <span class="text-medium-emphasis ml-1">({{ f.type }})</span>
                      </v-chip>
                    </div>

                    <div class="text-caption text-medium-emphasis mt-2">
                      {{ fieldsCache[item.id]!.fields.length }} campo{{ fieldsCache[item.id]!.fields.length !== 1 ? 's' : '' }}
                      &middot; Sintaxe: {{ fieldsCache[item.id]!.syntax || '—' }}
                    </div>
                  </template>

                  <div v-else class="text-body-2 text-medium-emphasis">
                    Não foi possível carregar os campos.
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <template #no-data>
            <div class="pa-8 text-center">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-file-word-outline" size="40" />
              <div class="text-body-2 text-medium-emphasis">Nenhum template cadastrado</div>
            </div>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <!-- SidePanel criar/editar -->
    <SidePanel v-model="dialogUpsert" :width="520">
      <template #header>
        <div class="d-flex align-center">
          <v-avatar class="mr-3" color="primary" size="36" variant="tonal">
            <v-icon :icon="editing ? 'mdi-pencil-outline' : 'mdi-file-word'" size="18" />
          </v-avatar>
          <div>
            <div class="text-body-1 font-weight-bold">{{ editing ? "Editar template" : "Novo template" }}</div>
            <div v-if="editing" class="text-caption text-medium-emphasis">{{ editing.name }}</div>
          </div>
        </div>
      </template>

      <v-form @submit.prevent="saveUpsert">
        <!-- Nome -->
        <div class="text-caption text-medium-emphasis text-uppercase mb-2" style="letter-spacing: 0.05em">
          Informações do template
        </div>
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="form.name"
              label="Nome do template *"
              placeholder="Ex: Kit Contrato"
              required
            />
          </v-col>
        </v-row>

        <!-- Upload -->
        <div class="text-caption text-medium-emphasis text-uppercase mt-4 mb-2" style="letter-spacing: 0.05em">
          Arquivo do template
        </div>

        <!-- Arquivo atual (quando editando e não selecionou novo) -->
        <div v-if="editing && !form.file" class="current-file mb-3">
          <v-icon class="mr-2" color="primary" icon="mdi-file-word" size="20" />
          <div class="flex-grow-1">
            <span class="text-body-2 font-weight-medium">{{ editing.file.split('/').pop() }}</span>
            <div class="text-caption text-medium-emphasis">Arquivo atual</div>
          </div>
          <v-chip color="success" size="x-small" variant="tonal">Ativo</v-chip>
        </div>

        <div class="upload-area" @click="($refs.fileInput as HTMLInputElement)?.click()">
          <input
            ref="fileInput"
            accept=".docx"
            hidden
            type="file"
            @change="onPickFile"
          >
          <v-icon :color="form.file ? 'success' : 'primary'" :icon="form.file ? 'mdi-file-check-outline' : 'mdi-cloud-upload-outline'" size="32" />
          <div v-if="form.file" class="mt-2 text-center">
            <span class="text-body-2 font-weight-medium">{{ (form.file as File).name }}</span>
            <div class="text-caption text-success">Novo arquivo selecionado — clique para trocar</div>
          </div>
          <div v-else class="mt-2 text-center">
            <span class="text-body-2 font-weight-medium">
              {{ editing ? 'Clique para substituir o arquivo' : 'Clique para selecionar' }}
            </span>
            <div class="text-caption text-medium-emphasis">
              {{ editing ? 'Opcional — o arquivo atual será mantido se não enviar outro' : 'Arquivo .docx obrigatório' }}
            </div>
          </div>
        </div>

        <!-- Status -->
        <div class="text-caption text-medium-emphasis text-uppercase mt-5 mb-2" style="letter-spacing: 0.05em">
          Status
        </div>
        <v-switch
          v-model="form.active"
          color="success"
          density="compact"
          hide-details
          :label="form.active ? 'Template ativo' : 'Template inativo'"
        />
      </v-form>

      <template #actions>
        <v-btn variant="text" @click="dialogUpsert = false">Cancelar</v-btn>
        <v-btn color="primary" prepend-icon="mdi-check" @click="saveUpsert">Salvar</v-btn>
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
.expanded-detail {
  background: rgba(15, 43, 70, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.detail-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #CDA660;
}

.current-file {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f8fafe;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: 2px dashed #d0d4dd;
  border-radius: 8px;
  background: #fafbfd;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-area:hover {
  border-color: #3b6cb4;
  background: #f0f4fb;
}
</style>
