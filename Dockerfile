FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Pipeline env vars are passed at build time
ARG NETBOX_URL
ARG NETBOX_TOKEN
ARG INFRA_DOMAIN
ARG ANSIBLE_PATH=/ansible
ARG GRAFANA_URL
ARG GRAFANA_TOKEN

# Run data pipeline then build the static site
RUN npm run generate-data && npm run build

# Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
