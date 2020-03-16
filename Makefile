CWD := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
build:
	docker build -t hephaistos .
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
stop:
	docker stop hephaistos
	#docker stop `docker ps | grep hephaistos | cut -d' ' -f1`
