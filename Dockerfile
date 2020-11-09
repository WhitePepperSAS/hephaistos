FROM node:buster-slim
WORKDIR /app
ARG docker_group_id

RUN echo 'deb http://deb.debian.org/debian testing main' > /etc/apt/sources.list.d/testing.list
RUN echo 'Package: *\n\
Pin: release a=stable\n\
Pin-Priority: 700\n\
\n\
Package: *\n\
Pin: release a=testing\n\
Pin-Priority: 650\n\
' >> /etc/apt/preferences.d/pin

RUN apt-get update && \
    echo -e "\n*** Install BASE ***\n" && \
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
    echo -e "\n*** Install DOCKER ***\n" && \
    apt-get install -y --no-install-recommends \
      docker-ce docker-ce-cli containerd.io \
      build-essential astyle cppcheck clang vera++ valgrind \
      vim \
      python3 python3-pip \
      ruby && \
    echo -e "\n*** Install GCC 9 ***\n" && \
    apt-get install -y -t testing gcc-9 gcc-9-locales && \
    adduser --disabled-password --gecos "" defaultuser && \
    usermod -a -G defaultuser root && \
    usermod -a -G docker defaultuser && \
    groupmod -g "${docker_group_id}" docker && \
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
    chown root:defaultuser -R /scripts/cppcheck && \
    mkdir -p /hephaistos/data && \
    chmod 777 -R /hephaistos

RUN chown root:defaultuser -R /app

USER defaultuser
RUN npm install --production

ENV DEBUG=hephaistos:*
ENV PORT=8080
# ENV HEPH_PYTHON_FILES=python
# ENV HEPH_PYTHON_TIMEOUT=5s
ENV HEPHAISTOS_FOLDER=/data/prod/hephaistos-data

EXPOSE 8080
ENTRYPOINT ["node", "./hephaistos.js"]
