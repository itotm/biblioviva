// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run auth:hash-password [password]` — prints an argon2id hash to paste into config.json.
import { hashPassword, MIN_PASSWORD_LENGTH } from "#lib/server/auth/password.js";

let password = process.argv[2];
if (!password) {
	process.stdout.write("Password: ");
	password = (
		await new Promise<string>((resolve) => {
			let buf = "";
			process.stdin.setEncoding("utf8");
			process.stdin.on("data", (chunk) => {
				buf += String(chunk);
				if (buf.includes("\n")) {
					resolve(buf.split("\n")[0] ?? "");
				}
			});
		})
	).trim();
}
if (password.length < MIN_PASSWORD_LENGTH) {
	console.error(`The password must have at least ${MIN_PASSWORD_LENGTH} characters.`);
	process.exit(1);
}
console.log(await hashPassword(password));
