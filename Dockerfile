# syntax=docker/dockerfile:1.10
# Production image for AWS (ECS Fargate, ARM). Built and deployed by scripts/deploy-aws.sh.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG DEPLOYMENT_ID
ENV DEPLOYMENT_ID=$DEPLOYMENT_ID NEXT_TELEMETRY_DISABLED=1
# The catalogue is prerendered from the database when it is reachable; the URL comes in
# as a build secret so it never lands in an image layer. Without it the build still works.
RUN --mount=type=secret,id=database_url,env=DATABASE_URL npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
