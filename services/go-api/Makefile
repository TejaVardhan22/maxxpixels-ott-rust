.PHONY: tidy build test run-gateway run-identity

tidy:
	go mod tidy

build:
	go build -o bin/api-gateway ./cmd/api-gateway
	go build -o bin/identity-service ./cmd/identity-service

test:
	go test -race ./...

run-gateway:
	go run ./cmd/api-gateway

run-identity:
	go run ./cmd/identity-service
