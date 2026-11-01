#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Runs yaz-client inside the biblioviva-yaz container (ADR-001). The current
# directory is mounted at /work so relative command and output files work.
# Build the image once with: bun run yaz:image
set -euo pipefail
engine="${CONTAINER_ENGINE:-podman}"
exec "$engine" run --rm -i --network host -v "$PWD:/work:Z" -w /work biblioviva-yaz "$@"
