# Etapa de construção
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa de produção
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf

# Remova o conteúdo padrão do Nginx e copie o build da aplicação
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
