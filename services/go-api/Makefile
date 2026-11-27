.PHONY: tidy build test run-gateway run-identity run-catalog run-streaming

tidy:
	go mod tidy

build:
	go build -o bin/api-gateway ./cmd/api-gateway
	go build -o bin/identity-service ./cmd/identity-service
	go build -o bin/catalog-service ./cmd/catalog-service
	go build -o bin/streaming-service ./cmd/streaming-service

test:
	go test -race ./...

run-gateway:
	go run ./cmd/api-gateway

run-identity:
	go run ./cmd/identity-service

run-catalog:
	go run ./cmd/catalog-service

run-streaming:
	go run ./cmd/streaming-service
