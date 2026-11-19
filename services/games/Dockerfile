# Multi-stage Dockerfile for MaxxPixels Games Service (Rust + Axum)
FROM rust:bookworm AS builder

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release --bin maxx-games-service && \
    cp target/release/maxx-games-service /usr/local/bin/maxx-games-service

# Production runtime stage
FROM debian:bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app app

COPY --from=builder /usr/local/bin/maxx-games-service /usr/local/bin/maxx-games-service

USER app

ENV NODE_ENV=production
ENV GAMES_SERVICE_PORT=8090
ENV RUST_LOG=info

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8090/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/maxx-games-service"]
