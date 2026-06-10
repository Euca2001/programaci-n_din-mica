FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssh-client wget

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npm run generate-cert

RUN mkdir -p uploads data certs

EXPOSE 443 80 2222 8443 8080

ENV HTTPS_PORT=443
ENV HTTP_PORT=80
ENV SFTP_PORT=2222
ENV NODE_ENV=production

CMD ["node", "server.js"]
