// SPDX-License-Identifier: GPL-3.0-or-later
// A readable explanation when a volume cannot be written at startup (step 8.3): in the container
// the app runs as uid 1000, so a bind-mounted folder owned by someone else, or refused by SELinux,
// otherwise ends in a bare EACCES stack trace and a restart loop.
const DENIED = new Set(["EACCES", "EPERM", "EROFS"]);

/** The hint to log for a permission error on `dir` (named after its variable), or null. */
export function permissionHint(error: unknown, dir: string, variable: string): string | null {
	const code = (error as { code?: unknown } | null)?.code;
	if (typeof code !== "string" || !DENIED.has(code)) {
		return null;
	}
	const uid = typeof process.getuid === "function" ? process.getuid() : "?";
	return [
		`[startup] ${variable}=${dir} cannot be written (${code}) by this process (uid ${uid}).`,
		"In the container the app runs as uid 1000: give the folder to that user —",
		`"sudo chown -R 1000:1000 <folder>" with Docker, "podman unshare chown -R 1000:1000 <folder>"`,
		variable === "BACKUP_DIR"
			? 'with rootless Podman — and on SELinux hosts (Fedora) mount it with ":z" (shared with the offsite service).'
			: 'with rootless Podman — and on SELinux hosts (Fedora) mount it with ":Z".',
		'See docs/deploy.md, "Permissions".',
	].join(" ");
}
