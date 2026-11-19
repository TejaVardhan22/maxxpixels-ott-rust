# Multi-stage Dockerfile for MaxxPixels OTT API (Rust + Axum)
FROM rust:bookworm AS builder

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY migrations ./migrations

RUN cargo build --release --bin maxx-api && \
    cp target/release/maxx-api /usr/local/bin/maxx-api

# Production runtime stage
FROM debian:bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gzip \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app app \
    && mkdir -p /app/uploads/posters /app/uploads/banners /app/backups \
    && chown -R app:app /app

COPY --from=builder /usr/local/bin/maxx-api /usr/local/bin/maxx-api

USER app

ENV RUST_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8081
ENV RUST_LOG=info

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8081/ping || exit 1

ENTRYPOINT ["/usr/local/bin/maxx-api"]
