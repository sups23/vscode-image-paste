# macOS compatibility probe

Historical diagnostic instructions: production activation now replaces this probe.
For the current F5 build follow `test/manual/acceptance.md`; it saves actual images.

This is a development probe, not the finished image-paste extension. It never saves
images. Built-in providers may still save files; use only a disposable test workspace.

## Setup

1. Copy this project to your Mac, excluding `node_modules` and `out`. Keep its source,
   package files, and lockfile. Install current stable desktop VS Code and use an
   existing Node/npm installation. Record macOS and VS Code versions.
2. In the project directory run `npm ci --bin-links=false`, `npm run typecheck`,
   `npm run lint`, and `npm test`. These commands compile the probe.
3. Create a dedicated empty workspace folder containing a saved `test.md` and a
   saved `other.md`. Do not use your normal project for these checks.
4. Start the Extension Development Host from macOS Terminal. Replace the three paths:

   ```sh
   code --user-data-dir /absolute/probe-user-data --extensions-dir /absolute/probe-extensions --extensionDevelopmentPath=/absolute/probe-project /absolute/test-workspace
   ```

   Use new dedicated data/extension directories, not your normal profile. If `code`
   is unavailable, invoke `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`.
5. Leave the built-in Markdown extension and its image-paste behavior enabled.
   Do not install unrelated extensions, change paste precedence settings, or add a
   custom paste keybinding. Open `test.md` in Markdown mode.
6. Open View → Output → **Markdown Image Paste Probe**. Confirm an `activated`
   event with `writesEnabled: false`. Logs omit clipboard contents and document paths.

## Checks

For every case record input source, steps, observed document changes, prompts,
new files, and the corresponding Output events. Do not equate a `resolve-start`
event with proof that an edit was selected: record when it actually occurs.

| Case | Action | Evidence to return |
| --- | --- | --- |
| Ordinary paste | Copy a screenshot and press Cmd+V | Which provider wins? Does the probe prompt? `offered` and `resolve` events |
| Alternative edit | Use Paste As with the same clipboard image and choose another provider | Does merely offering the probe prompt? Does resolution happen before selection? |
| Formats | Repeat with actual PNG, JPEG, and WebP clipboard images | Advertised MIME types and file representations; record unavailable input sources |
| Multiple images | Copy multiple images using an app that supports it | Does the API expose separate images or indistinguishable representations? |
| Mixed content | Not required | User explicitly excluded mixed image/text handling from v1 |
| Cancel | Press Escape at the probe prompt | Does normal fallback occur, does nothing happen, or does another provider act? |
| Text | Copy plain text, then Cmd+V | Normal paste, no probe prompt |
| Multiple ranges | Create two cursors/selections and paste | One prompt, marker at both ranges, selection replacement |
| Undo | Accept the probe and Undo | Marker(s) removed together; record built-in provider effects separately |
| Changed document | While prompting, arrange a change to the original document | Prompt closes; record whether any stale insertion occurs |
| Closed/moved document | Close or rename the original document while prompting where feasible | Cancellation behavior; mark unavailable cases blocked |
| Other document | Paste into `.txt`, non-Markdown mode, or an untitled document | No probe handling |

The prompt accepts any stem; validation and image saving are deliberately not
implemented. Cancellation currently returns an empty insertion for experimentation,
which may suppress rather than preserve normal fallback. Report that as a blocker,
not a successful cancellation implementation.

On screenshot paste, check for `image-bytes-read` with `phase: "provide"` and a nonzero
`byteLength`. After accepting, expect `image-bytes-ready` with `phase: "resolve"`.
The bytes are buffered in memory before offering the edit because clipboard file
access expires after the initial provider call returns. No prompt or filesystem
write occurs while offering an edit. This proves byte access only for that input, not image
identity or file saving. `image-bytes-unavailable` or `image-bytes-read-failed`
indicates a blocked clipboard case. Byte contents are never logged or saved.

## Separate unresolved checks

This probe cannot establish complete image saving, selected-only filesystem commit,
saved-image retention, read-only handling, or reliable notification of failed final
insertion. These remain blocked until public API inspection and further experimental
evidence establish the mechanism. Windows/Linux remain unverified.

Send back versions, case results, and Output logs. Never mark a check verified just
because the project compiles or a mocked unit test passes.
