# Multi-stage Dockerfile for MaxxPixels Games Service (Go)
FROM golang:1.22-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/maxx-games-service .

# Production runtime stage
FROM alpine:3.20 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S app && adduser -S app -G app

COPY --from=builder /out/maxx-games-service /usr/local/bin/maxx-games-service
COPY migrations ./migrations

RUN chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV GAMES_SERVICE_PORT=8090

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8090/healthz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/maxx-games-service"]
