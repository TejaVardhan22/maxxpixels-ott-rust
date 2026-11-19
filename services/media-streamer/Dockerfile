# Multi-stage Dockerfile for Google Drive -> Bunny Stream Service (Go)
FROM golang:alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gdrive-bunny-stream .

FROM alpine:3.20 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/data && chown -R app:app /app

COPY --from=builder /out/gdrive-bunny-stream /usr/local/bin/gdrive-bunny-stream

USER app

EXPOSE 8085

ENTRYPOINT ["/usr/local/bin/gdrive-bunny-stream", "-server", "-port=8085"]
