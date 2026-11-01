#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Runs the fake yaz-client (tests/helpers/fake-yaz.ts) with the arguments of the real one.
exec bun "$(dirname "$0")/fake-yaz.ts" "$@"
