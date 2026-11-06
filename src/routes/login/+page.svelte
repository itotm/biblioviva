<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import PasswordInput from "#lib/ui/PasswordInput.svelte";
	import { page } from "$app/state";
	import { login } from "#lib/remote/auth.remote.js";
	import { useI18n } from "#lib/i18n/context.js";
	import logoFull from "#lib/assets/logo-full.webp";
	import Button from "#lib/ui/Button.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import LanguageSwitch from "#lib/components/LanguageSwitch.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import EntryScreen from "#lib/ui/EntryScreen.svelte";
	import IconTile from "#lib/ui/IconTile.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { holdWait } from "#lib/ui/waits.svelte.js";

	const i18n = useI18n();
	const redirectTo = $derived(page.url.searchParams.get("redirectTo") ?? "/");
	const result = $derived(login.result);
	// the check of the password can take a while on a small host: the wait overlay says so
	$effect(() => {
		if (login.pending > 0) {
			return holdWait();
		}
	});
	// the root layout's data (+layout.server.ts), typed here for the template's lookups
	const demoPublic = $derived(
		page.data.demoPublic as { time: string; accounts: string[]; password: string } | null,
	);
	const languages = $derived(page.data.languages as readonly string[] | null);
	const demoCounts = $derived(
		(page.data.demo as { counts: Record<string, number> } | null)?.counts,
	);
	/** The icon and the colour of the area each demo account works in. */
	const ACCOUNT_AREAS: Record<string, { area: string; icon: keyof typeof icons }> = {
		admin: { area: "admin", icon: "admin" },
		prestiti: { area: "circulation", icon: "loan" },
		catalogo: { area: "catalog", icon: "catalog" },
		tessere: { area: "patrons", icon: "card" },
		report: { area: "reports", icon: "reports" },
	};
</script>

<svelte:head><title>{i18n.t("auth.title")} · {i18n.t("common.app.name")}</title></svelte:head>

<EntryScreen>
	{#if languages}
		<!-- the public demo only: the visitor's language (Q120) -->
		<LanguageSwitch
			{languages}
			current={page.data.locale as string}
			class="self-end bg-surface-50 md:fixed md:top-4 md:right-4"
		/>
	{/if}
	<section class="w-full max-w-sm space-y-6 card p-6 shadow-[var(--bv-shadow-raised)]">
		<header class="space-y-2 text-center">
			<img
				src={logoFull}
				alt=""
				width="288"
				height="288"
				class="mx-auto size-72 max-w-full"
				data-testid="login-logo"
			/>
			<h1 class="sr-only h2">{i18n.t("common.app.name")}</h1>
			<p class="opacity-70">{i18n.t("auth.subtitle")}</p>
		</header>

		<form {...login} class="space-y-4" data-testid="login-form">
			<input {...login.fields.redirectTo.as("hidden", redirectTo)} />
			<Field label={i18n.t("auth.username")}
				><Input
					{...login.fields.username.as("text")}
					autocomplete="username"
					autocapitalize="none"
					autocorrect="off"
					spellcheck={false}
					required
					autofocus
				/></Field
			>
			<Field label={i18n.t("auth.password")}
				><PasswordInput
					label={i18n.t("auth.password")}
					{...login.fields.password.as("password")}
					autocomplete="current-password"
					required
				/></Field
			>

			{#if result?.error}
				<Alert data-testid="login-error">
					{#if result.error === "rate_limited"}
						{i18n.t("auth.errors.rateLimited", { seconds: result.retryAfter })}
					{:else}
						{i18n.t("auth.errors.invalidCredentials")}
					{/if}
				</Alert>
			{/if}

			<Button variant="primary" full type="submit" disabled={login.pending > 0}
				>{login.pending > 0
					? i18n.t("common.status.loading")
					: i18n.t("auth.submit")}</Button
			>
		</form>
	</section>

	{#if demoPublic}
		<!-- the public demo (9.17): under the usual login, what it is and what it holds, the
		     accounts and their password, typed in the form like anywhere else -->
		<section
			class="w-full max-w-xl space-y-4 card p-6 shadow-[var(--bv-shadow-raised)]"
			data-testid="demo-welcome"
		>
			<Row wrap justify="between" gap="2">
				<h2 class="h3">{i18n.t("common.demoPublic.welcome.title")}</h2>
				<Badge tone="warning" icon={icons.beta} data-testid="demo-beta"
					>{i18n.t("common.demoPublic.welcome.beta")}</Badge
				>
			</Row>
			<p>{i18n.t("common.demoPublic.welcome.intro")}</p>
			<p>{i18n.t("common.demoPublic.welcome.betaText")}</p>
			{#if demoCounts}
				<p data-testid="demo-contents">
					{i18n.t("common.demoPublic.welcome.contents", { ...demoCounts })}
				</p>
			{/if}
			<p data-testid="demo-reset">
				{i18n.t("common.demoPublic.welcome.reset", { time: demoPublic.time })}
			</p>
			<p data-testid="demo-examples">{i18n.t("common.demoPublic.welcome.examples")}</p>
			<section class="space-y-3" data-testid="demo-credentials">
				<h3 class="font-semibold">{i18n.t("common.demoPublic.welcome.accountsTitle")}</h3>
				<Hint>{i18n.t("common.demoPublic.welcome.accountsHint")}</Hint>
				<ul class="space-y-3">
					{#each demoPublic.accounts as account (account)}
						{@const look = ACCOUNT_AREAS[account]}
						{@const Icon = icons[look?.icon ?? "info"]}
						<Row as="li" wrap={false} align="start" gap="3" data-area={look?.area}>
							<IconTile class="bv-area-icon bg-primary-100 text-primary-700">
								<Icon size={ICON_SIZE.lg} aria-hidden="true" />
							</IconTile>
							<p>
								<span class="font-mono font-semibold">{account}</span>
								·
								<strong
									>{i18n.t(`common.demoPublic.accounts.${account}.name`)}</strong
								>:
								{i18n.t(`common.demoPublic.accounts.${account}.does`)}
							</p>
						</Row>
					{/each}
				</ul>
				<p class="rounded-base bg-primary-50 px-3 py-2" data-testid="demo-password">
					{i18n.t("common.demoPublic.welcome.password")}
					<strong class="font-mono text-lg">{demoPublic.password}</strong>
				</p>
			</section>
		</section>
	{/if}
</EntryScreen>
