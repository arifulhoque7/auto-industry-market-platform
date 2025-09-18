FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]