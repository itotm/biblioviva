// SPDX-License-Identifier: GPL-3.0-or-later
// A tiny static server for the two built sites, not used in production: `bun run site:serve` serves
// the documentation of `site/dist/` on http://localhost:5175 (the root's page picks the language),
// `bun run home:serve` the home page of `home/dist/` on http://localhost:5176. A folder is served
// by its `index.html`.
import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const SITES = {
	docs: { dist: join(import.meta.dir, "..", "site", "dist"), port: 5175 },
	home: { dist: join(import.meta.dir, "..", "home", "dist"), port: 5176 },
} as const;

const site = process.argv[2] === "home" ? "home" : "docs";
const { dist: DIST, port: PORT } = SITES[site];

function fileFor(pathname: string): string | null {
	const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
	let file = join(DIST, clean);
	if (!file.startsWith(DIST)) {
		return null;
	}
	if (existsSync(file) && statSync(file).isDirectory()) {
		file = join(file, "index.html");
	}
	return existsSync(file) ? file : null;
}

Bun.serve({
	port: PORT,
	fetch(request: Request): Response {
		const url = new URL(request.url);
		const file = fileFor(url.pathname);
		if (!file) {
			const notFound = join(DIST, "404.html");
			return existsSync(notFound)
				? new Response(Bun.file(notFound), { status: 404 })
				: new Response("Not found", { status: 404 });
		}
		// A folder asked for without its closing slash goes to the slash, so that relative links work.
		if (
			file.endsWith("index.html") &&
			!url.pathname.endsWith("/") &&
			!url.pathname.endsWith("index.html")
		) {
			return Response.redirect(new URL(`${url.pathname}/`, url), 301);
		}
		return new Response(Bun.file(file));
	},
});

console.log(`${site}: http://localhost:${PORT}/ (serving ${DIST})`);
