<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Calibra la stampa fronte-retro" (step 9.27, Q127): print a 150 × 100 mm card on both sides,
     cut it out along the outline of side 1, read on the rulers of side 2 where the cut edges fall,
     type the two values: they are added to the offset of the backs, so a second print shows the
     edges on 0. A drawing says what the two values mean. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { saveDuplexCalibration } from "#lib/remote/cards.remote.js";
	import { calibratedOffset } from "#lib/shared/card-layout.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import OrderedList from "#lib/ui/OrderedList.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PrintIcon = icons.print;
	const SaveIcon = icons.save;
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`admin.calibration.${key}`, params);

	// the offset in use, then the one saved here
	let offset = $derived({ ...data.offset });
	let readX = $state(0);
	let readY = $state(0);
	let saving = $state(false);
	const next = $derived(calibratedOffset(offset, { x: readX || 0, y: readY || 0 }));
	const mm = (v: number): string => `${v > 0 ? "+" : ""}${fmt.number(v)}`;

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		saving = true;
		try {
			const r = await saveDuplexCalibration({ x: readX || 0, y: readY || 0 });
			offset = r.offset;
			readX = 0;
			readY = 0;
			toaster.success({
				title: t("saved", { x: mm(r.offset.x), y: mm(r.offset.y) }),
			});
		} finally {
			saving = false;
		}
	}
</script>

<Page width="lg">
	<PageHeader
		title={t("title")}
		icon="print"
		backHref="/admin/config/cards"
		backLabel={i18n.t("common.actions.back")}
	/>
	<Card gap="3" as="section">
		<p>{t("intro")}</p>
		<Hint data-testid="calibration-current">
			{t("current", {
				flip: i18n.t(`config.options.cards.duplex.flip.${data.flip}`),
				x: mm(offset.x),
				y: mm(offset.y),
			})}
		</Hint>
		<OrderedList>
			<li>{t("steps.print")}</li>
			<li>{t(`steps.window.${data.flip}`)}</li>
			<li>{t("steps.cut")}</li>
			<li>{t("steps.read")}</li>
			<li>{t("steps.save")}</li>
			<li>{t("steps.check")}</li>
		</OrderedList>
		<Row>
			<Button
				variant="primary"
				icon={PrintIcon}
				href={resolve("print/cards/calibration")}
				target="_blank"
				rel="noopener"
				data-testid="calibration-print">{t("print")}</Button
			>
		</Row>
	</Card>

	<Card gap="3" as="section">
		<h2 class="h4">{t("drawing.title")}</h2>
		<!-- side 2 after the cut: the cut edge (thick) crosses each ruler at the value to type -->
		<svg
			viewBox="0 0 200 120"
			class="mx-auto w-full max-w-md"
			role="img"
			aria-label={t("drawing.label")}
		>
			<rect
				x="40"
				y="30"
				width="130"
				height="80"
				fill="#f8fafc"
				stroke="#0f172a"
				stroke-width="1.5"
			/>
			<g stroke="#334155" stroke-width="0.6">
				{#each Array.from({ length: 21 }, (_, k) => k - 10) as k (k)}
					<line x1={40 + k * 2.5} y1="66" x2={40 + k * 2.5} y2={k % 5 === 0 ? 74 : 71} />
					<line
						x1="102"
						y1={30 + k * 2.5}
						x2={k % 5 === 0 ? 110 : 107}
						y2={30 + k * 2.5}
					/>
				{/each}
			</g>
			<g font-size="6" fill="#0f172a" font-family="sans-serif" text-anchor="middle">
				<text x="27.5" y="64">−5</text>
				<text x="40" y="64">0</text>
				<text x="52.5" y="64">+5</text>
				<text x="117" y="19">−5</text>
				<text x="117" y="32">0</text>
				<text x="117" y="45">+5</text>
			</g>
			<g font-size="6" fill="#be123c" font-family="sans-serif">
				<text x="4" y="94">{t("drawing.x")}</text>
				<text x="122" y="12">{t("drawing.y")}</text>
			</g>
		</svg>
		<Hint>{t("drawing.hint")}</Hint>
	</Card>

	<Card gap="3" as="section">
		<form class="space-y-3" onsubmit={save}>
			<Grid>
				<Field label={t("fields.x")} hint={t("fields.hint")}>
					<Input
						type="number"
						step="0.5"
						min="-20"
						max="20"
						bind:value={readX}
						data-testid="calibration-x"
					/>
				</Field>
				<Field label={t("fields.y")} hint={t("fields.hint")}>
					<Input
						type="number"
						step="0.5"
						min="-20"
						max="20"
						bind:value={readY}
						data-testid="calibration-y"
					/>
				</Field>
			</Grid>
			<Hint tone="primary" data-testid="calibration-next">
				{t("next", { x: mm(next.x), y: mm(next.y) })}
			</Hint>
			<Row justify="end">
				<Button
					type="submit"
					variant="primary"
					icon={SaveIcon}
					disabled={saving}
					data-testid="calibration-save">{t("save")}</Button
				>
			</Row>
		</form>
	</Card>
</Page>
