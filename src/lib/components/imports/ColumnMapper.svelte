<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Column mapping of a CSV import (steps 2.6, 3.9): one select per file column over the first
     rows of the file; a field feeds one column only, required and key fields are marked (9.19).
     Shared by every import wizard. -->
<script lang="ts" generics="T extends string">
	import { useI18n } from "#lib/i18n/context.js";
	import type { ColumnGroup } from "#lib/shared/import-columns.js";
	import Field from "#lib/ui/Field.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Table from "#lib/ui/Table.svelte";

	interface Props {
		mapping: (T | null)[];
		/** The first rows of the file, as read. */
		sample: string[][];
		header: boolean;
		fields: { value: T; label: string; group?: ColumnGroup }[];
	}

	let { mapping = $bindable(), sample, header = $bindable(), fields }: Props = $props();
	const i18n = useI18n();

	function setColumn(index: number, value: string): void {
		const next = [...mapping];
		const column = fields.find((f) => f.value === value)?.value ?? null;
		if (column) {
			next.forEach((c, i) => c === column && i !== index && (next[i] = null));
		}
		next[index] = column;
		mapping = next;
	}
</script>

<Row wrap={false} align="center" as="label">
	<input type="checkbox" class="checkbox" bind:checked={header} data-testid="has-header" />
	<span>{i18n.t("common.import.header")}</span>
</Row>
<div class="overflow-x-auto">
	<Table>
		<thead>
			<tr>
				{#each mapping as value, index (index)}
					<th class="p-2 text-left align-top font-normal">
						<Field label={i18n.t("common.import.column", { n: index + 1 })}
							><Select
								value={value ?? ""}
								onchange={(e) => setColumn(index, e.currentTarget.value)}
								data-testid="map-column-{index}"
							>
								<option value="">{i18n.t("common.import.ignore")}</option>
								{#each fields as f (f.value)}
									<option value={f.value}
										>{f.label}{f.group && f.group !== "optional"
											? ` · ${i18n.t(`common.import.groups.${f.group}`)}`
											: ""}</option
									>
								{/each}
							</Select></Field
						>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sample as row, r (r)}
				<tr class={r === 0 && header ? "opacity-60" : ""}>
					{#each mapping as _, c (c)}
						<td class="p-2 font-mono text-xs">{row[c] ?? ""}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
</div>
