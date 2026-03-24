FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY certs/ /app/certs/

RUN npm install

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]