// SPDX-License-Identifier: GPL-3.0-or-later
// Runtime facade (PLAN.md §3.21): the only place that touches Bun.password.
export interface PasswordHasher {
	hash(password: string, memoryMb?: number): Promise<string>;
	verify(password: string, hash: string): Promise<boolean>;
}

export const passwordHasher: PasswordHasher = {
	hash: (password, memoryMb = 16) =>
		Bun.password.hash(password, {
			algorithm: "argon2id",
			memoryCost: memoryMb * 1024,
			timeCost: 2,
		}),
	verify: async (password, hash) => {
		try {
			return await Bun.password.verify(password, hash);
		} catch {
			return false; // malformed or unsupported hash string
		}
	},
};
