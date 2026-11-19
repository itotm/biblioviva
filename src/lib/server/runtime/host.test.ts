// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyDisk, diskKind, hostResources, mountOf } from "./host.js";

const MOUNTINFO = [
	"52 1 0:43 / / ro,relatime shared:1 - overlay composefs ro",
	"180 71 0:38 /home /var/home rw,noatime shared:183 - btrfs /dev/nvme0n1p3 rw,ssd",
	"306 180 179:2 / /var/home/pi/data rw,noatime - ext4 /dev/mmcblk0p2 rw",
	"307 180 8:1 / /mnt/old\\040disk rw - ext4 /dev/sda1 rw",
].join("\n");

describe("the host computer", () => {
	it("finds the mount that holds a folder: the longest mount point", () => {
		expect(mountOf(MOUNTINFO, "/var/home/itotm/biblioviva")).toMatchObject({
			point: "/var/home",
			majMin: "0:38",
			source: "/dev/nvme0n1p3",
		});
		expect(mountOf(MOUNTINFO, "/var/home/pi/data/db")?.majMin).toBe("179:2");
		expect(mountOf(MOUNTINFO, "/var/home/pi/database")?.point).toBe("/var/home");
		expect(mountOf(MOUNTINFO, "/mnt/old disk/x")?.source).toBe("/dev/sda1");
		expect(mountOf(MOUNTINFO, "/etc")?.point).toBe("/");
		expect(mountOf("", "/etc")).toBeNull();
	});

	it("tells an SD card, a spinning disk and an SSD apart", () => {
		expect(classifyDisk("mmcblk0", "0")).toBe("sd");
		expect(classifyDisk("dm-0", "0", ["mmcblk0p2"])).toBe("sd");
		expect(classifyDisk("sda", "1\n")).toBe("hdd");
		expect(classifyDisk("nvme0n1", "0\n")).toBe("ssd");
		expect(classifyDisk("sdb", null)).toBe("unknown");
	});

	it("reads the disk of a folder from the kernel's description of its device", () => {
		const root = mkdtempSync(join(tmpdir(), "bv-host-"));
		const dev = join(root, "sys/dev/block/179:2");
		mkdirSync(join(dev, "queue"), { recursive: true });
		writeFileSync(join(dev, "queue/rotational"), "0\n");
		mkdirSync(join(root, "proc/self"), { recursive: true });
		writeFileSync(join(root, "proc/self/mountinfo"), MOUNTINFO);
		// a device without `partition` keeps its own queue; the name decides: not a card here
		expect(diskKind("/var/home/pi/data", root)).toBe("ssd");
		// no device folder for the source of a btrfs mount
		expect(diskKind("/var/home/itotm", root)).toBe("unknown");
		expect(diskKind("/var/home/itotm", join(root, "missing"))).toBe("unknown");
	});

	it("measures this computer without failing", () => {
		const host = hostResources(process.cwd());
		expect(host.memoryBytes).toBeGreaterThan(0);
		expect(host.cpus).toBeGreaterThan(0);
		expect(["sd", "hdd", "ssd", "unknown"]).toContain(host.disk);
	});
});
