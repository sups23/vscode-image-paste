# Compatibility evidence

Status: blocked pending manual desktop checks. This is not release approval.

The development-only probe never writes image files. It inserts a visible text marker
to investigate provider offering/resolution, selection, cancellation and Undo.
It does not implement production saving, destination configuration, or insertion-failure detection.

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
Live `image-bytes-read` evidence from the corrected probe is still required. No directory or
image creation has been added. Investigation of newer stable APIs or alternate
lifecycles must preserve the selected-only, Undo, and no-clobber requirements.
