// SPDX-License-Identifier: GPL-3.0-or-later
// The template editor (steps 11.10, 11.16): one template folder of the configuration with its
// files and the faces the designer draws, a draft of the files (written by the code editor or the
// designer) previewed as printing renders it, and saved. Permission `admin`.
import { printWordSource } from "#lib/server/i18n/print-word-source.js";
import type { WordSource } from "#lib/server/i18n/print-words.js";
import { command, query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { overdueGroupLabels } from "#lib/server/i18n/overdue-labels.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import {
	editorSource,
	MAX_TEXT_FILE,
	previewDraft,
	saveTemplateSource,
	TemplateEditorError,
	type CardSizeIssue,
} from "#lib/server/services/template-editor.js";
import { TEMPLATE_NAME } from "#lib/server/services/template-folders.js";
import { getConfigHistory, getConfigOverview } from "./config.remote.js";
import { getTemplateFolders } from "./print-config.remote.js";

const target = v.object({
	kind: v.picklist(["cards", "labels", "slips"]),
	name: v.pipe(v.string(), v.regex(TEMPLATE_NAME)),
});
const draft = v.object({
	...target.entries,
	files: v.record(
		v.pipe(v.string(), v.regex(/^[\w-]+\.(html|css)$|^template\.json$/)),
		v.pipe(v.string(), v.maxLength(MAX_TEXT_FILE)),
	),
	zoom: v.optional(v.picklist([1, 2, 3]), 1),
});

export const getTemplateSource = query(target, ({ kind, name }) => {
	requireUser("admin");
	try {
		return editorSource(getConfig(), env().CONFIG_DIR, kind, name);
	} catch (e) {
		if (e instanceof TemplateEditorError) {
			error(404, e.code);
		}
		throw e;
	}
});

async function options(
	zoom: number,
): Promise<{ zoom: number; today: string; teacherLabel: string; words: WordSource }> {
	return {
		zoom,
		today: libraryToday(getConfig()),
		teacherLabel: (await overdueGroupLabels()).teacher,
		words: await printWordSource(getConfig().ui.locale),
	};
}

/** The problems of a draft, a card too large for the sheet said in the installation's language. */
async function problemsOf(
	problems: string[],
	cardSize: CardSizeIssue | undefined,
): Promise<string[]> {
	if (!cardSize) {
		return problems;
	}
	const locale = requestLocale();
	const mm = (v: number): string => new Intl.NumberFormat(locale).format(v);
	return [
		await tServer(locale, "config.designer.cardTooLarge", {
			width: mm(cardSize.width),
			height: mm(cardSize.height),
			maxWidth: mm(cardSize.maxWidth),
			maxHeight: mm(cardSize.maxHeight),
		}),
	];
}

export const previewTemplateDraft = command(draft, async (d) => {
	requireUser("admin");
	const result = previewDraft(serverContext(), d, await options(d.zoom));
	return result.ok
		? result
		: { ok: false as const, problems: await problemsOf(result.problems, result.cardSize) };
});

export const saveTemplateDraft = command(draft, async (d) => {
	const user = requireUser("admin");
	try {
		const change = saveTemplateSource(serverContext(), d, await options(1), user);
		void getTemplateSource({ kind: d.kind, name: d.name }).refresh();
		void getTemplateFolders().refresh();
		void getConfigOverview().refresh();
		void getConfigHistory().refresh();
		return { ok: true as const, change: change.id };
	} catch (e) {
		if (e instanceof TemplateEditorError) {
			return {
				ok: false as const,
				problems: await problemsOf(e.details.length > 0 ? e.details : [e.code], e.cardSize),
			};
		}
		throw e;
	}
});
