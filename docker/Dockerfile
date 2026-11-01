# syntax=docker/dockerfile:1
# BiblioViva container image (PLAN.md step 8.1, Appendix E, ADR-020). The build stage runs on the
# build host's platform (Bun crashes under QEMU); the other stages run on the target platform but
# never run Bun. The server bundle is self-contained: every package is bundled (vite.config.ts), so
# there are no node_modules at runtime (verified in 8.1, again with adapter-bun 1.0).
FROM --platform=$BUILDPLATFORM docker.io/oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
ENV NODE_ENV=production
# build/server/_app holds the server build's copies of the client assets (OpenCV.js, the barcode
# WebAssembly, ~12 MB): the server only needs their URLs, the files are served from build/client
RUN bunx svelte-kit sync && bun run --bun vite build && rm -rf build/server/_app
# the operators' helpers as standalone files (step 8.5): restore an "Esporta tutto" archive, hash a
# password for config.json, check, export and import the configuration (step 11.3) — usable inside
# the container, no sources needed; and the server's start, with `--smol` when the hardware
# profile asks for it (step 9.28)
RUN bun build scripts/backup-restore.ts scripts/hash-password.ts scripts/config-check.ts \
    scripts/config-export.ts scripts/config-import.ts scripts/start.ts --target bun --outdir cli

# YAZ and a BusyBox shell from Debian trixie, the release the distroless base is built from: only
# yaz-client and the libraries it links are kept (glibc is already in the base), not the whole
# `yaz` package with its ICU data (ADR-020)
FROM docker.io/oven/bun:1.4.4-distroless AS base
FROM docker.io/library/debian:trixie-slim AS system
RUN apt-get update \
 && apt-get install -y --no-install-recommends yaz busybox-static \
 && rm -rf /var/lib/apt/lists/*
COPY --from=base /etc/passwd /etc/group /tmp/base/
RUN set -e; mkdir -p /out/usr/bin; cp /usr/bin/yaz-client /bin/busybox /out/usr/bin/; \
    for lib in $(ldd /usr/bin/yaz-client | awk '/=> \// { print $3 }'); do \
        case "$(basename "$lib")" in libc.so.*|libm.so.*) continue ;; esac; \
        real=$(realpath "$lib"); dir=$(dirname "$real"); mkdir -p "/out$dir"; \
        cp "$real" "/out$real"; ln -sf "$(basename "$real")" "/out$dir/$(basename "$lib")"; \
    done; \
    for applet in $(busybox --list); do \
        [ -e "/out/usr/bin/$applet" ] || ln -s busybox "/out/usr/bin/$applet"; \
    done; \
    mkdir -p /out/etc /out/home/bun /out/data /out/config /out/backups; \
    cp /tmp/base/passwd /tmp/base/group /out/etc/; \
    echo 'bun:x:1000:1000:bun:/home/bun:/usr/bin/sh' >> /out/etc/passwd; \
    echo 'bun:x:1000:' >> /out/etc/group; \
    chown 1000:1000 /out/home/bun /out/data /out/config /out/backups

FROM base AS runtime
COPY --from=system /out/ /
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 BODY_SIZE_LIMIT=32M \
    CONNECTION_IDLE_TIMEOUT=120 \
    PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host \
    ADDRESS_HEADER=x-forwarded-for XFF_DEPTH=1 \
    DATA_DIR=/data CONFIG_DIR=/config BACKUP_DIR=/backups DATABASE_PATH=/data/db/biblioviva.db
COPY --from=build /app/build ./build
# the shipped defaults (reports, templates, stocks, taxonomy), the demo portraits and the
# migrations, read at runtime
COPY --from=build /app/config ./config
COPY --from=build /app/demo ./demo
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/cli ./cli
USER bun
VOLUME ["/config", "/data", "/backups"]
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:3000/healthz').catch(()=>null); process.exit(r&&r.ok?0:1)"]
ENTRYPOINT ["bun", "./cli/start.js", "./build"]
