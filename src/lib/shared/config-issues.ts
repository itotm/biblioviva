// SPDX-License-Identifier: GPL-3.0-or-later
// The problems of a refused configuration change as text (Phase 11): the server's lines and the
// pages' messages are written by the same rule, `path: message`.

/** A problem of a configuration answer: a message, or a key path with its message. */
export type IssueText = string | { path: string; message: string };

/** One problem as a line (`path: message`). */
export function issueLine(issue: IssueText): string {
	return typeof issue === "string" ? issue : `${issue.path}: ${issue.message}`;
}

/** The problems as lines, in their order. */
export function issueLines(issues: readonly IssueText[]): string[] {
	return issues.map(issueLine);
}

/** The problems as one line (`path: message; …`). */
export function joinIssues(issues: readonly IssueText[]): string {
	return issueLines(issues).join("; ");
}
