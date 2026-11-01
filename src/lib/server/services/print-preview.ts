// SPDX-License-Identifier: GPL-3.0-or-later
// The overview of the print templates (PLAN.md step 2.5b): every template folder of the three kinds
// with its validation status and whether a setting names it. The previews, test and calibration
// sheets are in `card-preview.ts` and `labels.ts`. Pure functions over the configuration and the
// file system.
import type { AppConfig } from "#lib/server/config/schema.js";
import type { TemplateKind } from "#lib/server/templates/engine.js";
import { listCardTemplates } from "./card-templates.js";
import { listLabelTemplates, type LabelKind } from "./label-templates.js";
import { listSlipTemplates } from "./slips.js";
import { templateReferences } from "./template-refs.js";

export interface TemplateStatus {
	kind: TemplateKind;
	name: string;
	description: string;
	source: "builtin" | "config";
	dir: string;
	/** Card templates only: the patron types the author declared. */
	patronTypes: string[];
	/** True for the template named by `cards.defaultTemplate` / `labels.*.template`. */
	isDefault: boolean;
	/** Label templates only: the kind and the stocks the author declared. */
	labelKind: LabelKind | null;
	stocks: string[];
	error: string | null;
}

export interface TemplatesOverview {
	cards: TemplateStatus[];
	labels: TemplateStatus[];
	slips: TemplateStatus[];
	stocks: { id: string; name: string }[];
	defaults: { cards: string; byPatronType: Record<string, string> };
}

/** Every template folder of the three kinds with its validation state. */
export function templatesOverview(
	config: AppConfig,
	configDir: string,
	builtinRoot?: string,
): TemplatesOverview {
	// the templates the settings name (`templateReferences`); a label template for its own kind
	const refs = templateReferences(config);
	const named = new Set(refs.map((r) => `${r.kind}/${r.name}`));
	const namedLabel = new Set(refs.map((r) => `${r.labelKind}/${r.name}`));
	const cards = listCardTemplates(configDir, builtinRoot).map<TemplateStatus>((t) => ({
		kind: "cards",
		name: t.name,
		description: t.meta?.description ?? "",
		source: t.source,
		dir: t.dir,
		patronTypes: t.meta?.patronTypes ?? [],
		isDefault: named.has(`cards/${t.name}`),
		labelKind: null,
		stocks: [],
		error: t.error,
	}));
	const labels = listLabelTemplates(configDir, builtinRoot).map<TemplateStatus>((t) => ({
		kind: "labels",
		name: t.name,
		description: t.meta?.description ?? "",
		source: t.source,
		dir: t.dir,
		patronTypes: [],
		isDefault: t.meta !== null && namedLabel.has(`${t.meta.kind}/${t.name}`),
		labelKind: t.meta?.kind ?? null,
		stocks: t.meta?.stocks ?? [],
		error: t.error,
	}));
	const slips = listSlipTemplates(configDir, builtinRoot).map<TemplateStatus>((t) => ({
		kind: "slips",
		name: t.name,
		description: t.meta?.description ?? "",
		source: t.source,
		dir: t.dir,
		patronTypes: [],
		isDefault: named.has(`slips/${t.name}`),
		labelKind: null,
		stocks: [],
		error: t.error,
	}));
	return {
		cards,
		labels,
		slips,
		stocks: config.labels.stocks.map((s) => ({ id: s.id, name: s.name })),
		defaults: {
			cards: config.cards.defaultTemplate,
			byPatronType: config.cards.templateByPatronType,
		},
	};
}
