FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY worker.js ./

ENV PORT=7860
EXPOSE 7860

CMD ["npm", "start"]
