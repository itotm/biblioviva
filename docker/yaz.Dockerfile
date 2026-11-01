# Small helper image with the YAZ Z39.50 client, used only on development hosts
# where the `yaz` package cannot be installed natively (see docs/DECISIONS.md ADR-001).
FROM docker.io/library/debian:trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends yaz ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
ENTRYPOINT ["yaz-client"]
