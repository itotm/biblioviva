// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic provider used when `METADATA_PROVIDER=mock` (e2e tests, demos without network).
// Known ISBNs answer with synthetic candidates; `9788800000017` answers no hits; `9788800000024`
// fails with a timeout so the error path can be exercised; searches match on the title words.
import { MetadataError, type BiblioDraft, type MetadataProvider } from "./types.js";

const draft = (
	over: Partial<BiblioDraft> & Pick<BiblioDraft, "title" | "author">,
): BiblioDraft => ({
	subtitle: null,
	originalTitle: null,
	responsibility: null,
	publisher: "s.n.",
	publicationPlace: null,
	publicationYear: null,
	isbn: null,
	issn: null,
	physicalDescription: null,
	series: null,
	seriesNumber: null,
	dewey: null,
	subjects: [],
	sourceId: null,
	source: "mock",
	...over,
});

export const MOCK_RECORDS: BiblioDraft[] = [
	draft({
		title: "1984",
		originalTitle: "Nineteen eighty-four",
		responsibility: "George Orwell ; traduzione di Stefano Manferlotti",
		author: "Orwell, George",
		publisher: "Mondadori",
		publicationPlace: "Milano",
		publicationYear: 2016,
		isbn: "9788804668237",
		physicalDescription: "333 p. ; 20 cm",
		dewey: "823.912",
		subjects: ["Romanzi distopici"],
		sourceId: "MOCK\\0000001",
	}),
	draft({
		title: "1984",
		originalTitle: "Nineteen eighty-four",
		responsibility: "George Orwell ; traduzione di Stefano Manferlotti",
		author: "Orwell, George",
		publisher: "Mondadori",
		publicationPlace: "Milano",
		publicationYear: 2019,
		isbn: "9788804668237",
		physicalDescription: "333 p. ; 20 cm",
		dewey: "823.912",
		subjects: ["Romanzi distopici"],
		sourceId: "MOCK\\0000002",
	}),
	draft({
		title: "Il furbo signor Volpe",
		originalTitle: "Fantastic Mr Fox",
		responsibility: "Roald Dahl ; illustrazioni di Quentin Blake",
		author: "Dahl, Roald",
		publisher: "Salani",
		publicationPlace: "Firenze",
		publicationYear: 2016,
		isbn: "9780140328721",
		physicalDescription: "96 p. : ill. ; 19 cm",
		sourceId: "MOCK\\0000003",
	}),
	draft({
		title: "Le cosmicomiche",
		responsibility: "Italo Calvino",
		author: "Calvino, Italo",
		publisher: "Mondadori",
		publicationPlace: "Milano",
		publicationYear: 2016,
		isbn: "9788800000000",
		physicalDescription: "195 p. ; 20 cm",
		dewey: "853.914",
		sourceId: "MOCK\\0000004",
	}),
	draft({
		title: "Il piccolo principe",
		originalTitle: "Le petit prince",
		responsibility: "Antoine de Saint-Exupéry",
		author: "Saint-Exupéry, Antoine de",
		publisher: "Bompiani",
		publicationPlace: "Milano",
		publicationYear: 2015,
		isbn: "9788807580017",
		physicalDescription: "125 p. : ill. ; 20 cm",
		dewey: "843.912",
		sourceId: "MOCK\\0000005",
	}),
	draft({
		title: "Storia della scienza",
		subtitle: "dalle origini a oggi",
		author: "AA. VV.",
		publisher: "Einaudi",
		publicationPlace: "Torino",
		publicationYear: 2010,
		isbn: "9788806049980",
		physicalDescription: "412 p. ; 24 cm",
		dewey: "509",
		subjects: ["Scienze - Storia"],
		sourceId: "MOCK\\0000006",
	}),
];

export const MOCK_NO_HITS_ISBN = "9788800000017";
export const MOCK_FAILING_ISBN = "9788800000024";

export const mockProvider: MetadataProvider = {
	id: "mock",
	name: "Mock",
	lookup(query) {
		if (query.kind === "isbn") {
			if (query.isbn === MOCK_FAILING_ISBN) {
				return Promise.reject(new MetadataError("timeout", "mock provider timed out"));
			}
			const drafts = MOCK_RECORDS.filter((r) => r.isbn === query.isbn);
			return Promise.resolve({ hits: drafts.length, drafts });
		}
		const needle = [query.title, query.author, query.words]
			.filter((s): s is string => Boolean(s))
			.join(" ")
			.toLowerCase();
		const drafts = MOCK_RECORDS.filter((r) =>
			needle.split(/\s+/).every((w) => `${r.title} ${r.author}`.toLowerCase().includes(w)),
		);
		return Promise.resolve({ hits: drafts.length, drafts });
	},
};
