// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { invertAuthorName } from "./author-name.js";

describe("invertAuthorName", () => {
	it("writes the surname first", () => {
		expect(invertAuthorName("George Orwell")).toBe("Orwell, George");
		expect(invertAuthorName("Robert Louis Stevenson")).toBe("Stevenson, Robert Louis");
		expect(invertAuthorName("F. Scott Fitzgerald")).toBe("Fitzgerald, F. Scott");
	});

	it("keeps lower-case particles after the name and capitalised ones in the surname", () => {
		expect(invertAuthorName("Antoine de Saint-Exupéry")).toBe("Saint-Exupéry, Antoine de");
		expect(invertAuthorName("Johann Wolfgang von Goethe")).toBe("Goethe, Johann Wolfgang von");
		expect(invertAuthorName("John Dos Passos")).toBe("Dos Passos, John");
		expect(invertAuthorName("Elizabeth Von Arnim")).toBe("Von Arnim, Elizabeth");
	});

	it("keeps a name already inverted or of one word, the first of two authors, no title", () => {
		expect(invertAuthorName("Orwell, George")).toBe("Orwell, George");
		expect(invertAuthorName("Omero")).toBe("Omero");
		expect(invertAuthorName("Alan Moore and Dave Gibbons")).toBe("Moore, Alan");
		expect(invertAuthorName("Sir Arthur Conan Doyle")).toBe("Doyle, Arthur Conan");
		expect(invertAuthorName("  Italo   Calvino ")).toBe("Calvino, Italo");
	});
});
