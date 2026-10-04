# Compatibility evidence

Status: blocked pending manual desktop checks. This is not release approval.

The development-only probe never writes image files. It inserts a visible text marker
to investigate provider offering/resolution, selection, cancellation and Undo.
It does not implement production saving, destination configuration, or insertion-failure detection.

Toolchain observed: Node v22.23.3; npm 10.9.9. No `code` executable is available in the container.
Automated container checks: `npm run typecheck`, `npm run lint`, and `npm test`
passed; the latter compiled the extension and ran two policy tests (2 passed).
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
| Cancellation/mixed-content fallback | blocked | Empty insertion is experimental, not a fallback guarantee |
| Save before insertion and failure notification | blocked | Public API outcome mechanism and commit lifecycle |
| Multiple ranges and Undo | blocked | Manual multi-cursor and marker Undo test; saved-image retention not yet implemented |
| Windows and Linux | blocked | Desktop testing unavailable |

For each test record actual date, macOS/VS Code versions, case, steps, observations,
Output channel evidence, and verified/blocked/revised-with-approval status.
An unmet requirement needs an explicit approved revision before production integration.
