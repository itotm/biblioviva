// SPDX-License-Identifier: GPL-3.0-or-later
// Runtime facade (PLAN.md §3.21): what the host computer has, for the checklist of `/admin/setup`
// (step 8.7). In a container the memory is the whole host's, not the container's limit (the
// hardware profile is chosen after the computer, not after the limit); the disk is read from the
// kernel's description of the device that holds the data folder (Linux only, the rest "unknown").
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { basename, dirname, join } from "node:path";

/** What holds the data: an SD or eMMC card, a spinning disk, an SSD, or not known. */
export type DiskKind = "sd" | "hdd" | "ssd" | "unknown";

export interface HostResources {
	/** Physical memory of the computer, in bytes. */
	memoryBytes: number;
	/** Processors (logical) the process may use. */
	cpus: number;
	/** The disk of the data folder. */
	disk: DiskKind;
}

/** The memory, the processors and the disk (of `dataDir`) of this computer. */
export function hostResources(dataDir: string): HostResources {
	return { memoryBytes: totalmem(), cpus: availableParallelism(), disk: diskKind(dataDir) };
}

/** One line of `/proc/self/mountinfo`: where it is mounted, its device number and its source. */
interface Mount {
	point: string;
	majMin: string;
	source: string;
}

/** The mount that holds `path` (the longest mount point that contains it). */
export function mountOf(mountinfo: string, path: string): Mount | null {
	let best: Mount | null = null;
	for (const line of mountinfo.split("\n")) {
		const [left = "", right = ""] = line.split(" - ");
		const fields = left.split(" ");
		const point = (fields[4] ?? "").replace(/\\040/g, " ");
		const majMin = fields[2] ?? "";
		const source = right.split(" ")[1] ?? "";
		const inside = point === "/" || path === point || path.startsWith(`${point}/`);
		if (point && inside && (!best || point.length > best.point.length)) {
			best = { point, majMin, source };
		}
	}
	return best;
}

/**
 * The kind of a block device from what the kernel says of it: its name (`mmcblk…` is an SD or
 * eMMC card), the names under it (a mapped device over a card) and `queue/rotational`.
 */
export function classifyDisk(
	name: string,
	rotational: string | null,
	underlying: readonly string[] = [],
): DiskKind {
	if ([name, ...underlying].some((n) => n.startsWith("mmcblk"))) {
		return "sd";
	}
	if (rotational === null) {
		return "unknown";
	}
	return rotational.trim() === "1" ? "hdd" : "ssd";
}

const read = (file: string): string | null => {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return null;
	}
};

/** The disk that holds `path`, from `/proc/self/mountinfo` and `/sys` (`root` for the tests). */
export function diskKind(path: string, root = "/"): DiskKind {
	if (process.platform !== "linux") {
		return "unknown";
	}
	try {
		const mount = mountOf(read(join(root, "proc/self/mountinfo")) ?? "", path);
		if (!mount) {
			return "unknown";
		}
		// a real device number, or (btrfs, overlay) the source of the mount
		const device = !mount.majMin.startsWith("0:")
			? join(root, "sys/dev/block", mount.majMin)
			: mount.source.startsWith("/dev/")
				? join(root, "sys/class/block", basename(realOrSame(mount.source)))
				: null;
		if (!device || !existsSync(device)) {
			return "unknown";
		}
		const dir = realpathSync(device);
		// a partition has its queue in the whole disk's folder, one level up
		const disk = existsSync(join(dir, "partition")) ? dirname(dir) : dir;
		const slaves = join(disk, "slaves");
		const underlying = existsSync(slaves) ? readdirSync(slaves) : [];
		return classifyDisk(basename(disk), read(join(disk, "queue/rotational")), underlying);
	} catch {
		return "unknown";
	}
}

/** `/dev/mapper/<name>` and the like are links to the device: its real name when it can be read. */
function realOrSame(file: string): string {
	try {
		return realpathSync(file);
	} catch {
		return file;
	}
}
