FROM node:stretch

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc build-essential \
    astyle \
    cppcheck \
    clang \
    vera++ \
    vim \
    python3 \
    python3-pip \
    firejail

RUN adduser --disabled-password --gecos "" defaultuser
# RUN adduser --disabled-password --gecos "" pythonuser

RUN usermod -a -G defaultuser root

RUN chown root:defaultuser -R /app
# 740 = RWX R-- ---
RUN chmod 770 -R /app
# 666 = RW- RW- RW-
# FIXME: not working properly
RUN chmod 633 -R /tmp
# RUN mkdir /home/defaultuser/python
# 660 = RW- RW- ---
# RUN chown defaultuser:defaultuser -R /home/defaultuser/python
# RUN chmod 770 -R /home/defaultuser/python
RUN umask 027

RUN pip3 install pytest pytest-timeout

ADD . /app

RUN ln -s /app/options/vera.rules /usr/lib/vera++/profiles/platypus.rules
RUN cp /app/c/unity.c /app/c/unity.h /app/c/unity_config.h /app/c/unity_internals.h /home/defaultuser
RUN mkdir -p /home/defaultuser/cppcheck/
RUN chmod 636 -R /home/defaultuser/cppcheck/
RUN chown root:defaultuser -R /home/defaultuser/cppcheck
# RUN cp /app/python/python3.profile /etc/firejail/
# RUN rm /app/python/python3.profile

USER defaultuser
RUN npm install --production

ENV DEBUG=hephaistos:*
ENV PORT=8080
# ENV HEPH_PYTHON_FILES=python
# ENV HEPH_PYTHON_TIMEOUT=5s

EXPOSE 8080
ENTRYPOINT ["node", "./hephaistos.js"]
