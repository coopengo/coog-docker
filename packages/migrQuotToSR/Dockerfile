FROM node:lts-alpine

RUN set -eux; \
  addgroup -g 1003 coog ; \
  adduser -u 1003 -G coog -s /bin/sh -D coog ;\
  adduser -D -g "" -G coog -H -u 1004 coog_saas ;

WORKDIR /usr/src/app

RUN mkdir src
COPY package.json .

RUN yarn --production

COPY src src

USER coog

CMD ["node", "src"]
