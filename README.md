# Markdown Image Paste

Development build — production desktop acceptance reported on VS Code 1.142 /
macOS Tahoe 26.0.1. Broader platform and minimum-version testing is deferred.

Paste a clipboard PNG, JPEG, or WebP into a saved local `.md` document in Markdown
mode inside a workspace. Choose a filename stem; the extension saves the original
bytes without conversion and returns a relative image link at every paste range.

## Destination

`markdownImagePaste.destination` defaults to `qa/screenshots`. Configure a
workspace-relative path with `/` separators, or run **Markdown Images: Set
Destination Folder**. Multi-root workspaces use the document's folder. The command
updates folder-specific settings and does not create directories. Invalid explicit
settings are rejected. A paste retains the destination captured at its start.

## Filenames and cancellation

The MIME extension is always appended: PNG plus `photo.jpg` becomes `photo.jpg.png`.
Existing entries are never overwritten; collisions use `photo.jpg-1.png`, etc.
Validation trims surrounding whitespace but never silently truncates or replaces
characters. Shorter names may be requested when limits are exceeded.

Escape cancels without changing the document or saving an image. No automatic
fallback occurs; paste again using another provider if desired. Changing or closing
the original document during the prompt abandons the operation.

Every completed save reports its path **without confirming final link insertion**.
Images remain after Undo or insertion failure. Incomplete artifacts from failed
writes are retained and identified separately; no link is returned for them.

**Approved lifecycle behavior:** Undo and switching paste providers leave saved
images on disk. Native Redo restores links to the retained image; it does not
recreate or overwrite files externally removed or replaced. Remove unwanted files
manually. No automatic cleanup, ownership tracking, or image-reference scanning.

## Supported path budgets

Generated filename components must fit both 255 UTF-8 bytes and 255 UTF-16 code
units, including extension and suffix. Conservative full-path budgets are 240 UTF-16
code units on Windows, 1023 UTF-8 bytes on macOS, and 4095 UTF-8 bytes on Linux.
These are supported budgets, not universal filesystem maxima; actual filesystem
errors still cause a safe failure without a link. Filesystems may impose lower limits.

## Security and limitations

Absolute/escaping paths and detected symlink/junction destination routes are rejected.
A symlink or junction redirects a filesystem entry elsewhere. Hostile replacement
of directories between checking and writing is outside v1 protection: another process
could redirect a write after validation. No-clobber creation still prevents ordinary
filename collisions from overwriting entries.

Remote workspaces (SSH, WSL, containers), browser/virtual filesystems, untitled files,
mixed text/image handling, and genuinely multiple-image pastes are unsupported.
Clipboard APIs may not expose enough identity information to distinguish every
multiple-image input from alternate representations. Desktop acceptance is
user-reported, not independently verified across platforms. The user confirmed
that session-only editor read-only mode prevents prompting, saving and insertion
in the tested setup; no new read-only workaround was needed.

## Development and testing

Use an existing Node/npm installation, then run:

```sh
npm ci --bin-links=false
npm run typecheck
npm run lint
npm test
```

Open the project in local desktop VS Code and press F5 using **Run Markdown Image
Paste**. The task creates an ignored disposable workspace if needed without replacing
an existing `test.md`. The test profile is isolated, so it does not inherit your theme.
This now saves real images; use only the disposable workspace.

See `test/manual/acceptance.md` and `sdlc/compatibility.md`. The `^1.100.0` editor
constraint is provisional; compilation against its typings is not proof of a tested
minimum. Production desktop acceptance is user-reported on VS Code 1.142 / macOS
Tahoe 26.0.1. Windows/Linux and minimum-version testing are deferred by request,
not verified. See the current summary in `sdlc/compatibility.md` for exact results.
