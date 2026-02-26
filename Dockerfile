# ====== Build stage ======
FROM node:20-alpine AS build

WORKDIR /app

# Instala deps primeiro (cache eficiente)
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o resto e builda
COPY . .
RUN npm run build-only

# ====== Run stage (Nginx) ======
FROM nginx:1.27-alpine

# Remove config default e coloca a nossa (SPA fallback)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia build do Vite
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]