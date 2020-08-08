FROM node:buster-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      apt-transport-https \
      ca-certificates \
      curl \
      gnupg2 \
      software-properties-common && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add - && \
    add-apt-repository \
     "deb [arch=amd64] https://download.docker.com/linux/debian buster stable" && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      docker-ce docker-ce-cli containerd.io \
      gcc build-essential astyle cppcheck clang vera++ \
      vim \
      python3 python3-pip \
      ruby && \
    adduser --disabled-password --gecos "" defaultuser && \
    usermod -a -G defaultuser root && \
    usermod -a -G docker defaultuser && \
    chown root:defaultuser -R /app
# 740 = RWX R-- ---
# 633 = RW- -WX -WX
RUN chmod 770 -R /app && chmod 633 -R /tmp && umask 027
# RUN mkdir /home/defaultuser/python
# 660 = RW- RW- ---
# RUN chown defaultuser:defaultuser -R /home/defaultuser/python
# RUN chmod 770 -R /home/defaultuser/python

RUN pip3 install pytest pytest-timeout && \
    npm install --global mocha mocha-junit-reporter sinon sinon-test chai

ADD . /app

RUN ln -s /app/langs/c/options/vera.rules /usr/lib/vera++/profiles/platypus.rules && \
    mkdir -p /scripts && \
    chmod 444 -R /scripts && \
    chmod 555 /scripts && \
    cp /app/langs/c/unity.c \
       /app/langs/c/unity.h \
       /app/langs/c/unity_config.h \
       /app/langs/c/unity_internals.h \
       /scripts && \
    cp /app/langs/c/stylize_as_junit.rb /scripts && \
    mkdir -p /scripts/cppcheck/ && \
    chmod 636 -R /scripts/cppcheck/ && \
    chown root:defaultuser -R /scripts/cppcheck

USER defaultuser
RUN npm install --production

ENV DEBUG=hephaistos:*
ENV PORT=8080
# ENV HEPH_PYTHON_FILES=python
# ENV HEPH_PYTHON_TIMEOUT=5s

EXPOSE 8080
ENTRYPOINT ["node", "./hephaistos.js"]
