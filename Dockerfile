FROM node:14-alpine

WORKDIR /home/node/app

COPY package.json .
COPY package-lock.json .

RUN npm install

RUN npm prune --production

COPY src/ src/

CMD ["npm", "start"]
