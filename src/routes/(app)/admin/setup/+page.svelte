<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The installation check (step 8.7): what BiblioViva finds out about itself — the configuration
     file, the address and HTTPS, the hardware profile, the accounts' passwords, the backups — each
     with its state (colour, icon and word), the page of Administration that fixes it and the page of
     the guide that explains it; then the tests done by hand — the printer's test pages, the camera,
     the barcode scanner. Status and links only: nothing is edited here. -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { refreshAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import ScannerTest from "#lib/components/admin/ScannerTest.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type {
		CheckFinding,
		CheckId,
		CheckItem,
		CheckState,
	} from "#lib/shared/install-check.js";
	import { CHECKLIST_HELP, CHECKLIST_TEST_HELP } from "#lib/ui/help-checklist.js";
	import { helpHref } from "#lib/ui/help-links.js";
	import { photosOn } from "#lib/ui/features.js";
	import { useFormat } from "#lib/ui/format.js";
	import type { ExternalHref } from "#lib/ui/href.js";
	import { ICON_SIZE, icons, type IconComponent } from "#lib/ui/icons.js";
	import { CHECK_STATUS } from "#lib/ui/status.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const RecheckIcon = icons.renew;
	const PrintIcon = icons.print;
	const CameraIcon = icons.camera;
	const GuideIcon = icons.help;
	const ScanIcon = icons.scan;
	const ConfigIcon = icons.config;
	const STATE_ICON: Record<CheckState, IconComponent> = {
		ok: icons.available,
		warning: icons.damaged,
		error: icons.lost,
	};
	const STATE_TEXT: Record<CheckState, string> = {
		ok: "text-success-700",
		warning: "text-warning-700",
		error: "text-error-700",
	};
	/** The icon of each item, one per concept. */
	const ITEM_ICON: Record<CheckId, IconComponent> = {
		config: icons.code,
		address: icons.language,
		profile: icons.settings,
		accounts: icons.patrons,
		backup: icons.backup,
	};

	/** The page of Administration that fixes each item (the address has none: it is outside BiblioViva). */
	const FIX: Record<CheckId, { href: ResolvedPathname; label: string }[]> = {
		config: [
			{ href: "/admin/config", label: "config" },
			{ href: "/admin/config/history", label: "history" },
		],
		address: [],
		profile: [{ href: "/admin/config/performance", label: "performance" }],
		accounts: [{ href: "/admin/users", label: "users" }],
		backup: [
			{ href: "/admin/backups", label: "backups" },
			{ href: "/admin/config/backup", label: "backupSettings" },
		],
	};

	const check = $derived(data.check);
	const errors = $derived(check.items.filter((i) => i.state === "error").length);
	const warnings = $derived(check.items.filter((i) => i.state === "warning").length);
	const summary = $derived(
		check.state === "ok"
			? i18n.t("admin.checklist.summary.ok")
			: check.state === "warning"
				? i18n.t("admin.checklist.summary.warning", { warnings })
				: i18n.t("admin.checklist.summary.error", { errors }),
	);
	const SummaryIcon = $derived(STATE_ICON[check.state]);

	let rechecking = $state(false);
	async function recheck(): Promise<void> {
		rechecking = true;
		try {
			await refreshAll();
		} finally {
			rechecking = false;
		}
	}

	/** A finding in words: the dates (`…At`) and the profiles (`profile`, `suggested`, `…Profile`) named as the settings name them. */
	function text(item: CheckItem, finding: CheckFinding): string {
		const params: Record<string, string | number> = {};
		for (const [key, value] of Object.entries(finding.params ?? {})) {
			params[key] =
				key.endsWith("At") && typeof value === "string"
					? fmt.dateTime(value)
					: (key === "profile" || key === "suggested" || key.endsWith("Profile")) &&
						  typeof value === "string"
						? i18n.t(`config.options.performance.profile.${value}`)
						: value;
		}
		return i18n.t(`admin.checklist.findings.${item.id}.${finding.key}`, params);
	}

	/** The guide of an item that is not green: the one of its worst finding. */
	function guideOf(item: CheckItem): ExternalHref | null {
		const finding =
			item.findings.find((f) => f.state === item.state && f.state !== "ok") ?? null;
		const target = finding
			? CHECKLIST_HELP[`${item.id}.${finding.key}` as keyof typeof CHECKLIST_HELP]
			: undefined;
		return target ? (helpHref(data.docsBase, target) as ExternalHref) : null;
	}
	const testGuide = (key: keyof typeof CHECKLIST_TEST_HELP): ExternalHref =>
		helpHref(data.docsBase, CHECKLIST_TEST_HELP[key]) as ExternalHref;

	const t = (key: string, params?: Record<string, string | number>): string =>
		i18n.t(`admin.checklist.${key}`, params);

	/** The test pages that print: the card test sheet, the label sample and calibration, the two-sided sheet. */
	const printPages = $derived([
		{
			key: "cards",
			href: resolve(
				`print/cards/test?template=${encodeURIComponent(data.print.cardTemplate)}`,
			),
		},
		{
			key: "labels",
			href: resolve(
				`print/labels/pair?sample=1&stock=${encodeURIComponent(data.print.labelStock)}`,
			),
		},
		{
			key: "labelCalibration",
			href: resolve(
				`print/labels/calibration?kind=pair&stock=${encodeURIComponent(data.print.labelStock)}`,
			),
		},
		{ key: "duplex", href: resolve("print/cards/calibration"), guide: testGuide("duplex") },
	]);
	const cameraHref: ResolvedPathname = $derived(photosOn() ? "/census" : "/cataloging/new");
</script>

{#snippet itemCard(item: CheckItem)}
	{@const ItemIcon = ITEM_ICON[item.id]}
	{@const guide = item.state === "ok" ? null : guideOf(item)}
	<Card
		variant="outlined"
		gap="3"
		as="article"
		aria-labelledby="check-{item.id}-title"
		data-testid="check-{item.id}"
		data-state={item.state}
	>
		<Row align="center" justify="between" gap="3">
			<Row as="h3" align="center" gap="2" class="font-semibold" id="check-{item.id}-title">
				<ItemIcon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
				{t(`items.${item.id}`)}
			</Row>
			<StatusBadge status={CHECK_STATUS[item.state]} />
		</Row>
		<ul class="space-y-2">
			{#each item.findings as finding (finding.key)}
				{@const FindingIcon = STATE_ICON[finding.state]}
				<li
					class="flex items-start gap-2 text-sm"
					data-testid="finding-{item.id}-{finding.key}"
					data-state={finding.state}
				>
					<FindingIcon
						size={ICON_SIZE.sm}
						class="mt-0.5 shrink-0 {STATE_TEXT[finding.state]}"
						aria-hidden="true"
					/>
					<Row column gap="1" class="min-w-0">
						<p>{text(item, finding)}</p>
						{#if finding.lines?.length}
							<Alert
								tone={finding.state === "error" ? "error" : "warning"}
								mono
								soft
								as="div"
							>
								{finding.lines.join("\n")}
							</Alert>
						{/if}
					</Row>
				</li>
			{/each}
		</ul>
		{#if item.state !== "ok"}
			<Row divided data-testid="check-{item.id}-links">
				{#each FIX[item.id] as fix (fix.href)}
					<Button
						size="sm"
						icon={ConfigIcon}
						href={fix.href}
						data-testid="fix-{item.id}-{fix.label}"
					>
						{t(`fix.${fix.label}`)}
					</Button>
				{/each}
				{#if guide}
					<Button
						size="sm"
						icon={GuideIcon}
						href={guide}
						aria-label={t("fix.guideOf", { item: t(`items.${item.id}`) })}
						data-testid="guide-{item.id}"
					>
						{t("fix.guide")}
					</Button>
				{/if}
			</Row>
		{/if}
	</Card>
{/snippet}

<Page width="xl" gap="8">
	<PageHeader
		title={t("title")}
		subtitle={t("subtitle")}
		icon="checklist"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet actions()}
			<Button
				icon={RecheckIcon}
				onclick={recheck}
				disabled={rechecking}
				data-testid="recheck"
			>
				{t("recheck")}
			</Button>
		{/snippet}
	</PageHeader>

	<Alert
		tone={check.state === "ok" ? "success" : check.state === "warning" ? "warning" : "error"}
		padded
		as="div"
		live={false}
		role="status"
		icon={SummaryIcon}
		data-testid="setup-summary"
		data-state={check.state}
	>
		{summary}
	</Alert>

	<section class="space-y-4" aria-labelledby="checks-title" data-testid="setup-checks">
		<div class="space-y-1">
			<h2 class="h4" id="checks-title">{t("checks.title")}</h2>
			<Hint>{t("checks.intro")}</Hint>
		</div>
		{#each check.items as item (item.id)}
			{@render itemCard(item)}
		{/each}
	</section>

	<section class="space-y-4" aria-labelledby="tests-title" data-testid="setup-tests">
		<div class="space-y-1">
			<h2 class="h4" id="tests-title">{t("tests.title")}</h2>
			<Hint>{t("tests.intro")}</Hint>
		</div>

		<Card variant="outlined" gap="3" as="article" data-testid="test-printers">
			<Row align="center" justify="between" gap="3">
				<Row as="h3" align="center" gap="2" class="font-semibold">
					<PrintIcon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
					{t("tests.printers.title")}
				</Row>
				<Button
					size="sm"
					icon={GuideIcon}
					href={testGuide("printers")}
					aria-label={t("fix.guideOf", { item: t("tests.printers.title") })}
				>
					{t("fix.guide")}
				</Button>
			</Row>
			<Hint>{t("tests.printers.hint")}</Hint>
			<ul class="divide-y divide-surface-200">
				{#each printPages as page (page.key)}
					<li class="flex flex-wrap items-center justify-between gap-3 py-2">
						<div class="min-w-0">
							<p class="font-medium" id="print-{page.key}">
								{t(`tests.${page.key}.title`)}
							</p>
							<Hint>{t(`tests.${page.key}.description`)}</Hint>
						</div>
						{#if page.guide}
							<Button
								size="sm"
								icon={GuideIcon}
								href={page.guide}
								aria-label={t("fix.guideOf", {
									item: t(`tests.${page.key}.title`),
								})}
							>
								{t("fix.guide")}
							</Button>
						{/if}
						<Button
							icon={PrintIcon}
							href={page.href}
							target="_blank"
							rel="noopener"
							aria-labelledby="print-{page.key}-button print-{page.key}"
							id="print-{page.key}-button"
							data-testid="print-{page.key}"
						>
							{t("tests.printers.print")}
						</Button>
					</li>
				{/each}
			</ul>
		</Card>

		<Card variant="outlined" gap="3" as="article" data-testid="test-camera">
			<Row align="center" justify="between" gap="3">
				<Row as="h3" align="center" gap="2" class="font-semibold">
					<CameraIcon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
					{t("tests.camera.title")}
				</Row>
				<Button
					size="sm"
					icon={GuideIcon}
					href={testGuide("camera")}
					aria-label={t("fix.guideOf", { item: t("tests.camera.title") })}
				>
					{t("fix.guide")}
				</Button>
			</Row>
			<Hint>
				{photosOn() ? t("tests.camera.description") : t("tests.camera.descriptionNoPhotos")}
			</Hint>
			{#if check.cameraAvailable}
				<Row>
					<Button icon={CameraIcon} href={cameraHref} data-testid="camera-test">
						{t("tests.camera.open")}
					</Button>
				</Row>
			{:else}
				<Alert
					tone="warning"
					padded
					as="div"
					live={false}
					icon={STATE_ICON.warning}
					data-testid="camera-unavailable"
				>
					<p>{t("tests.camera.unavailable")}</p>
					<p class="mt-1">{i18n.t("common.camera.errors.insecure")}</p>
				</Alert>
				<Row>
					<Button icon={CameraIcon} disabled data-testid="camera-test">
						{t("tests.camera.open")}
					</Button>
				</Row>
			{/if}
		</Card>

		<Card variant="outlined" gap="3" as="article" data-testid="test-scanner">
			<Row align="center" justify="between" gap="3">
				<Row as="h3" align="center" gap="2" class="font-semibold">
					<ScanIcon size={ICON_SIZE.md} class="shrink-0" aria-hidden="true" />
					{t("tests.scanner.title")}
				</Row>
				<Button
					size="sm"
					icon={GuideIcon}
					href={testGuide("scanner")}
					aria-label={t("fix.guideOf", { item: t("tests.scanner.title") })}
				>
					{t("fix.guide")}
				</Button>
			</Row>
			<Hint>{t("tests.scanner.description")}</Hint>
			<ScannerTest />
		</Card>
	</section>
</Page>
