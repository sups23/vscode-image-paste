# Compatibility evidence

## Current verification summary — 2026-10-17

This summary supersedes conflicting historical statuses below.

- User-reported production desktop acceptance: VS Code **1.142**, macOS Tahoe
  **26.0.1**. The user reports all desktop cases verified; individual case logs
  were not supplied and these checks were not independently executed here.
- Explicit session-only read-only check: after setting the active editor read-only
  in session, image paste shows no filename prompt, inserts no text, and saves no
  image. This resolves the reported concern for this tested setup without a code
  change. It does not establish a public API for querying editor read-only state.
- Undo removes text while retaining the image: confirmed by the user and approved
  as intended behavior. Provider switching also retains images; native Redo restores
  text links only. No deletion, ownership tracking or reference scanning is needed.
- Windows/Linux desktop checks and establishing the minimum supported VS Code
  version are deferred by user decision, not blockers for the current scope.
  The manifest's `^1.100.0` remains provisional, not a verified minimum.
- Executed in the container: `npm run typecheck` passed; `npm run lint` passed;
  `npm test` compiled successfully and ran **23 tests: 23 passed, 0 failed,
  0 skipped**. These checks do not independently verify desktop clipboard behavior.

No application-source change was required for the latest acceptance decisions.
This is not a claim of independently verified cross-platform release readiness.

## Superseding approved retention decision

The user explicitly confirmed that retaining saved images after Undo and switching
paste providers is correct and that checking other image occurrences is not needed.
This supersedes the earlier cleanup/ownership/Redo proposal and its lifecycle API
gate below. The specification and README now describe the existing retention
behavior as intended: native Redo restores text links, not image files. External
file removal/replacement is not repaired. No automatic deletion, reference scanner,
ownership tracker, or coordinated filesystem Redo is required.

The reported Undo result is therefore expected behavior, not an outstanding defect.
The separate editor-only read-only limitation, minimum-version evidence, and
Windows/Linux verification remain unresolved; this approval does not waive them.
Earlier cleanup requirements and blockers below are retained as historical evidence.

## Latest user report and lifecycle API gate

The user reports desktop acceptance on VS Code **1.142**, macOS Tahoe
**26.0.1**, with an explicit exception: Undo removes the inserted text but does
not delete the image. This is user-reported evidence, not an independently
executed desktop check. No per-case logs were supplied. It does not establish
the pending cleanup/Redo guarantees, Windows/Linux support, or a minimum editor
version. Earlier statements below that production desktop checks have never
been performed predate this report; their automated-test results are historical.

Read-only source inspection of the VS Code `1.142.0` tag confirms that the
lifecycle implementation gate remains **blocked**:

- `DocumentPasteEditProvider` exposes preparation, offering, and resolution,
  but no final application/replacement outcome callback. `DocumentPasteEdit`
  exposes insertion/additional edits, not custom Undo/Redo handlers.
- `TextDocumentChangeEvent` exposes the document, content changes and an optional
  Undo/Redo reason, but no identity linking the event to our paste operation.
- `PostEditWidgetManager` calls `await model.undo()` before resolving/applying a
  replacement. Its `editResult.isApplied` is internal. The preparatory Undo is
  therefore not evidence of successful replacement.
- The inspected public `TextDocument`, `TextEditor`, and `TextEditorOptions`
  contracts do not expose session-only editor read-only state. Filesystem/provider
  read-only information does not establish that editor restriction.

Sources inspected:

- https://github.com/microsoft/vscode/blob/1.142.0/src/vscode-dts/vscode.d.ts
  (`DocumentPasteEditProvider`, `DocumentPasteEdit`, `TextDocumentChangeEvent`,
  `TextDocument`, `TextEditor`, `TextEditorOptions`).
- https://github.com/microsoft/vscode/blob/1.142.0/src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts
  (`PostEditWidgetManager.applyEditAndShowIfNeeded`).

No reliable supported lifecycle mechanism was established by this investigation.
Automatic deletion remains disabled. Ownership tracking, reference inspection,
cleanup and coordinated Redo must not proceed as an approved implementation on
the strength of text-change heuristics. Continuing requires a demonstrated
supported mechanism or explicit approval of revised lifecycle/read-only behavior.
The source inspection is not a live desktop lifecycle test.

## Historical investigation and verification records

The following records predate the current summary. Their blocked statuses and
pending cleanup proposals are historical, not the current disposition.

Historical status: blocked pending manual desktop checks. This is not release approval.

The original development-only probe never writes image files. It inserts a visible text marker
to investigate provider offering/resolution, selection, cancellation and Undo.
It does not implement production saving, destination configuration, or insertion-failure detection.

Production activation now uses `MarkdownImagePasteProvider`, which does save images.
The diagnostic provider is not activated. Production manual checks are listed in
`test/manual/acceptance.md`; none have yet been executed in the desktop environment.
Automated checks cover real exclusive filesystem writes and mocked provider behavior,
not cross-platform release readiness. Approved cancellation and outcome revisions
are implemented; remaining live checks retain their blocked status.

Toolchain observed: Node v22.23.3; npm 10.9.9. No `code` executable is available in the container.
Automated container checks: `npm run typecheck`, `npm run lint`, and `npm test`
passed; the latest run compiled the extension and ran six tests (6 passed), including
output-document exclusion and mocked acceptance/cancellation/byte-read failure and
invalidation cases. Mocked provider tests do not establish actual desktop behavior.
Initial `npm install` failed with EPERM during binary permission changes on virtiofs;
`npm install --bin-links=false` succeeded. Scripts invoke tools through Node.
These automated results do not verify a desktop paste lifecycle.
API typings: @types/vscode 1.100.0. The manifest's ^1.100.0 constraint is provisional,
not an experimentally established minimum supported version.

| Requirement | Status | Evidence still required |
| --- | --- | --- |
| Ordinary paste precedence | blocked | Manual macOS test with built-in provider enabled |
| Selected-edit-only prompt and commit | blocked | Determine when resolution occurs; file commit not yet implemented |
| PNG/JPEG/WebP and image identity | blocked | Real clipboard representations, multiple-image distinguishability |
| Cancellation/single-image fallback | blocked | User reports no insertion on cancellation; empty insertion is not a fallback guarantee. Mixed image/text handling is excluded from v1. |
| Save before insertion and failure notification | blocked | Public API outcome mechanism and commit lifecycle |
| Multiple ranges and Undo | blocked | Manual multi-cursor and marker Undo test; saved-image retention not yet implemented |
| Windows and Linux | blocked | Desktop testing unavailable |

For each test record actual date, macOS/VS Code versions, case, steps, observations,
Output channel evidence, and verified/blocked/revised-with-approval status.
An unmet requirement needs an explicit approved revision before production integration.

## User-reported manual observations

Reported in this session; exact macOS/VS Code versions and complete operation logs
remain unavailable. These observations do not constitute complete gate approval.

- Extension Development Host launches through F5 with the isolated profile.
- Ordinary screenshot paste shows the probe prompt; accepting inserts the marker.
- Cancelling the prompt inserts nothing. No-file-write cancellation is not established
  for a future saving implementation; normal fallback is not established either.
- Alternative paste options include built-in Markdown image paste and the probe.
  The user reports each respective option behaves as expected without unwanted prompts.
- Continuous Output logging stopped after excluding Output documents from change logging.
- Mixed text/image copying pasted text without a prompt; clipboard image bytes were not
  established. The user subsequently excluded this behavior from v1 scope.

### Corrected PNG byte-retention result

User-supplied log timestamps: 2026-10-04T13:48:23.300Z–13:48:23.317Z.
The source was a clipboard screenshot in the macOS Extension Development Host.
Exact OS/editor versions are still missing.

```json
{"time":"2026-10-04T13:48:23.300Z","event":"resolve-end","operation":1,"accepted":true,"cancelled":false,"closed":false,"changed":false}
{"time":"2026-10-04T13:48:23.300Z","event":"image-bytes-ready","operation":1,"mime":"image/png","byteLength":34841,"phase":"resolve"}
{"time":"2026-10-04T13:48:23.317Z","event":"document-change","changes":1,"version":4}
```

This establishes nonempty PNG bytes retained until accepted resolution for this
input. The initial `image-bytes-read` event was not supplied. The later change event
does not independently prove marker contents, all-range insertion, or final save/link
success. JPEG/WebP, image identity, saving, and insertion-failure reporting remain
blocked. This is partial evidence, not complete compatibility-gate approval.

## Lifecycle investigation

Inspected installed `@types/vscode` 1.100.0, `DocumentPasteEditProvider` and
`DocumentPasteEdit` contracts:

- `resolveDocumentPasteEdit` returning no result uses the original edit, rather than
  abandoning it or selecting another provider. The probe's empty insertion remains
  an experimental no-op, not proof of required fallback.
- These interfaces expose no final application-success/failure callback. Returning
  an edit cannot establish final insertion success. Document change events alone
  do not reliably distinguish failure, unrelated changes, and later Undo.
- A direct file write during resolution therefore cannot yet meet the required
  saved-image/insertion-failure notification guarantee. Do not enable writes until
  this mechanism is established or revised behavior explicitly approved.

The first deferred-byte-read experiment failed on the user's desktop with
`image-bytes-read-failed` (operation 1). VS Code 1.100.0 source investigation
found `MainThreadPasteEditProvider.provideDocumentPasteEdits` disposes its clipboard
request in `finally`, while `DocumentPasteEditProvider.providePasteEdits` creates
file-data readers tied to that request. Source:
https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts
and https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/api/common/extHostLanguageFeatures.ts.

The corrected probe awaits image bytes during the initial provider call and retains
them in memory for selected-edit resolution. Only prompts and future writes must be
selected-only; reading bytes is not a filesystem side effect. Logs contain only
MIME/byte length, not contents. Tests model expired file access after provider return.
Live PNG resolution evidence is recorded above; initial read logs and version metadata
are still required for the complete case record. No directory or
image creation has been added. Investigation of newer stable APIs or alternate
lifecycles must preserve the selected-only, Undo, and no-clobber requirements.

## Cancellation and application-outcome gate

Further VS Code 1.100.0 source inspection:

- `createCombinedWorkspaceEdit` in
  https://github.com/microsoft/vscode/blob/1.100.0/src/vs/editor/contrib/dropOrPasteInto/browser/edit.ts
  skips all supplied ranges when `insertText` is empty, applying only additional
  edits. The probe has no additional edits, so this path is an empty edit rather
  than deletion of selected text. Live selected-text cancellation still needs testing.
- `PostEditWidgetManager.applyEditAndShowIfNeeded` in
  https://github.com/microsoft/vscode/blob/1.100.0/src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts
  resolves the edit, applies it through the internal bulk-edit service, and receives
  `isApplied` internally. No corresponding provider outcome callback is exposed.
- `CopyPasteController` in
  https://github.com/microsoft/vscode/blob/1.100.0/src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts
  proceeds with the selected resolved edit; an empty insertion does not initiate
  another provider's edit or automatic normal fallback.

These findings apply to the inspected 1.100.0 implementation, not every editor
version. The user's exact version is still missing. They explain why returning
an empty edit is a candidate selection-preserving cancellation behavior, but do not
meet the specification's automatic-fallback expectation or final-failure notification.

Production writes remain blocked pending verification of a stronger supported
mechanism or explicit approval of these proposed revisions:

1. Cancelling the selected filename prompt produces no document/file changes from
   this extension and does not automatically fall back; the user can paste again
   using another provider. Selection preservation must still pass desktop tests.
2. After complete saving, report the actual saved path without claiming confirmed
   link insertion. Retain the image regardless of subsequent application outcome;
   automatic detection of every final insertion failure is not guaranteed.

The user explicitly approved both revisions in this session. They are now applied
to the specification. This clears the behavior-decision gate, not remaining desktop
acceptance or cross-platform release verification.

## Production implementation verification

### Approved cleanup/Redo revision — not implemented

The user approved Redo restoring images/links without overwrite and retention of
modified/shared/uncertain images. The specification is updated; current production
still retains files. No deletion is enabled and no historical cleanup is authorized.

VS Code 1.100.0 `PostEditWidgetManager` switches providers by `await model.undo()`
before resolving/applying the replacement. Its final `isApplied` remains internal.
Thus a normal Undo event cannot establish whether a successful provider replacement
has occurred, and a native file creation edit would undo/delete before replacement
success. Source: https://github.com/microsoft/vscode/blob/1.100.0/src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts.

Native `CreateOperation` records inverse `DeleteOperation`; that deletion does not
validate original content hashes or search references. It therefore does not establish
the approved modified/shared-image protection. Source:
https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/contrib/bulkEdit/browser/bulkFileEdits.ts.

An opt-in **Toggle Lifecycle Diagnostics** command observes eligible-document events
without logging text/paths or performing writes/deletions. Manual steps are in
`test/manual/lifecycle.md`. Live results are unavailable until the user runs them.
Steps for ownership records, deletion and Redo restoration remain blocked at the
lifecycle gate; observations must not be substituted for reliable operation identity.

Implemented resource-scoped configuration/command, portable filename validation,
encoded links, exclusive saving, collision retries, incomplete artifact reporting,
and selected-edit resolution. Production activation replaces the diagnostic probe.
Configured `files.readonlyInclude`/`files.readonlyExclude` patterns are checked before
offering and saving; filesystem document writability is checked at both boundaries.
Latest executed checks: `npm run typecheck`, `npm run lint`, and `npm test` passed;
the latter compiled the extension and ran 22 tests with no failures or skips.
Tests cover real collision/concurrency and incomplete writes, plus mocked production
selection, cancellation, invalidation, restrictions and stale edit re-resolution.

Independent review identified a remaining read-only boundary: session-only editor
read-only state is not exposed by the inspected stable public API. A filesystem-writable
document marked read-only through an editor command might still save an image before
VS Code refuses insertion. This does not meet the current specification's promise
to decline all read-only documents without writes. Release is blocked pending a
supported detection mechanism or explicit approval of a documented limitation.
The previously approved final-insertion limitation does not automatically approve
this separate read-only requirement change.

Production desktop acceptance, exact minimum editor version, JPEG/WebP and image
identity, multiple ranges/Undo, and Windows/Linux remain unverified. Follow
`test/manual/acceptance.md`; do not report these as passed based on unit tests.
