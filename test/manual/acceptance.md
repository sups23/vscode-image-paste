# Production desktop acceptance

User reports all cases verified on VS Code 1.142 / macOS Tahoe 26.0.1, including
session-only read-only mode (no prompt, image save or insertion). Undo retains the
image as intended. Per-case logs were not supplied; these are user-reported results,
not independently executed checks. Windows/Linux and minimum-version checks are
deferred by request. See `sdlc/compatibility.md` for the current verification summary.

Record actual macOS and VS Code versions, input source, expected/observed result,
files created and screenshots/logs. Leave built-in Markdown paste enabled.
F5 now activates the production provider, not the diagnostic marker.

1. Open disposable `test.md`, copy a screenshot, Cmd+V, enter `login-error`.
   Verify one `qa/screenshots/login-error.png`, valid relative link and preview.
   A notification reports the actual saved path without promising final insertion.
   Verify the cursor lands between `[` and `]`; typing alt text must not change the destination.
2. Paste again with the same name: verify `login-error-1.png` and unchanged original.
3. Enter `photo.png`: PNG must produce `photo.png.png`. Test whitespace trimming,
   reserved names, separators, trailing dots, Unicode and over-limit correction.
4. Cancel with both an empty cursor and selected text. Document/selection contents
   must remain unchanged and no new directories/files may be created.
5. Select the built-in option instead. Our filename prompt/file write must not occur.
6. Paste with two cursors and selected ranges: one prompt/file, same link everywhere.
    Approved behavior: Undo removes links but retains the image. Redo restores links
    to the retained image without recreating or overwriting files.
   Switch paste options after insertion;
   report any repeat prompts, duplicates or unexpected Undo effects.
7. Change/close/rename the original document during the prompt: no stale insertion
   or image write; explanation shown. Change destination configuration during the
   prompt: current paste uses captured destination; next paste uses new setting.
8. In a multi-root workspace configure different destinations. Test active-document,
   sole-folder and folder-picker command behavior. Cancel settings prompts; ensure
   unchanged settings and no directory creation merely from configuration.
9. Test nested documents and paths with spaces, #, %, parentheses and Unicode in
   preview. Reject escaping paths and existing symlink/junction destination routes.
10. Test read-only document and destination: no false-success notification or link to
    an unsaved image. Record editor-only read-only behavior separately from permissions.
11. Repeat with genuine JPEG/WebP clipboard data. Verify extension and byte format.
    Normal text must paste unaffected. Test multiple-image clipboard inputs where
    reproducible; do not infer identity from MIME count alone.

Broader platform and exact minimum-version verification are deferred for the current
scope. They require separate evidence before claiming verified support. Mixed
image/text handling is excluded. Never delete retained user images as automated cleanup.
