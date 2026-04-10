FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["sh", "-lc", "npm install && npm run dev"]

FROM base AS build
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
