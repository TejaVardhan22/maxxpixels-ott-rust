.PHONY: tidy build test run-all run-gateway run-identity run-catalog run-streaming run-commerce run-monetization run-platform run-worker run-media-streamer

tidy:
	go mod tidy

build:
	go build -o bin/api-gateway ./cmd/api-gateway
	go build -o bin/identity-service ./cmd/identity-service
	go build -o bin/catalog-service ./cmd/catalog-service
	go build -o bin/streaming-service ./cmd/streaming-service
	go build -o bin/commerce-service ./cmd/commerce-service
	go build -o bin/monetization-service ./cmd/monetization-service
	go build -o bin/platform-service ./cmd/platform-service
	go build -o bin/worker-service ./cmd/worker-service
	go build -o bin/media-streamer ./cmd/media-streamer
	go build -o bin/all-in-one ./cmd/all-in-one

test:
	go test -race ./...

run-all:
	go run ./cmd/all-in-one

run-gateway:
	go run ./cmd/api-gateway

run-identity:
	go run ./cmd/identity-service

run-catalog:
	go run ./cmd/catalog-service

run-streaming:
	go run ./cmd/streaming-service

run-commerce:
	go run ./cmd/commerce-service

run-monetization:
	go run ./cmd/monetization-service

run-platform:
	go run ./cmd/platform-service

run-worker:
	go run ./cmd/worker-service

run-media-streamer:
	go run ./cmd/media-streamer
