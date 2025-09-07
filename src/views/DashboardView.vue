<script setup lang="ts">
  import { ref } from 'vue'

  // Mock inicial — depois vamos puxar do backend
  const kpis = ref([
    {
      label: 'Clientes',
      value: 128,
      icon: 'mdi-account-group',
      color: 'primary',
    },
    {
      label: 'Petições',
      value: 342,
      icon: 'mdi-file-document',
      color: 'secondary',
    },
    { label: 'Templates', value: 52, icon: 'mdi-file-word', color: 'indigo' },
    { label: 'Pendências', value: 7, icon: 'mdi-alert-circle', color: 'warning' },
  ])

  // Adiciona 'to' no item "Novo Cliente"
  const quickActions = [
    {
      label: 'Novo Cliente',
      icon: 'mdi-account-plus',
      color: 'primary',
      to: { name: 'clientes' },
    },
    { label: 'Nova Petição', icon: 'mdi-file-plus', color: 'secondary' },
    { label: 'Novo Template', icon: 'mdi-file-word', color: 'indigo', to: { name: 'templates' } },
    { label: 'Relatórios', icon: 'mdi-chart-bar', color: 'success' },
  ]
</script>

<template>
  <v-container fluid>
    <!-- KPIs -->
    <v-row class="mb-4" dense>
      <v-col
        v-for="k in kpis"
        :key="k.label"
        cols="12"
        md="3"
        sm="6"
      >
        <v-card
          class="text-white rounded-xl"
          :color="k.color"
          elevation="2"
          variant="flat"
        >
          <v-card-item>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption opacity-80">{{ k.label }}</div>
                <div class="text-h5 font-weight-bold">{{ k.value }}</div>
              </div>
              <v-avatar class="bg-white bg-opacity-20" size="40">
                <v-icon color="white" :icon="k.icon" size="26" />
              </v-avatar>
            </div>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-row dense>
      <!-- Ações rápidas -->
      <v-col cols="12" md="8">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-flash" /> Ações rápidas
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col
                v-for="a in quickActions"
                :key="a.label"
                cols="12"
                md="6"
                sm="6"
              >
                <v-btn
                  block
                  class="text-none py-6"
                  :color="a.color"
                  :disabled="
                    !a.to && a.label === 'Novo Cliente' ? false : false
                  "
                  size="large"
                  :to="a.to"
                  variant="tonal"
                >
                  <v-icon :icon="a.icon" start /> {{ a.label }}
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Atividade recente (placeholder) -->
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-history" /> Atividade recente
          </v-card-title>
          <v-divider />
          <v-list>
            <v-list-item>
              <v-list-item-title>Petição gerada</v-list-item-title>
              <v-list-item-subtitle>Cliente: Maria da Silva — há 2h</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Novo cliente</v-list-item-title>
              <v-list-item-subtitle>João Souza — há 5h</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Template atualizado</v-list-item-title>
              <v-list-item-subtitle>“Ação INSS” — ontem</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
