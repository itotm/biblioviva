// SPDX-License-Identifier: GPL-3.0-or-later
// The dependency inventory shown on the About page (step 1.12), built from package.json (exact
// versions, PLAN.md §2) and the installed packages' metadata. Not imported by the app at runtime:
// the generator writes a JSON file that the page loads.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEPENDENCIES_FILE = "src/lib/generated/dependencies.json";

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
		return repo
			.replace(/^git\+/, "")
			.replace(/\.git$/, "")
			.replace(/^git:\/\//, "https://");
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
