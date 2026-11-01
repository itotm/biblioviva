#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# BiblioViva's installer (PLAN.md step 8.7), for a 64-bit Raspberry Pi OS, Debian or Ubuntu:
#
#   curl -fsSL https://raw.githubusercontent.com/itotm/biblioviva/main/setup.sh | bash
#
# It installs Docker when missing (asking first), asks how the devices reach BiblioViva (Tailscale
# or the local network), the hardware profile and, with Tailscale, the auth key, writes the stack
# into ~/biblioviva (compose.yml of the chosen way, .env, config/, backups/), starts it and prints
# the address to open. Run again, it updates BiblioViva; `--network tailscale|lan` changes the way,
# keeping the data. Every question has its option, so it also runs without a terminal:
#
#   setup.sh [--lang it|en] [--network tailscale|lan] [--profile micro|small|medium|large]
#            [--key <tskey-auth-…>] [--dir <folder>] [--yes]
#
# For tests and development: BIBLIOVIVA_SOURCE (a clone whose docker/ files are used instead of
# the downloaded ones), BIBLIOVIVA_REF (the branch or tag to download from), BIBLIOVIVA_INPUT (where
# the answers are read, /dev/tty by default), BIBLIOVIVA_OS_RELEASE, BIBLIOVIVA_MEMINFO and
# BIBLIOVIVA_MODEL_FILE (the files describing the computer).
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/itotm/biblioviva/${BIBLIOVIVA_REF:-main}"
INPUT="${BIBLIOVIVA_INPUT:-/dev/tty}"
OS_RELEASE="${BIBLIOVIVA_OS_RELEASE:-/etc/os-release}"
MEMINFO="${BIBLIOVIVA_MEMINFO:-/proc/meminfo}"
MODEL_FILE="${BIBLIOVIVA_MODEL_FILE:-/proc/device-tree/model}"
HEALTH_WAIT="${BIBLIOVIVA_HEALTH_WAIT:-180}"

UI_LANG=""
NETWORK=""
PROFILE=""
KEY="${TS_AUTHKEY:-}"
DIR="${BIBLIOVIVA_DIR:-$HOME/biblioviva}"
ASSUME_YES=0

# ---------------------------------------------------------------------------------------------
# Messages, in Italian and English (printf formats: %s are filled in order)

declare -A IT EN
IT[title]="Installazione di BiblioViva"
EN[title]="BiblioViva installation"
IT[not_linux]="Questo programma funziona solo su Linux (Raspberry Pi OS, Debian o Ubuntu)."
EN[not_linux]="This program runs on Linux only (Raspberry Pi OS, Debian or Ubuntu)."
IT[not_64]="Il sistema è a 32 bit (%s): BiblioViva richiede un sistema a 64 bit. Su un Raspberry Pi, installare Raspberry Pi OS (64-bit)."
EN[not_64]="The system is 32-bit (%s): BiblioViva needs a 64-bit system. On a Raspberry Pi, install Raspberry Pi OS (64-bit)."
IT[os_other]="Sistema %s: questo programma è provato su Raspberry Pi OS, Debian e Ubuntu. Si prosegue; in caso di problemi vedere docs/deploy.md."
EN[os_other]="System %s: this program is tested on Raspberry Pi OS, Debian and Ubuntu. Going on; if something fails, see docs/deploy.md."
IT[no_sudo]="Il comando sudo non è disponibile: eseguire il programma come amministratore oppure installare sudo."
EN[no_sudo]="The sudo command is not available: run the program as an administrator or install sudo."
IT[docker_missing]="Docker non è installato. Il programma lo installa con lo script ufficiale di Docker (https://get.docker.com): servono alcuni minuti e la password dell'utente."
EN[docker_missing]="Docker is not installed. The program installs it with Docker's official script (https://get.docker.com): it takes a few minutes and the user's password."
IT[docker_ask]="Installare Docker adesso? [S/n] "
EN[docker_ask]="Install Docker now? [Y/n] "
IT[docker_stop]="Docker non è stato installato: il programma si ferma. Installarlo e rieseguire il programma."
EN[docker_stop]="Docker was not installed: the program stops. Install it and run the program again."
IT[docker_group]="Docker è installato. Per usare il comando docker senza sudo, chiudere il terminale e collegarsi di nuovo al termine."
EN[docker_group]="Docker is installed. To use the docker command without sudo, close the terminal and connect again at the end."
IT[no_input]="Manca la risposta a una domanda e non c'è un terminale da cui leggerla: indicare %s."
EN[no_input]="An answer is missing and there is no terminal to read it from: give %s."
IT[q_network]="Come raggiungono BiblioViva i computer e i telefoni della biblioteca?
  1) Con Tailscale: indirizzo sicuro (HTTPS), fotocamera, telefoni, anche fuori dalla scuola. Serve un account Tailscale gratuito.
  2) Solo dalla rete locale della scuola: nessun account, ma senza fotocamera e solo dentro la scuola.
Scelta [1/2]: "
EN[q_network]="How do the library's computers and phones reach BiblioViva?
  1) With Tailscale: secure address (HTTPS), camera, phones, outside the school too. Needs a free Tailscale account.
  2) Only on the school's local network: no account, but no camera and only inside the school.
Choice [1/2]: "
IT[q_profile]="Che computer è questo?
  1) micro: un computer molto piccolo, con 512 MB di memoria
  2) small: un Raspberry Pi 4 con 2 GB e scheda SD
  3) medium: un PC non recente con disco rigido
  4) large: un PC con disco SSD
Scelta [%s, proposta per questo computer]: "
EN[q_profile]="What kind of computer is this?
  1) micro: a very small computer, with 512 MB of memory
  2) small: a Raspberry Pi 4 with 2 GB and an SD card
  3) medium: an older PC with a hard disk
  4) large: a PC with an SSD
Choice [%s, suggested for this computer]: "
IT[q_key]="Incollare la chiave di autenticazione di Tailscale (inizia con tskey-auth-): "
EN[q_key]="Paste the Tailscale auth key (it starts with tskey-auth-): "
IT[bad_choice]="Risposta non valida."
EN[bad_choice]="Invalid answer."
IT[bad_key]="La chiave di Tailscale deve iniziare con tskey-."
EN[bad_key]="The Tailscale key must start with tskey-."
IT[avahi]="Installazione di avahi-daemon, che rende raggiungibile il computer con il nome %s.local"
EN[avahi]="Installing avahi-daemon, which makes the computer reachable as %s.local"
IT[found]="BiblioViva è già installato in %s (%s): aggiornamento."
EN[found]="BiblioViva is already installed in %s (%s): updating."
IT[switch]="Cambio del modo di collegamento: da %s a %s. I dati restano."
EN[switch]="Changing the way of connecting: from %s to %s. The data stay."
IT[writing]="Preparazione della cartella %s"
EN[writing]="Preparing the folder %s"
IT[download_fail]="Impossibile scaricare %s: controllare la connessione a internet."
EN[download_fail]="Cannot download %s: check the internet connection."
IT[pulling]="Scaricamento di BiblioViva (la prima volta può richiedere alcuni minuti)"
EN[pulling]="Downloading BiblioViva (the first time it can take a few minutes)"
IT[starting]="Avvio di BiblioViva"
EN[starting]="Starting BiblioViva"
IT[waiting]="Attesa che BiblioViva risponda (fino a %s secondi)"
EN[waiting]="Waiting for BiblioViva to answer (up to %s seconds)"
IT[not_ready]="BiblioViva non risponde ancora. Vedere il registro con: cd %s && docker compose logs"
EN[not_ready]="BiblioViva does not answer yet. See the log with: cd %s && docker compose logs"
IT[no_https]="Il nodo è nella tailnet, ma i certificati HTTPS non sono attivi: attivarli nella pagina DNS della console di Tailscale, poi rieseguire il programma."
EN[no_https]="The node is on the tailnet, but HTTPS certificates are off: turn them on in the DNS page of the Tailscale admin console, then run the program again."
IT[ready]="BiblioViva è pronto. Aprire nel browser:"
EN[ready]="BiblioViva is ready. Open in the browser:"
IT[ready_ts]="(da un dispositivo con Tailscale collegato all'account della scuola; la prima apertura può richiedere qualche secondo)"
EN[ready_ts]="(from a device with Tailscale logged in with the school's account; the first opening can take a few seconds)"
IT[ready_lan]="(da un computer della rete della scuola; se il nome non funziona, usare l'indirizzo numerico)"
EN[ready_lan]="(from a computer on the school network; if the name does not work, use the numeric address)"
IT[usage]="Uso: setup.sh [--lang it|en] [--network tailscale|lan] [--profile micro|small|medium|large] [--key <chiave>] [--dir <cartella>] [--yes]"
EN[usage]="Usage: setup.sh [--lang it|en] [--network tailscale|lan] [--profile micro|small|medium|large] [--key <key>] [--dir <folder>] [--yes]"

t() {
	if [ "$UI_LANG" = it ]; then
		printf '%s' "${IT[$1]}"
	else
		printf '%s' "${EN[$1]}"
	fi
}
say() {
	local key=$1
	shift
	# shellcheck disable=SC2059 # the messages are the formats
	printf "$(t "$key")\n" "$@"
}
step() {
	printf '\n== %s\n' "$(say "$@")"
}
fail() {
	say "$@" >&2
	exit 1
}

# ---------------------------------------------------------------------------------------------
# Options

while [ $# -gt 0 ]; do
	case "$1" in
		--lang) UI_LANG="${2:-}"; shift 2 ;;
		--network) NETWORK="${2:-}"; shift 2 ;;
		--profile) PROFILE="${2:-}"; shift 2 ;;
		--key) KEY="${2:-}"; shift 2 ;;
		--dir) DIR="${2:-}"; shift 2 ;;
		--yes) ASSUME_YES=1; shift ;;
		-h | --help) UI_LANG="${UI_LANG:-en}"; say usage; exit 0 ;;
		*) UI_LANG="${UI_LANG:-en}"; say usage >&2; exit 2 ;;
	esac
done
if [ -z "$UI_LANG" ]; then
	case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in
		it*) UI_LANG=it ;;
		*) UI_LANG=en ;;
	esac
fi
case "$UI_LANG" in it | en) ;; *) UI_LANG=en; say usage >&2; exit 2 ;; esac
case "$NETWORK" in "" | tailscale | lan) ;; *) say usage >&2; exit 2 ;; esac
case "$PROFILE" in "" | micro | small | medium | large) ;; *) say usage >&2; exit 2 ;; esac

# The answers come from the terminal, opened once as descriptor 3 (the script itself may be
# arriving on standard input); without one, the option that answers the question is named.
INPUT_OPEN=""
open_input() {
	[ -z "$INPUT_OPEN" ] || return 0
	{ exec 3<"$INPUT"; } 2>/dev/null || fail no_input "$1"
	INPUT_OPEN=1
}
ask() { # <prompt>; open_input first, in the main shell
	local answer
	printf '%s' "$1" >&2
	IFS= read -r -u 3 answer || answer=""
	printf '%s' "$answer"
}

# ---------------------------------------------------------------------------------------------
# The computer

printf '%s\n' "$(t title)"
[ "$(uname -s)" = Linux ] || fail not_linux
arch=$(uname -m)
case "$arch" in
	x86_64 | amd64 | aarch64 | arm64) ;;
	*) fail not_64 "$arch" ;;
esac
os_id=""
if [ -r "$OS_RELEASE" ]; then
	os_id=$(. "$OS_RELEASE" && echo ${ID:-} ${ID_LIKE:-})
fi
case " $os_id " in
	*" debian "* | *" ubuntu "* | *" raspbian "*) ;;
	*) say os_other "${os_id:-?}" ;;
esac

SUDO=()
if [ "$(id -u)" -ne 0 ]; then
	command -v sudo >/dev/null 2>&1 || fail no_sudo
	SUDO=(sudo)
fi

# The profile that fits this computer: a Raspberry Pi is small (micro under 1 GB), a PC with
# little memory micro or small, then medium on a hard disk and large on an SSD.
suggest_profile() {
	local kb=0 rota=""
	if [ -r "$MEMINFO" ]; then
		kb=$(awk '/^MemTotal:/ { print $2 }' "$MEMINFO")
	fi
	if [ "${kb:-0}" -gt 0 ] && [ "$kb" -lt 900000 ]; then
		echo micro
	elif [ -r "$MODEL_FILE" ] && tr -d '\0' <"$MODEL_FILE" | grep -qi "raspberry pi"; then
		echo small
	elif [ "${kb:-0}" -gt 0 ] && [ "$kb" -lt 2600000 ]; then
		echo small
	else
		rota=$(lsblk -dno ROTA "$(findmnt -nvo SOURCE / 2>/dev/null)" 2>/dev/null | head -n1 | tr -d ' ' || true)
		if [ "$rota" = 0 ]; then echo large; else echo medium; fi
	fi
}
mem_limit() {
	case "$1" in micro) echo 256m ;; small) echo 512m ;; medium) echo 1g ;; large) echo 2g ;; esac
}

# ---------------------------------------------------------------------------------------------
# Docker

DOCKER=()
if docker compose version >/dev/null 2>&1; then
	DOCKER=(docker)
elif [ ${#SUDO[@]} -gt 0 ] && "${SUDO[@]}" docker compose version >/dev/null 2>&1; then
	DOCKER=("${SUDO[@]}" docker)
else
	say docker_missing
	if [ "$ASSUME_YES" -ne 1 ]; then
		open_input --yes
		answer=$(ask "$(t docker_ask)")
		case "$answer" in "" | [sSyY]*) ;; *) fail docker_stop ;; esac
	fi
	curl -fsSL https://get.docker.com | "${SUDO[@]}" sh
	if [ ${#SUDO[@]} -gt 0 ]; then
		"${SUDO[@]}" usermod -aG docker "$(id -un)"
		say docker_group
	fi
	DOCKER=("${SUDO[@]}" docker)
	"${DOCKER[@]}" compose version >/dev/null 2>&1 || fail docker_stop
fi
compose() {
	(cd "$DIR" && "${DOCKER[@]}" compose "$@")
}

# ---------------------------------------------------------------------------------------------
# The answers

current=""
if [ -f "$DIR/.env" ]; then
	current=$(sed -n 's/^BIBLIOVIVA_NETWORK=//p' "$DIR/.env" | tail -n1)
	if [ -z "$current" ] && [ -f "$DIR/compose.yml" ]; then
		# a stack written by hand: the sidecar tells the way
		if grep -q "^    tailscale:" "$DIR/compose.yml"; then current=tailscale; else current=lan; fi
	fi
fi

if [ -n "$current" ]; then
	say found "$DIR" "$current"
	NETWORK=${NETWORK:-$current}
else
	while [ -z "$NETWORK" ]; do
		open_input "--network tailscale|lan"
		case "$(ask "$(t q_network)")" in
			1) NETWORK=tailscale ;;
			2) NETWORK=lan ;;
			*) say bad_choice ;;
		esac
	done
	if [ -z "$PROFILE" ]; then
		suggested=$(suggest_profile)
		while [ -z "$PROFILE" ]; do
			open_input "--profile micro|small|medium|large"
			# shellcheck disable=SC2059
			case "$(ask "$(printf "$(t q_profile)" "$suggested")")" in
				"") PROFILE=$suggested ;;
				1 | micro) PROFILE=micro ;;
				2 | small) PROFILE=small ;;
				3 | medium) PROFILE=medium ;;
				4 | large) PROFILE=large ;;
				*) say bad_choice ;;
			esac
		done
	fi
fi

# A key is needed to join the tailnet: on a new installation and when moving to Tailscale.
if [ "$NETWORK" = tailscale ] && [ "$current" != tailscale ]; then
	while [ "${KEY#tskey-}" = "$KEY" ]; do
		[ -z "$KEY" ] || say bad_key
		open_input "--key <tskey-auth-…>"
		KEY=$(ask "$(t q_key)" | tr -d '[:space:]')
	done
fi

# ---------------------------------------------------------------------------------------------
# The folder

fetch() { # <file under docker/> <destination>
	local source="${BIBLIOVIVA_SOURCE:-}"
	if [ -z "$source" ] && [ -f "${BASH_SOURCE[0]:-}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/docker/$1" ]; then
		source=$(dirname "${BASH_SOURCE[0]}")
	fi
	if [ -n "$source" ]; then
		cp "$source/docker/$1" "$2"
	else
		curl -fsSL "$REPO_RAW/docker/$1" -o "$2" || fail download_fail "$REPO_RAW/docker/$1"
	fi
}

# Sets KEY=value in .env, replacing the line or adding it.
set_env() {
	local file="$DIR/.env"
	if grep -q "^$1=" "$file"; then
		sed -i "s|^$1=.*|$1=$2|" "$file"
	else
		printf '%s=%s\n' "$1" "$2" >>"$file"
	fi
}

if [ -n "$current" ] && [ "$current" != "$NETWORK" ]; then
	say switch "$current" "$NETWORK"
	compose down
fi

step writing "$DIR"
mkdir -p "$DIR/config" "$DIR/backups"
if [ "$NETWORK" = tailscale ]; then
	mkdir -p "$DIR/tailscale"
	fetch compose.yml "$DIR/compose.yml.new"
	fetch tailscale/serve.json "$DIR/tailscale/serve.json"
else
	fetch compose.lan.yml "$DIR/compose.yml.new"
fi
mv "$DIR/compose.yml.new" "$DIR/compose.yml"

if [ ! -f "$DIR/.env" ]; then
	umask 077
	cat >"$DIR/.env" <<-EOF
		# Settings of BiblioViva, written by setup.sh (the keys: docker/.env.example).
		# The way the devices reach BiblioViva: tailscale or lan (setup.sh --network changes it).
		BIBLIOVIVA_NETWORK=$NETWORK
		# Tailscale auth key (a secret: never share this file).
		TS_AUTHKEY=
		# The port of the local network way: http://<address of the computer>:8080.
		LAN_PORT=8080
		# Memory for the app, after the hardware profile: micro 256m, small 512m, medium 1g, large 2g.
		MEM_LIMIT=$(mem_limit "${PROFILE:-small}")
		BIBLIOVIVA_IMAGE=ghcr.io/itotm/biblioviva:latest
		LOG_LEVEL=info
	EOF
	umask 022
fi
set_env BIBLIOVIVA_NETWORK "$NETWORK"
if [ "$NETWORK" = tailscale ] && [ -n "$KEY" ]; then
	set_env TS_AUTHKEY "$KEY"
fi
chmod 600 "$DIR/.env"

# On the local network the computer is reached by its name too (<hostname>.local): Raspberry Pi OS
# answers to it, a Debian or Ubuntu server needs avahi-daemon.
if [ "$NETWORK" = lan ] && ! command -v avahi-daemon >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
	step avahi "$(hostname)"
	"${SUDO[@]}" apt-get install -y avahi-daemon
fi

# The hardware profile, read by the server from its first start (the wizard keeps it).
if [ -n "$PROFILE" ] && [ ! -f "$DIR/config/performance.json" ] && [ ! -f "$DIR/config/config.json" ]; then
	printf '{ "profile": "%s" }\n' "$PROFILE" >"$DIR/config/performance.json"
fi

# The app runs as uid 1000: the two folders it writes must be its own.
if [ "$(stat -c %u "$DIR/config")" != 1000 ] || [ "$(stat -c %u "$DIR/backups")" != 1000 ]; then
	"${SUDO[@]}" chown -R 1000:1000 "$DIR/config" "$DIR/backups"
fi

# ---------------------------------------------------------------------------------------------
# Start

step pulling
compose pull
step starting
compose up -d --remove-orphans

step waiting "$HEALTH_WAIT"
healthy() {
	if [ "$NETWORK" = tailscale ]; then
		# the app shares the sidecar's network: its port answers inside the sidecar
		compose exec -T tailscale wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1
	else
		curl -fsS "http://127.0.0.1:$(sed -n 's/^LAN_PORT=//p' "$DIR/.env" | tail -n1)/healthz" >/dev/null 2>&1
	fi
}
waited=0
until healthy; do
	if [ "$waited" -ge "$HEALTH_WAIT" ]; then
		fail not_ready "$DIR"
	fi
	sleep 3
	waited=$((waited + 3))
done

printf '\n%s\n\n' "$(t ready)"
if [ "$NETWORK" = tailscale ]; then
	status=$(compose exec -T tailscale tailscale status --json 2>/dev/null || true)
	domain=$(printf '%s' "$status" | tr -d '\n' | grep -o '"CertDomains": *\[ *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' || true)
	if [ -z "$domain" ]; then
		fail no_https
	fi
	printf '    https://%s\n\n%s\n' "$domain" "$(t ready_ts)"
else
	port=$(sed -n 's/^LAN_PORT=//p' "$DIR/.env" | tail -n1)
	address=$(hostname -I 2>/dev/null | awk '{ print $1 }' || true)
	printf '    http://%s.local:%s\n' "$(hostname)" "$port"
	if [ -n "$address" ]; then
		printf '    http://%s:%s\n' "$address" "$port"
	fi
	printf '\n%s\n' "$(t ready_lan)"
fi
