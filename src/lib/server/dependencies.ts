// SPDX-License-Identifier: GPL-3.0-or-later
// The dependency inventory (step 1.12), built from package.json (exact versions, PLAN.md §2) and
// the installed packages' metadata. Not imported by the app at runtime: the generator writes a JSON
// file (the About page reads the application's data from it) and the technical page of the
// documentation that lists the libraries (`docs/libraries.md`, step 9.53).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEPENDENCIES_FILE = "src/lib/generated/dependencies.json";
export const LIBRARIES_PAGE = "docs/libraries.md";

export interface DependencyInfo {
	name: string;
	version: string;
	license: string;
	homepage: string;
}

export interface SystemComponent {
	name: string;
	version: string;
	license: string;
	homepage: string;
}

export interface DependencyInventory {
	app: { name: string; version: string; license: string; repository: string };
	runtime: DependencyInfo[];
	development: DependencyInfo[];
	system: SystemComponent[];
}

/** Components outside package.json (PLAN.md §2 tables), kept here so the page stays honest. */
export const SYSTEM_COMPONENTS: SystemComponent[] = [
	// runtime and SQLite driver
	{
		name: "Bun",
		version: "1.4.4",
		license: "MIT",
		homepage: "https://bun.com",
	},
	// Z39.50 client for the OPAC SBN lookups
	{
		name: "YAZ (yaz-client)",
		version: "5.34.4",
		license: "BSD-3-Clause",
		homepage: "https://www.indexdata.com/resources/software/yaz/",
	},
	// database
	{
		name: "SQLite",
		version: "bundled with Bun",
		license: "Public domain",
		homepage: "https://sqlite.org",
	},
	// cover straightening in the browser (vendored official build)
	{
		name: "OpenCV.js",
		version: "5.0.0",
		license: "Apache-2.0",
		homepage: "https://opencv.org",
	},
	// minimal shell in the container
	{
		name: "BusyBox (Debian busybox-static)",
		version: "1.37.0",
		license: "GPL-2.0-only",
		homepage: "https://busybox.net",
	},
	// container base image
	{
		name: "Debian trixie distroless (oven/bun image)",
		version: "1.4.4-distroless",
		license: "various (Debian)",
		homepage: "https://hub.docker.com/r/oven/bun",
	},
];

interface PackageJson {
	name?: string;
	version?: string;
	license?: string | { type?: string };
	homepage?: string;
	repository?: string | { url?: string };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function readPackage(path: string): PackageJson | null {
	return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as PackageJson) : null;
}

function licenseOf(pkg: PackageJson | null): string {
	if (!pkg?.license) {
		return "unknown";
	}
	return typeof pkg.license === "string" ? pkg.license : (pkg.license.type ?? "unknown");
}

function homepageOf(name: string, pkg: PackageJson | null): string {
	if (pkg?.homepage) {
		return pkg.homepage;
	}
	const repo = typeof pkg?.repository === "string" ? pkg.repository : pkg?.repository?.url;
	if (repo) {
		const url = repo
			.replace(/^git\+/, "")
			.replace(/\.git$/, "")
			.replace(/^git:\/\//, "https://")
			.replace(/^github:/, "");
		// the npm shorthand `owner/name` is a GitHub repository
		return /^[\w.-]+\/[\w.-]+$/.test(url) ? `https://github.com/${url}` : url;
	}
	return `https://www.npmjs.com/package/${name}`;
}

function describe(name: string, pinned: string, root: string): DependencyInfo {
	const pkg = readPackage(join(root, "node_modules", name, "package.json"));
	if (pkg?.version && pkg.version !== pinned) {
		throw new Error(
			`${name}: package.json pins ${pinned} but ${pkg.version} is installed (run bun install)`,
		);
	}
	return { name, version: pinned, license: licenseOf(pkg), homepage: homepageOf(name, pkg) };
}

export function collectDependencies(root = "."): DependencyInventory {
	const app = readPackage(join(root, "package.json"));
	if (!app) {
		throw new Error("package.json not found");
	}
	const list = (deps: Record<string, string> | undefined): DependencyInfo[] =>
		Object.entries(deps ?? {})
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, version]) => describe(name, version, root));
	const repository =
		typeof app.repository === "string" ? app.repository : (app.repository?.url ?? "");
	return {
		app: {
			name: app.name ?? "biblioviva",
			version: app.version ?? "0.0.0",
			license: licenseOf(app),
			repository: repository.replace(/^git\+/, "").replace(/\.git$/, ""),
		},
		runtime: list(app.dependencies),
		development: list(app.devDependencies),
		system: SYSTEM_COMPONENTS,
	};
}

const cell = (text: string): string => text.replace(/\|/g, "\\|");

function table(rows: readonly DependencyInfo[], npm: boolean): string[] {
	return [
		"| Name | Version | Licence |",
		"|---|---|---|",
		...rows.map(
			(d) =>
				`| [${cell(d.name)}](${d.homepage}) | ${
					npm
						? `[${d.version}](https://www.npmjs.com/package/${d.name}/v/${d.version})`
						: cell(d.version)
				} | ${cell(d.license)} |`,
		),
	];
}

/** The technical page of the libraries in use (`docs/libraries.md`), from the inventory. */
export function librariesPage(data: DependencyInventory): string {
	return [
		"# Libraries",
		"",
		`The libraries and programs BiblioViva ${data.app.version} is made with, each with the version pinned in`,
		"`package.json` (exact versions, PLAN.md §2) and its licence. BiblioViva itself is free software under the",
		`${data.app.license} licence; its source is at <${data.app.repository}>. This page is generated by`,
		"`bun run deps:generate` after every change of a dependency; do not edit it by hand.",
		"",
		"## In the application",
		"",
		`The ${data.runtime.length} packages the server and the pages use at run time, in the image.`,
		"",
		...table(data.runtime, true),
		"",
		"## Programs of the image",
		"",
		"The components outside `package.json`: the runtime, the Z39.50 client, the database, the base image.",
		"",
		...table(data.system, false),
		"",
		"## For development only",
		"",
		`The ${data.development.length} packages that build, check and test BiblioViva; none of them is in the image.`,
		"",
		...table(data.development, true),
		"",
	].join("\n");
}
