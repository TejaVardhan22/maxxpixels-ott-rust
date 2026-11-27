# Multi-stage Dockerfile for MaxxPixels Admin (React + Refine + Ant Design) served via Nginx
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=production

RUN npx tsc --noEmit && npx vite build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
