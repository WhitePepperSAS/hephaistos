# Héphaïstos

install:
```bash
docker -t hephaistos .
```

run:
```bash
docker run --rm  --name hephaistos -p '5000:8080' hephaistos
```

stop:
```bash
docker stop $(docker ps | grep hephaistos | cut -d' ' -f1)
```
