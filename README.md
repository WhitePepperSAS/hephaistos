# Héphaïstos

install:
```bash
make build
```

run:
```bash
make start
```

stop:
```bash
make stop
```

start a test:
```bash
curl -d "{\"content\":\"$(base64 -w0 doc/python/moduletotest.py)\",\"test\":\"$(base64 -w0 doc/python/tests.py)\"}" -X POST -H "Content-Type: application/json" http://127.0.0.1:5000/python/test
```
