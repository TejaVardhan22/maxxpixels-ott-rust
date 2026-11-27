# Multi-stage static Go microservices builder (builds all 10 services in one shared cache pass)
FROM golang:1.24-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN mkdir -p /out && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api-gateway ./cmd/api-gateway && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/identity-service ./cmd/identity-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/catalog-service ./cmd/catalog-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/streaming-service ./cmd/streaming-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/commerce-service ./cmd/commerce-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/monetization-service ./cmd/monetization-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/platform-service ./cmd/platform-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/worker-service ./cmd/worker-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/games-service ./cmd/games-service && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/media-streamer ./cmd/media-streamer

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
RUN mkdir -p /app/backups /app/uploads && chown -R nobody:nobody /app/backups /app/uploads
COPY --from=builder /out/ /app/
USER nobody
ENTRYPOINT ["/app/api-gateway"]
