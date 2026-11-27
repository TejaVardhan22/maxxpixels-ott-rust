# Multi-stage static Go microservice builder (~12MB Alpine image)
FROM golang:1.24-alpine AS builder
ARG SERVICE=api-gateway
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/${SERVICE}

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/service /app/service
USER nobody
ENTRYPOINT ["/app/service"]
