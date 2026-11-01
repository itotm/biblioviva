// SPDX-License-Identifier: GPL-3.0-or-later
// The client's address as the adapter reads it (`ADDRESS_HEADER`: the Tailscale sidecar's
// `x-forwarded-for`, Cloudflare's `cf-connecting-ip` in the public demo), or `unknown` when the
// header is missing (the container reached without its proxy): a limiter must not fail for it.
export function clientAddress(event: { getClientAddress: () => string }): string {
	try {
		return event.getClientAddress();
	} catch {
		return "unknown";
	}
}
