build:
	docker build -t hephaistos .
start:
	docker run --rm --name hephaistos --privileged -p '5000:8080' hephaistos
stop:
	docker stop `docker ps | grep hephaistos | cut -d' ' -f1`
