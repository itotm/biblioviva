// SPDX-License-Identifier: GPL-3.0-or-later
// The settings that name a template (PLAN.md step 11.6) and the guard every configuration change
// runs: a change may not leave a setting naming a template that no folder provides.
import type { AppConfig } from "#lib/server/config/schema.js";
import { ConfigError } from "#lib/server/config/load.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import { discoverTemplates, type TemplateKind } from "#lib/server/templates/engine.js";
import { LABEL_KINDS, type LabelKind } from "./label-templates.js";

export const TEMPLATE_KINDS: readonly TemplateKind[] = ["cards", "labels", "slips"];

export interface TemplateReference {
	kind: TemplateKind;
	name: string;
	/** The setting that names it, e.g. `labels.pair.template`. */
	key: string;
	/** Labels: the kind of label the setting prints. */
	labelKind?: LabelKind;
}

/** Every setting that names a template. */
export function templateReferences(config: AppConfig): TemplateReference[] {
	return [
		{ kind: "cards", name: config.cards.defaultTemplate, key: "cards.defaultTemplate" },
		...Object.entries(config.cards.templateByPatronType).map(
			([type, name]): TemplateReference => ({
				kind: "cards",
				name,
				key: `cards.templateByPatronType.${type}`,
			}),
		),
		...LABEL_KINDS.map((k): TemplateReference => ({
			kind: "labels",
			name: config.labels[k].template,
			key: `labels.${k}.template`,
			labelKind: k,
		})),
		{
			kind: "slips",
			name: config.circulation.overdueNotice.template,
			key: "circulation.overdueNotice.template",
		},
	];
}

/** The settings naming a template that no folder provides. */
export function missingTemplates(
	config: AppConfig,
	configDir: string,
	builtinRoot?: string,
): TemplateReference[] {
	const names = new Map(
		TEMPLATE_KINDS.map((k) => [
			k,
			new Set(discoverTemplates(k, configDir, builtinRoot).map((t) => t.name)),
		]),
	);
	return templateReferences(config).filter((r) => !names.get(r.kind)?.has(r.name));
}

/**
 * A `commit` guard: throws `ConfigError` when the change leaves a setting naming a template that
 * does not exist (only what the change itself breaks counts).
 */
export function templateGuard(
	configDir: string,
	before: AppConfig,
	builtinRoot?: string,
): (loaded: { config: AppConfig }) => void {
	const already = new Set(missingTemplates(before, configDir, builtinRoot).map((r) => r.key));
	return (loaded) => {
		const issues: ConfigIssue[] = missingTemplates(loaded.config, configDir, builtinRoot)
			.filter((r) => !already.has(r.key))
			.map((r) => ({
				level: "error",
				path: r.key,
				message: `template "${r.name}" not found in ${r.kind}/templates`,
			}));
		if (issues.length > 0) {
			throw new ConfigError("the configuration names a template that does not exist", issues);
		}
	};
}
