# Non-destructive Undo/Redo and provider-switch spike

Historical investigation checklist. Automatic cleanup has since been dropped by
user approval: retain images after Undo/provider switching and use native text
Redo. Ownership/reference checks and coordinated filesystem Redo below are no
longer implementation gates. Diagnostics remain optional and non-destructive.

Automatic deletion is disabled. Use the disposable F5 workspace only.

1. Run **Markdown Images: Toggle Lifecycle Diagnostics**. In Output select
   **Markdown Image Lifecycle**. Record the `started` event and macOS version.
2. Paste one screenshot with our provider and confirm the file/link. Undo, then Redo.
   Record the ordered events, file existence and restored link. Current files remain.
3. Paste another screenshot and switch to built-in Markdown paste through the paste
   selector. Record the Undo event followed by replacement changes. Note which files
   remain; diagnostics intentionally do not delete anything.
4. Separately delete link text by ordinary typing, then Undo that deletion. Compare
   these events with Undo of the original paste. This tests ambiguous ownership.
5. Repeat steps 2–3 with two cursors/selections and with alt text typed after paste.
6. Where reproducible, make replacement fail or cancel it after switching. Record
   whether the original link is restored and what events reveal actual success.
7. Toggle diagnostics off. Leave the window idle to verify logging stops.

Logs contain document-local numeric IDs, versions, reasons, and changed text lengths,
not text or filenames. Event sequences are evidence, not proof of operation identity
or replacement success. Never delete an image merely because a link disappeared.

Remaining code-level gates: reliable identity of an Undo operation versus ordinary
edits, replacement success (not just its preparatory Undo), reference/ownership checks,
and Redo coordination if another file occupies the original name. Native undoable
file creation does not by itself satisfy modified/shared-image retention.
