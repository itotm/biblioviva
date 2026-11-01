<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Living style guide: every Skeleton component and pattern used by the app, on one page. -->
<script lang="ts">
	import {
		Combobox,
		Dialog,
		Pagination,
		Portal,
		Tabs,
		useListCollection,
	} from "@skeletonlabs/skeleton-svelte";
	import { toaster } from "#lib/ui/toaster.js";
	import DataGrid, { type GridColumn, type GridRow } from "#lib/components/DataGrid.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import ListToolbar from "#lib/ui/ListToolbar.svelte";
	import FormLayout from "#lib/ui/FormLayout.svelte";
	import FormSection from "#lib/ui/FormSection.svelte";
	import DetailLayout from "#lib/ui/DetailLayout.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Loading from "#lib/ui/Loading.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import ClassBadge from "#lib/components/ClassBadge.svelte";
	import SimilarBadge from "#lib/components/SimilarBadge.svelte";
	import SheetPicture from "#lib/components/patrons/SheetPicture.svelte";
	import NoteTile from "#lib/components/notes/NoteTile.svelte";
	import UpcomingDates from "#lib/components/calendar/UpcomingDates.svelte";
	import type { NoteRow } from "#lib/server/services/notes.js";
	import { NOTE_COLORS } from "#lib/shared/notes.js";
	import BarcodeInput from "#lib/components/BarcodeInput.svelte";
	import CameraCapture from "#lib/components/CameraCapture.svelte";
	import ScannerOverlay from "#lib/components/ScannerOverlay.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import FormErrors from "#lib/components/FormErrors.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { ITEM_STATUS, LOAN_STATUS, PATRON_STATUS, PRINT_STATUS } from "#lib/ui/status.js";
	import Button from "#lib/ui/Button.svelte";
	import PageActions from "#lib/ui/PageActions.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Link from "#lib/ui/Link.svelte";
	import OrderedList from "#lib/ui/OrderedList.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";
	import MediaCard from "#lib/ui/MediaCard.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";
	import PasswordInput from "#lib/ui/PasswordInput.svelte";
	import FilterSelect from "#lib/ui/FilterSelect.svelte";
	import LinkCard from "#lib/ui/LinkCard.svelte";
	import IconTile from "#lib/ui/IconTile.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import StatTile from "#lib/ui/StatTile.svelte";
	import NavCard from "#lib/ui/NavCard.svelte";

	const XIcon = icons.close;
	const ArrowLeftIcon = icons.back;
	const ArrowRightIcon = icons.forward;
	const BookIcon = icons.book;
	let modalOpen = $state(false);
	let toggleChoice = $state<"sample" | "real">("sample");
	let radioChoice = $state("forest");
	let filterValue = $state("");
	const queryStates = [
		{ error: undefined, ready: false as const },
		{ error: new Error("500"), ready: false as const },
		{ error: undefined, ready: true as const, current: "" },
		{ error: undefined, ready: true as const, current: "Il piccolo principe" },
	];
	const notFoundState = { error: new Error("404"), ready: false as const };

	const patrons = [
		{ label: "Rossi Anna (3 A)", value: "1" },
		{ label: "Bianchi Luca (2 B)", value: "2" },
		{ label: "Verdi Sara (5 C)", value: "3" },
		{ label: "Neri Marco (docente)", value: "4" },
	];
	let query = $state("");
	const filtered = $derived(
		patrons.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())),
	);
	const collection = $derived(
		useListCollection({
			items: filtered,
			itemToString: (item) => item.label,
			itemToValue: (item) => item.value,
		}),
	);

	let page = $state(1);

	// the staff notes as post-its (step 9.18): one per colour, the first pinned, the last long
	const sampleNotes: NoteRow[] = NOTE_COLORS.map((color, i) => ({
		id: i + 1,
		body:
			i === NOTE_COLORS.length - 1
				? "Una segnalazione lunga si accorcia.\n".repeat(12).trim()
				: "Lo scanner del banco non legge le tessere vecchie.",
		color,
		pinned: i === 0,
		author: "Gestione prestiti",
		createdAt: "2026-10-05T08:30:00.000Z",
		archivedAt: null,
		archivedBy: null,
	}));

	// 10 000 generated rows for the DataGrid demo (virtual scrolling check).
	const surnames = [
		"Rossi",
		"Bianchi",
		"Verdi",
		"Neri",
		"Esposito",
		"Romano",
		"Colombo",
		"Ricci",
	];
	const gridRows: GridRow[] = Array.from({ length: 10_000 }, (_, i) => ({
		id: i + 1,
		surname: `${surnames[i % surnames.length]} ${i + 1}`,
		classLabel: `${(i % 5) + 1} ${"ABCD"[i % 4]}`,
		loans: i % 7,
		card: String(1000 + i).padStart(10, "0"),
	}));
	const gridColumns: GridColumn[] = [
		{ id: "surname", header: "Cognome e nome", flexgrow: 2, sort: true },
		{ id: "classLabel", header: "Classe", width: 110, sort: true },
		{ id: "loans", header: "Prestiti", width: 110, sort: true },
		{ id: "card", header: "Tessera", width: 150 },
	];
	let clickedRow = $state<string | null>(null);
	let lastScan = $state<string | null>(null);
	// continuous scanner demo (step 3.3): every distinct code the camera reads, in order
	let showScanner = $state(false);
	let scanLog = $state<string[]>([]);
	let confirmOpen = $state(false);
	let confirmed = $state(0);
	let showCamera = $state(false);
	const sampleIssues = [
		{ message: "Campo obbligatorio", path: ["surname"] },
		{ message: "Formato non valido", path: ["card"] },
	];
	let toolbarSearch = $state("");
	const iconNames = Object.keys(icons) as (keyof typeof icons)[];
	const dialogAnimation =
		"transition transition-discrete opacity-0 translate-y-4 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100 data-[state=open]:translate-y-0";

	// the sample of `SheetPicture`: a page with five coloured photos
	const SHEET_SAMPLE = `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f5f5f0"/>${[
			[20, 30, "#3b82f6"],
			[115, 30, "#facc15"],
			[210, 30, "#22c55e"],
			[305, 30, "#ec4899"],
			[20, 160, "#8b5cf6"],
		]
			.map(([x, y, c]) => `<rect x="${x}" y="${y}" width="70" height="95" fill="${c}"/>`)
			.join("")}</svg>`,
	)}`;
	const rect = (
		x: number,
		y: number,
		w: number,
		h: number,
	): [
		{ x: number; y: number },
		{ x: number; y: number },
		{ x: number; y: number },
		{ x: number; y: number },
	] => [
		{ x, y },
		{ x: x + w, y },
		{ x: x + w, y: y + h },
		{ x, y: y + h },
	];
</script>

<svelte:head><title>BiblioViva UI</title></svelte:head>

<Page class="space-y-10">
	<header class="space-y-1">
		<h1 class="h1">BiblioViva UI</h1>
		<p class="opacity-70">
			Style guide (development only). Light theme, Skeleton v5, Lucide icons.
		</p>
	</header>

	<section class="space-y-3" data-testid="ui-components">
		<h2 class="h3">Buttons (`Button`, `IconButton`, `FileButton`)</h2>
		<Row align="center">
			<Button variant="primary" icon={icons.loan}>Registra prestito</Button>
			<Button variant="primary-tonal">Rinnova</Button>
			<Button>Tonal</Button>
			<Button variant="outlined">Annulla</Button>
			<Button variant="error" icon={icons.lost}>Segna smarrito</Button>
			<Button variant="error-outlined">Rimuovi</Button>
			<Button variant="error-tonal" size="sm">Elimina</Button>
			<Button variant="success-tonal" size="sm" icon={icons.confirm}>Fatto</Button>
			<Button variant="primary" disabled>Disabilitato</Button>
			<Button href="/dev/ui" icon={icons.view}>Link</Button>
			<IconButton icon={icons.close} label="Chiudi" />
			<IconButton icon={icons.edit} label="Modifica" variant="tonal" size="sm" />
			<IconButton icon={icons.delete} label="Elimina" variant="error" size="sm" />
			<FileButton icon={icons.upload} accept="image/*">Carica file</FileButton>
		</Row>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Text, alerts and badges (`Hint`, `Alert`, `Badge`, `Link`)</h2>
		<Card variant="outlined" gap="3">
			<Hint>Testo secondario (muted).</Hint>
			<Hint tone="soft">Testo secondario (soft).</Hint>
			<Hint tone="error">Errore di campo.</Hint>
			<Hint tone="primary">96 titoli corrispondono ai filtri</Hint>
			<Hint tone="error-soft" mono>template.json: unexpected token</Hint>
			<Alert>Messaggio di errore (role="alert").</Alert>
			<Alert tone="warning">Avviso.</Alert>
			<Alert tone="info" padded>Informazione con più spazio.</Alert>
			<Alert soft mono live={false}>diagnostica in monospazio</Alert>
			<Alert tone="success" role="status">Esito di un controllo (role="status").</Alert>
			<Row align="center">
				<Badge tone="success" filled icon={icons.available}>Attivo (filled)</Badge>
				<Badge tone="error" filled>3 in ritardo</Badge>
				<Badge>Neutro</Badge>
				<Badge tone="primary">Primario</Badge>
				<Badge tone="secondary">Secondario</Badge>
				<Badge tone="success">Successo</Badge>
				<Badge tone="warning">Attenzione</Badge>
				<Badge tone="error">Errore</Badge>
				<SimilarBadge />
				<Link href="/dev/ui">Collegamento</Link>
			</Row>
		</Card>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Layout (`Page`, `Card`, `Row`, `Grid`, `SegmentedGroup`, `OrderedList`)</h2>
		<Grid cols="3" gap="3">
			<Card variant="outlined" gap="2" as="section">
				<span class="title-lg">Card outlined</span>
				<Hint>gap="2"</Hint>
			</Card>
			<Card variant="filled" gap="2" as="article">
				<span class="title-lg">Card filled</span>
				<Hint>as="article"</Hint>
			</Card>
			<Card gap="2">
				<span class="title-lg">Card plain</span>
				<SegmentedGroup fit>
					<Button size="sm" variant="primary">Uno</Button>
					<Button size="sm" class="hover:preset-tonal">Due</Button>
				</SegmentedGroup>
			</Card>
		</Grid>
		<OrderedList>
			<li>Primo passo</li>
			<li>Secondo passo</li>
		</OrderedList>
		<Grid cols="2" gap="3">
			<SelectCard selected={true}>
				<span class="title-lg">SelectCard selezionata</span>
				<Hint as="span" tone="soft" class="mt-1 block"
					>Bordo e sfondo pieni, mai una sottolineatura.</Hint
				>
			</SelectCard>
			<SelectCard selected={false}>
				<span class="title-lg">SelectCard</span>
				<Hint as="span" tone="faint" class="mt-1 block">hover: bordo primario e ombra</Hint>
			</SelectCard>
		</Grid>
		<Grid cols="3" gap="3" role="radiogroup" aria-label="Insieme di colori">
			{#each ["forest", "grape", "sunset"] as c (c)}
				<SelectCard
					selected={radioChoice === c}
					role="radio"
					row
					padding="3"
					onclick={() => (radioChoice = c)}
				>
					<IconTile size="size-10" class="bg-primary-100 text-primary-700"
						><BookIcon size={ICON_SIZE.lg} aria-hidden="true" /></IconTile
					>
					<span class="font-semibold">SelectCard radio · {c}</span>
				</SelectCard>
			{/each}
		</Grid>
		<Row align="center">
			<SegmentedGroup
				fit
				radio
				aria-label="Utente dell'anteprima"
				options={[
					{ value: "sample", label: "Esempio" },
					{ value: "real", label: "Utente vero" },
				]}
				value={toggleChoice}
				onselect={(v) => (toggleChoice = v)}
			/>
			<Hint as="span">SegmentedGroup con `options`: {toggleChoice}</Hint>
		</Row>
	</section>

	<section class="space-y-3">
		<h2 class="h3">
			Cards that lead somewhere (`LinkCard`, `StatTile`, `NavCard`, `IconTile`)
		</h2>
		<Grid cols="3" gap="3">
			<StatTile icon="loan" value={128} label="Prestiti aperti" href="/dev/ui" />
			<StatTile icon="overdue" value={7} label="In ritardo" tone="error" />
			<NavCard
				href="/dev/ui"
				icon="settings"
				title="Configurazione"
				description="Tutte le impostazioni"
			/>
			<LinkCard href="/dev/ui" class="flex flex-col gap-1 p-4">
				<span class="font-semibold">LinkCard raised</span>
				<Hint as="span">Una scheda che porta a una pagina</Hint>
			</LinkCard>
		</Grid>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Filters and query states (`FilterSelect`, `QueryState`)</h2>
		<Row align="center">
			<FilterSelect label="Tipo" all="tutti" bind:value={filterValue}>
				<option value="student">Alunni</option>
				<option value="teacher">Docenti</option>
			</FilterSelect>
			<Hint as="span">Filtro: {filterValue || "nessuno"}</Hint>
		</Row>
		<Grid cols="3" gap="3">
			{#each queryStates as q, i (i)}
				<Card variant="outlined">
					<QueryState query={q} size="md" isEmpty={(title) => title === ""}>
						{#snippet empty()}<Hint>Nessun titolo</Hint>{/snippet}
						{#snippet children(title)}<p class="font-semibold">{title}</p>{/snippet}
					</QueryState>
				</Card>
			{/each}
			<Card variant="outlined">
				<QueryState query={notFoundState} mode="notFound" back="/dev/ui">
					{#snippet children(title)}<p class="font-semibold">{title}</p>{/snippet}
				</QueryState>
			</Card>
		</Grid>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Form inputs</h2>
		<Grid>
			<Field label="Cognome"><Input type="text" placeholder="Rossi" /></Field>
			<Field label="Password (PasswordInput)"
				><PasswordInput label="Password" autocomplete="off" value="biblioviva" /></Field
			>
			<Field label="Tipo copia"
				><Select>
					<option>Libro</option>
					<option>DVD</option>
					<option>Consultazione</option>
				</Select></Field
			>
			<Field label="Note" span
				><textarea class="textarea" rows="2" placeholder="Note interne"></textarea></Field
			>
		</Grid>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Combobox (patron search)</h2>
		<Combobox
			class="max-w-md"
			placeholder="Cerca per cognome…"
			{collection}
			onInputValueChange={(e) => (query = e.inputValue)}
		>
			<Combobox.Label class="label-text">Utente</Combobox.Label>
			<Combobox.Control class="flex gap-1">
				<Combobox.Input class="input" />
				<Combobox.Trigger class="btn-icon preset-tonal" aria-label="Apri elenco"
					>▾</Combobox.Trigger
				>
			</Combobox.Control>
			<Portal>
				<Combobox.Positioner>
					<Combobox.Content
						class="z-50 max-h-60 overflow-auto card preset-filled-surface-100-900 p-2 shadow-xl"
					>
						{#each filtered as item (item.value)}
							<Combobox.Item
								{item}
								class="rounded px-3 py-2 hover:preset-tonal data-[highlighted]:preset-tonal"
							>
								<Combobox.ItemText>{item.label}</Combobox.ItemText>
								<Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
							</Combobox.Item>
						{/each}
					</Combobox.Content>
				</Combobox.Positioner>
			</Portal>
		</Combobox>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Dialog and toast</h2>
		<Row>
			<Dialog>
				<Dialog.Trigger class="btn preset-filled-primary-500">Apri dialogo</Dialog.Trigger>
				<Portal>
					<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/40" />
					<Dialog.Positioner
						class="fixed inset-0 z-50 flex items-center justify-center p-4"
					>
						<Dialog.Content
							class="w-full max-w-md space-y-4 card preset-filled-surface-100-900 p-4 shadow-xl {dialogAnimation}"
						>
							<Row as="header" align="center" justify="between" gap="0" wrap={false}>
								<Dialog.Title class="title-lg">Conferma restituzione</Dialog.Title>
								<Dialog.CloseTrigger
									class="btn-icon hover:preset-tonal"
									aria-label="Chiudi"
								>
									<XIcon class="size-4" />
								</Dialog.CloseTrigger>
							</Row>
							<Dialog.Description>Il libro tornerà disponibile.</Dialog.Description>
							<Row justify="end" as="footer">
								<Dialog.CloseTrigger class="btn preset-tonal"
									>Annulla</Dialog.CloseTrigger
								>
								<Dialog.CloseTrigger class="btn preset-filled-primary-500"
									>Conferma</Dialog.CloseTrigger
								>
							</Row>
						</Dialog.Content>
					</Dialog.Positioner>
				</Portal>
			</Dialog>
			<Button onclick={() => (modalOpen = true)}>Apri Modal</Button>
			<Modal bind:open={modalOpen} title="Nuova segnalazione" note="Modal" width="lg">
				<p>Il dialogo dell'app: cornice, titolo e chiusura in un componente.</p>
				<Row justify="end" as="footer">
					<Button onclick={() => (modalOpen = false)}>Chiudi</Button>
				</Row>
			</Modal>
			<Button
				variant="primary-tonal"
				onclick={() =>
					toaster.success({
						title: "Prestito registrato",
						description: "Scadenza 4 ottobre",
					})}
			>
				Mostra toast
			</Button>
			<Button
				variant="primary-tonal"
				onclick={() => {
					toaster.error({
						title: "Errore",
						description: "Resta finché non la chiudi.",
					});
					toaster.warning({
						title: "Attenzione",
						description: "La copia è già nella lista.",
					});
					toaster.info({ title: "Informazione", description: "Lista aggiornata." });
				}}
				data-testid="toast-kinds">Info, avviso, errore</Button
			>
		</Row>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Tabs</h2>
		<Tabs defaultValue="loans">
			<Tabs.List>
				<Tabs.Trigger value="loans">Prestiti</Tabs.Trigger>
				<Tabs.Trigger value="history">Storico</Tabs.Trigger>
				<Tabs.Trigger value="notes">Note</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="loans" class="p-3">Prestiti attivi.</Tabs.Content>
			<Tabs.Content value="history" class="p-3">Storico dei prestiti.</Tabs.Content>
			<Tabs.Content value="notes" class="p-3">Note dell'utente.</Tabs.Content>
		</Tabs>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Badges and cards</h2>
		<Row>
			<span class="badge preset-filled-success-500">Disponibile</span>
			<span class="badge preset-filled-warning-500">In scadenza</span>
			<span class="badge preset-filled-error-500">In ritardo</span>
			<span class="badge preset-filled-tertiary-500">Consultazione</span>
			<Badge>3 A</Badge>
		</Row>
		<Grid cols="3">
			<Card variant="filled" gap="2" as="article">
				<h3 class="h4">Prestiti aperti</h3>
				<p class="text-3xl font-bold">128</p>
			</Card>
			<Card variant="filled" gap="2" as="article">
				<h3 class="h4">In ritardo</h3>
				<p class="text-3xl font-bold text-error-500">7</p>
			</Card>
			<Card variant="filled" gap="2" as="article">
				<h3 class="h4">Etichette da stampare</h3>
				<p class="text-3xl font-bold">12</p>
			</Card>
		</Grid>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Icons (one per concept)</h2>
		<ul class="grid grid-cols-3 gap-2 text-xs sm:grid-cols-4 md:grid-cols-6">
			{#each iconNames as name (name)}
				{@const Icon = icons[name]}
				<li
					class="flex items-center gap-2 rounded-base border border-surface-200 px-2 py-1"
				>
					<Icon size={ICON_SIZE.md} aria-hidden="true" /><span>{name}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Status triples (colour + icon + text)</h2>
		<Row data-testid="status-triples">
			{#each Object.values(ITEM_STATUS) as status (status.key)}<StatusBadge {status} />{/each}
			{#each Object.values(LOAN_STATUS) as status (status.key)}<StatusBadge
					{status}
					detail={status.key === "loan.overdue" ? "3 giorni" : undefined}
				/>{/each}
			{#each Object.values(PATRON_STATUS) as status (status.key)}<StatusBadge
					{status}
				/>{/each}
			{#each Object.values(PRINT_STATUS) as status (status.key)}<StatusBadge
					{status}
					size="sm"
				/>{/each}
			<ClassBadge label="3 A" />
			<ClassBadge fallback="Docente" />
		</Row>
	</section>

	<section class="space-y-3">
		<h2 class="h3">PageHeader (+ `PageActions`) + ListToolbar</h2>
		<Card variant="outlined" gap="4">
			<PageHeader title="Utenti" subtitle="312 studenti, 28 docenti" icon="patrons">
				{#snippet actions()}
					<PageActions
						actions={[
							{ key: "new", label: "Nuovo utente", icon: icons.add, primary: true },
							{ key: "import", label: "Importa CSV", icon: icons.upload },
							{ key: "export", label: "Esporta", icon: icons.export },
							{
								key: "off",
								label: "Non disponibile",
								icon: icons.print,
								disabled: true,
							},
							{ key: "remove", label: "Elimina", icon: icons.delete, danger: true },
						]}
					/>
				{/snippet}
			</PageHeader>
			<ListToolbar
				bind:search={toolbarSearch}
				searchPlaceholder="Cerca per cognome…"
				selectedCount={0}
			>
				{#snippet filters()}
					<span class="chip preset-tonal">Classe 3</span>
					<span class="chip preset-tonal">Senza foto</span>
				{/snippet}
				{#snippet actions()}
					<Button>Esporta</Button>
				{/snippet}
			</ListToolbar>
			<ListToolbar search="" selectedCount={4}>
				{#snippet selectionActions()}
					<Button size="sm" variant="primary">Stampa tessere</Button>
				{/snippet}
			</ListToolbar>
		</Card>
	</section>

	<section class="space-y-3">
		<h2 class="h3">FormLayout</h2>
		<Card variant="outlined">
			<FormLayout onsubmit={(e) => e.preventDefault()}>
				<FormSection title="Dati principali">
					<Field label="Cognome"><Input type="text" /></Field>
					<Field label="Nome"><Input type="text" /></Field>
				</FormSection>
				<FormSection title="Avanzate" collapsible open={false}>
					<Field label="Note"><Input type="text" /></Field>
				</FormSection>
				{#snippet actions()}
					<Button>Annulla</Button>
					<Button variant="primary" type="submit">Salva</Button>
				{/snippet}
			</FormLayout>
		</Card>
	</section>

	<section class="space-y-3">
		<h2 class="h3">DetailLayout, EmptyState, MediaCard</h2>
		<MediaCard
			title="Copertina"
			status="Trovata su Open Library: si salva con la scheda."
			data-testid="dev-media-card"
		>
			{#snippet media()}<div class="h-28 w-20 rounded-base bg-surface-200"></div>{/snippet}
			{#snippet actions()}<Button size="sm">Sostituisci con una foto</Button><Button size="sm"
					>Togli</Button
				>{/snippet}
		</MediaCard>
		<DetailLayout heading="Scheda dell'utente" title="Rossi Anna" subtitle="Studente">
			{#snippet media()}<div class="h-32 w-24 rounded-base bg-surface-200"></div>{/snippet}
			{#snippet facts()}<ClassBadge label="3 A" /><StatusBadge
					status={PATRON_STATUS.active}
				/>{/snippet}
			{#snippet actions()}<Button>Modifica</Button>{/snippet}
			<Grid>
				<EmptyState
					title="Nessun prestito"
					description="Passa un libro al banco per registrarne uno."
					icon="loan"
				>
					{#snippet action()}<Button variant="primary">Registra prestito</Button
						>{/snippet}
				</EmptyState>
			</Grid>
		</DetailLayout>
	</section>

	<section class="space-y-3" data-testid="ui-notes">
		<h2 class="h3">Staff notes (`NoteTile`, step 9.18)</h2>
		<ul class="bv-note-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each sampleNotes as note (note.id)}
				<li>
					<NoteTile {note}>
						{#snippet actions()}
							<Button size="sm" icon={icons.archive}>Archivia</Button>
						{/snippet}
					</NoteTile>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3" data-testid="ui-upcoming-dates">
		<h2 class="h3">Upcoming dates (`UpcomingDates`, `DatedRow`, step 9.25)</h2>
		<UpcomingDates
			upcoming={{
				total: 3,
				events: [
					{
						id: 1,
						title: "Lettura in classe: «Il piccolo principe»",
						notes: "Classi terze, in biblioteca alle 10.",
						startsOn: "2026-10-23",
						endsOn: null,
						author: "Gestione prestiti",
					},
					{
						id: 2,
						title: "Mostra del libro",
						notes: null,
						startsOn: "2026-11-14",
						endsOn: "2026-11-18",
						author: "Amministratore",
					},
				],
			}}
		/>
	</section>

	<section class="space-y-3" data-testid="ui-sheet-picture">
		<h2 class="h3">Class picture frames (`SheetPicture`, Phase 13)</h2>
		<Hint>
			The numbered frames of a picture with many photos: secondary while nobody is chosen,
			primary with a patron, green once saved, dashed grey when ignored; in correction mode
			the selected frame turns amber and shows its four corners.
		</Hint>
		<div class="max-w-sm">
			<SheetPicture
				src={SHEET_SAMPLE}
				width={400}
				height={300}
				mode="edit"
				selected={4}
				alt="Esempio di immagine con quattro foto"
				frames={[
					{
						id: 1,
						position: 1,
						corners: rect(20, 30, 70, 95),
						state: "pending",
						patronId: null,
					},
					{
						id: 2,
						position: 2,
						corners: rect(115, 30, 70, 95),
						state: "pending",
						patronId: 7,
					},
					{
						id: 3,
						position: 3,
						corners: rect(210, 30, 70, 95),
						state: "saved",
						patronId: 8,
					},
					{
						id: 4,
						position: 4,
						corners: rect(305, 30, 70, 95),
						state: "pending",
						patronId: null,
					},
					{
						id: 5,
						position: 5,
						corners: rect(20, 160, 70, 95),
						state: "ignored",
						patronId: null,
					},
				]}
			/>
		</div>
	</section>

	<section class="space-y-3" data-testid="ui-waits">
		<h2 class="h3">Waits (`Loading`, `WaitOverlay`)</h2>
		<Hint>
			One wait in the whole app: the large turning icon with "Caricamento…" under it, centred
			in the room the content will take (`Loading`; `size="md"` in a box or a dialog, `sm` on
			one line). `WaitOverlay` (in the root layout) shows the same over the page's part of the
			window, the menu and the bars left in sight (the whole window on the login), when the
			next page, or a wait held with `holdWait`, takes longer than 200 ms; it fades in and
			out, takes the clicks and never the focus.
		</Hint>
		<Row align="center" as="p"><Spinner /><span>Ricerca in corso…</span></Row>
		<div
			class="relative h-56 overflow-hidden rounded-container border border-surface-200 bg-surface-100"
		>
			<span class="absolute top-3 left-4 text-lg font-bold">Catalogo</span>
			<div class="absolute inset-0 flex items-center justify-center bg-surface-100/85">
				<Loading size="md" announce={false} />
			</div>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="h3">BarcodeInput, ConfirmDialog, FormErrors, CameraCapture</h2>
		<Grid>
			<div class="space-y-2">
				<BarcodeInput camera onscan={(kind, value) => (lastScan = `${kind}: ${value}`)} />
				<Hint data-testid="scan-result">
					{lastScan ? `Ultimo codice → ${lastScan}` : "Nessun codice letto"}
				</Hint>
			</div>
			<div class="space-y-3">
				<Row align="center">
					<Button variant="error" onclick={() => (confirmOpen = true)}
						>Elimina copia…</Button
					>
					<Hint as="span" data-testid="confirm-count">Confermate: {confirmed}</Hint>
					<Button onclick={() => (showCamera = !showCamera)}
						>{showCamera ? "Nascondi fotocamera" : "Mostra fotocamera"}</Button
					>
				</Row>
				<ConfirmDialog
					bind:open={confirmOpen}
					title="Eliminare la copia?"
					description="La copia 2026-00425 sarà rimossa dal catalogo."
					tone="error"
					confirmLabel="Elimina"
					onconfirm={() => {
						confirmed += 1;
					}}
				/>
				<FormErrors
					issues={sampleIssues}
					labels={{ surname: "Cognome", card: "Tessera" }}
				/>
				{#if showCamera}
					<CameraCapture
						snapshotButton
						onsnapshot={() => toaster.info({ title: "Foto scattata" })}
					/>
				{/if}
				<Button
					onclick={() => {
						scanLog = [];
						showScanner = !showScanner;
					}}
					data-testid="toggle-scanner"
					>{showScanner ? "Chiudi scanner continuo" : "Scanner continuo"}</Button
				>
				{#if showScanner}
					<ScannerOverlay
						onscan={(r) => {
							const entry = `${r.kind}: ${r.value}`;
							if (!scanLog.includes(entry)) {
								scanLog = [...scanLog, entry];
							}
						}}
						onclose={() => (showScanner = false)}
					/>
					<ol class="list-decimal pl-5 text-sm" data-testid="scan-log">
						{#each scanLog as entry (entry)}<li>{entry}</li>{/each}
					</ol>
				{/if}
			</div>
		</Grid>
	</section>

	<section class="space-y-3">
		<h2 class="h3">DataGrid (10 000 rows)</h2>
		<DataGrid
			data={gridRows}
			columns={gridColumns}
			height="24rem"
			onrowclick={(row) => (clickedRow = String(row.surname))}
		/>
		<Hint data-testid="grid-clicked">
			{clickedRow ? `Selezionato: ${clickedRow}` : "Nessuna riga selezionata"}
		</Hint>
	</section>

	<section class="space-y-3">
		<h2 class="h3">Pagination</h2>
		<Pagination
			count={95}
			pageSize={10}
			{page}
			onPageChange={(e) => (page = e.page)}
			class="flex items-center gap-1"
		>
			<Pagination.PrevTrigger class="btn-icon preset-tonal" aria-label="Pagina precedente">
				<ArrowLeftIcon class="size-4" />
			</Pagination.PrevTrigger>
			<Pagination.Context>
				{#snippet children(pagination)}
					{#each pagination().pages as p, index (index)}
						{#if p.type === "page"}
							<Pagination.Item
								{...p}
								class="btn-icon hover:preset-tonal data-[selected]:preset-filled-primary-500"
							>
								{p.value}
							</Pagination.Item>
						{:else}
							<Pagination.Ellipsis {index}>…</Pagination.Ellipsis>
						{/if}
					{/each}
				{/snippet}
			</Pagination.Context>
			<Pagination.NextTrigger class="btn-icon preset-tonal" aria-label="Pagina successiva">
				<ArrowRightIcon class="size-4" />
			</Pagination.NextTrigger>
		</Pagination>
		<Hint>Pagina {page}</Hint>
	</section>
</Page>
