CWD := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
DOCKER_GROUP_ID := $(shell cut -d: -f3 | getent group docker)
build:
	docker build -t hephaistos --build-arg docker_group_id=$(DOCKER_GROUP_ID) .
	mkdir -p ./data
	chmod 777 -R ./data
start:
	docker run --rm \
		--name hephaistos \
		--env "HEPHAISTOS_FOLDER=$(CWD)" \
		--volume '/var/run/docker.sock:/var/run/docker.sock' \
		--volume '$(CWD)/data:/home/defaultuser:rw' \
		-p '5000:8080' \
		hephaistos

console:
	docker run --rm -ti \
		--name hephaistos \
		--env "HEPHAISTOS_FOLDER=$(CWD)" \
		--volume '/var/run/docker.sock:/var/run/docker.sock' \
		--volume '$(CWD)/data:/home/defaultuser:rw' \
		-p '5000:8080' \
		--entrypoint=/bin/sh \
		hephaistos
stop:
	docker stop hephaistos
	#docker stop `docker ps | grep hephaistos | cut -d' ' -f1`
