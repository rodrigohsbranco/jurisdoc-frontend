# ====== Build stage ======
FROM node:20-alpine AS build

WORKDIR /app

# Instala deps (melhor para CI/build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o projeto e builda (Vite)
COPY . .
RUN npm run build-only

# ====== Run stage (Nginx) ======
FROM nginx:1.27-alpine

# Usa config SPA
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos gerados
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]