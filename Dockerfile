FROM node:slim

WORKDIR /app

ADD . /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc build-essential \
    astyle \
    cppcheck \
    clang \
    vera++ \
    vim

RUN ln -s /app/options/vera.rules /usr/lib/vera++/profiles/platypus.rules

RUN adduser --disabled-password --gecos "" defaultuser

RUN chown defaultuser:defaultuser -R /app

USER defaultuser

RUN npm install --production

ENV DEBUG=hephaistos:*
ENV PORT=8080

EXPOSE 8080
ENTRYPOINT ["node", "./hephaistos.js"]
