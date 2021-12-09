FROM node:lts-alpine

WORKDIR /workdir

RUN mkdir src
COPY package.json .

RUN set -eux; \
  yarn --production;

COPY src src

CMD ["node", "src"]
