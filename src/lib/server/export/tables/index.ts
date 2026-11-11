// SPDX-License-Identifier: GPL-3.0-or-later
// Registers every exportable table once (imported by the export route). Later phases add theirs here.
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { registerAuditExport } from "./audit.js";
import { registerCatalogExport } from "./catalog.js";
import { registerInventoryMissingExport } from "./inventory-missing.js";
import { registerListItemsExport } from "./list-items.js";
import { registerOpenLoansExport } from "./open-loans.js";
import { registerWishlistExport } from "./wishlist.js";
import { registerReportExport } from "./report.js";
import { registerPatronsExport } from "./patrons.js";
import { registerPatronLoansExport } from "./patron-loans.js";

let registered = false;

export function registerAllExports(): void {
	if (registered) {
		return;
	}
	registered = true;
	registerReportExport();
	registerAuditExport(async () => {
		const locale = requestLocale();
		const keys = ["when", "user", "action", "entity", "entityId", "details"] as const;
		const labels: Record<string, string> = {};
		for (const key of keys) {
			labels[key] = await tServer(locale, `admin.audit.columns.${key}`);
		}
		return labels;
	});
	registerPatronsExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {};
		for (const key of [
			"lastName",
			"firstName",
			"patronType",
			"classLabel",
			"cardNumber",
			"status",
			"openLoans",
			"overdueLoans",
		]) {
			labels[key] = await tServer(locale, `patrons.fields.${key}`);
		}
		for (const t of ["student", "teacher"]) {
			labels[`type_${t}`] = await tServer(locale, `patrons.types.${t}`);
		}
		for (const st of ["active", "anonymized"]) {
			labels[`status_${st}`] = await tServer(locale, `common.statuses.patron.${st}`);
		}
		return labels;
	});
	registerCatalogExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {};
		for (const key of ["title", "series", "author", "year", "isbn", "classification"]) {
			labels[key] = await tServer(locale, `catalog.list.columns.${key}`);
		}
		labels.kind = await tServer(locale, "catalog.list.filters.kind");
		labels.readingLevel = await tServer(locale, "catalog.fields.readingLevel");
		labels.originalTitle = await tServer(locale, "catalog.fields.originalTitle");
		labels.accessibleFormats = await tServer(locale, "catalog.fields.accessibleFormats");
		labels.callNumber = await tServer(locale, "catalog.export.callNumber");
		labels.acquiredAt = await tServer(locale, "catalog.export.acquiredAt");
		labels.copiesTotal = await tServer(locale, "catalog.export.copiesTotal");
		labels.copiesAvailable = await tServer(locale, "catalog.export.copiesAvailable");
		for (const k of ["fiction", "nonfiction"]) {
			labels[`kind_${k}`] = await tServer(locale, `catalog.kinds.${k}`);
		}
		labels.kind_unclassified = await tServer(locale, "catalog.toClassify.label");
		return labels;
	});
	registerPatronLoansExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {};
		for (const key of [
			"issuedAt",
			"dueDate",
			"returnedAt",
			"outcome",
			"title",
			"author",
			"barcode",
			"renewals",
			"schoolYear",
		]) {
			labels[key] = await tServer(locale, `patrons.detail.historyColumns.${key}`);
		}
		for (const o of ["open", "overdue", "returned", "returnedLate", "lost"]) {
			labels[`outcome_${o}`] = await tServer(locale, `patrons.detail.outcome.${o}`);
		}
		return labels;
	});
	registerListItemsExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {
			position: await tServer(locale, "printing.list.columns.position"),
			barcode: await tServer(locale, "catalog.detail.columns.barcode"),
			title: await tServer(locale, "catalog.list.columns.title"),
			author: await tServer(locale, "catalog.list.columns.author"),
			callNumber: await tServer(locale, "catalog.detail.columns.callNumber"),
			status: await tServer(locale, "catalog.detail.columns.status"),
		};
		const keys: Record<string, string> = { in_repair: "inRepair" };
		for (const s of ["available", "lost", "damaged", "in_repair", "withdrawn"]) {
			labels[`status_${s}`] = await tServer(locale, `common.statuses.item.${keys[s] ?? s}`);
		}
		return labels;
	});
	registerInventoryMissingExport(async () => {
		const locale = requestLocale();
		return {
			callNumber: await tServer(locale, "catalog.detail.columns.callNumber"),
			barcode: await tServer(locale, "catalog.detail.columns.barcode"),
			title: await tServer(locale, "catalog.list.columns.title"),
			author: await tServer(locale, "catalog.list.columns.author"),
			itemType: await tServer(locale, "catalog.detail.columns.itemType"),
			inventoryNumber: await tServer(locale, "catalog.item.inventoryNumber"),
		};
	});
	registerWishlistExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {};
		for (const key of [
			"title",
			"author",
			"series",
			"seriesNumber",
			"requests",
			"note",
			"createdAt",
		]) {
			labels[key] = await tServer(locale, `circulation.wishlist.columns.${key}`);
		}
		return labels;
	});
	registerOpenLoansExport(async () => {
		const locale = requestLocale();
		const labels: Record<string, string> = {};
		for (const key of [
			"patron",
			"classLabel",
			"title",
			"barcode",
			"issuedAt",
			"dueDate",
			"daysOverdue",
			"renewals",
			"lastNoticeAt",
		]) {
			labels[key] = await tServer(locale, `circulation.loans.columns.${key}`);
		}
		labels.teacher = await tServer(locale, "circulation.checkout.teacher");
		return labels;
	});
}
