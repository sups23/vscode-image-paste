# VS Code Markdown Image Paste Extension — Technical Specification

## 1. Overview

Build a lightweight VS Code extension that improves image pasting inside Markdown files.

When a user pastes a supported image from the clipboard into a saved local `.md` file in Markdown language mode inside a workspace, the extension should:

1. Detect the pasted image.
2. Read a workspace-configured destination folder.
3. Prompt the user for a custom filename stem (without the generated extension).
4. Save the image into the configured folder.
5. Insert the correct relative Markdown image link at the current cursor position.

The extension should remain intentionally small and focused. It does not need a sidebar, webview, image editor, or complex UI.

---

## 2. Primary Goal

Allow users to control both:

- where pasted Markdown images are stored; and
- what each pasted image is named.

Example configuration:

```json
{
  "markdownImagePaste.destination": "qa/screenshots"
}
```

Example workflow:

```text
Copy screenshot
    ↓
Open Markdown file
    ↓
Press Cmd+V / Ctrl+V
    ↓
Extension detects image
    ↓
Prompt: Image filename
    ↓
User enters: login-error
    ↓
Image saved as:
qa/screenshots/login-error.png
    ↓
Markdown link inserted:
![](../qa/screenshots/login-error.png)
```

---

## 3. Scope

### In Scope

The first version should support:

- image paste handling in Markdown files;
- configurable workspace-relative destination folder;
- custom filename prompt on every image paste;
- automatic file extension handling;
- automatic folder creation if the destination does not exist;
- relative Markdown link generation;
- filename validation with inline explanations;
- automatic numbered filenames for existing-file collisions, without overwriting;
- per-workspace-folder configuration;
- command for setting the destination folder;
- local desktop VS Code on macOS, Windows, and Linux;
- multiple paste ranges using one saved image and the same link at every range.

### Out of Scope

The first version does not need:

- image compression;
- image resizing;
- PNG-to-WebP conversion;
- image optimization;
- drag-and-drop handling;
- multiple images in one paste;
- sidebar UI;
- webview UI;
- image preview;
- cloud uploads;
- automatic AI-generated filenames;
- image metadata management;
- remote workspaces, including SSH, WSL, and Dev Containers;
- browser VS Code and virtual filesystems;
- untitled documents, documents outside a workspace, and non-`.md` files;
- overwriting existing files;
- deleting saved images on Undo.

These can be added later if required.

---

## 4. Extension Configuration

The extension should expose the following VS Code setting:

```json
{
  "markdownImagePaste.destination": "qa/screenshots"
}
```

### Setting

`markdownImagePaste.destination`

Purpose:

Defines the folder where pasted images will be stored.

The path must be relative to the workspace folder containing the current Markdown document. Read the setting with the document URI as its resource scope so folder-specific settings are respected.

Example:

```text
qa/screenshots
```

Resolved internally as:

```text
<workspace-root>/qa/screenshots
```

Reject absolute paths and URI values, empty or whitespace-only values, and destinations that resolve outside the workspace folder. An absent setting uses the default `qa/screenshots`; an explicitly invalid setting must produce a clear error, not silently fall back.

Use `/` as the configuration path separator. The setting must support workspace-folder overrides through resource-scoped configuration.

This keeps the project portable across different machines and users.

---

## 5. Destination Command

Provide a VS Code command:

```text
Markdown Images: Set Destination Folder
```

Command ID:

```text
markdownImagePaste.setDestination
```

The command is required in v1. Show a text input for a workspace-relative destination, prefilled with the current effective setting. Validate the destination before saving it as a workspace-folder setting.

Use the workspace folder containing the active eligible document. If no eligible document is active, select the sole workspace folder or ask the user to choose among multiple folders. With no workspace open, show a clear error. Cancelling either prompt leaves settings unchanged.

Example:

```text
qa/screenshots
```

The resulting workspace-folder setting becomes:

```json
{
  "markdownImagePaste.destination": "qa/screenshots"
}
```

The command should update the setting using workspace-folder scope for the selected folder. It must not store an absolute path or create the destination merely to configure it.

---

## 6. Paste Behavior

The extension should register a VS Code `DocumentPasteEditProvider`.

The provider should only run when:

- the current document language is Markdown; and
- the document is a saved local file whose extension is `.md` (case-insensitive), inside a local workspace; and
- the clipboard contains a single supported image.

Supported MIME types should include at least:

```text
image/png
image/jpeg
image/webp
```

If the paste does not contain an image, the extension should return `undefined` so normal VS Code paste behavior continues unchanged.

Unsupported formats and genuinely multiple-image inputs are not handled and allow normal paste fallback. When a single image has several supported representations, prefer PNG, then JPEG, then WebP. Do not mistake alternative representations of one image for multiple images; verify what the supported clipboard APIs expose.

The intended experience is automatic handling on Cmd+V / Ctrl+V, not a required Paste As selection. Provider registration alone does not guarantee precedence over VS Code's built-in Markdown image provider or other extensions. Validate precedence and clipboard access as described in section 17 before implementation is considered ready.

Cancelling this extension's prompts abandons its edit and permits normal VS Code paste fallback. Other clipboard content or another image provider may still modify the document; cancellation does not promise a globally cancelled paste.

---

## 7. Image Paste Flow

When the user pastes an image into a Markdown document:

```text
Image pasted
    ↓
Check document language, saved .md file, and local workspace eligibility
    ↓
Select one supported clipboard image representation
    ↓
Determine current workspace
    ↓
Read markdownImagePaste.destination
    ↓
Prompt user for filename
    ↓
Validate filename stem
    ↓
Determine image extension
    ↓
Create destination folder if missing
    ↓
Choose available numbered filename
    ↓
Commit image bytes without overwriting, only for the selected paste operation
    ↓
Calculate relative path from Markdown file
    ↓
Insert Markdown image syntax at every paste range
```

This is the logical user flow, not a prescription to write files while generating potential paste edits. Do not create directories or image files for an edit that is merely offered and never selected. Respect cancellation before committing a file.

If saving succeeds but the Markdown edit is not applied, keep the image and notify the user with its path. After a successful paste, Undo removes the Markdown insertion but retains the saved image. Do not automatically delete image files.

For multiple cursors or selections, prompt once, save one image, and insert the same link at every supplied paste range, replacing selected text as normal paste does. Use the original paste document and ranges rather than whichever editor happens to be active after the prompt.

Capture the original document identity, version, paste ranges, workspace folder, and effective destination when the operation begins. If the original document changes, closes, or moves while the filename prompt is open, abandon this extension's operation and explain why; do not write an image or apply stale ranges. Revalidate the original document before committing. If an image was already saved before invalidation is detected, retain it and notify the user with its actual path rather than reporting success.

Use the destination captured at the start even if the destination setting changes during the prompt. Revalidate that captured destination's safety before saving; configuration changes apply to subsequent paste operations.

---

## 8. Filename Prompt

For every supported image paste selected for this extension's handling, show an input box:

```text
Image filename (without extension)
```

Example input:

```text
login-error
```

If the clipboard image is PNG, save:

```text
qa/screenshots/login-error.png
```

The entered text is always a filename stem, even when it contains a suffix resembling an extension. For PNG data, entering:

```text
login-error.png
```

produces:

```text
login-error.png.png
```

Likewise, entering `photo.jpg` for PNG data produces:

```text
photo.jpg.png
```

Explain in the prompt that the image format's extension is always appended. The extension does not convert image formats or strip a suffix supplied by the user.

---

## 9. Filename Validation

Validate the filename stem before writing. Apart from trimming surrounding whitespace, do not silently replace characters or rename the user's input.

At minimum:

- trim leading and trailing whitespace;
- reject empty values;
- reject invalid filesystem characters and control characters;
- prevent path traversal;
- prevent filenames such as `../image.png`;
- prevent absolute paths;
- reject both `/` and `\` path separators;
- reject `.` and `..`, Windows reserved device names, and stems ending in a dot;
- validate the final generated filename, including its suffix and extension, against supported filesystem limits.

Use a portable filename policy across macOS, Windows, and Linux, including Windows-invalid characters (`< > : " / \ | ? *`) and reserved names. Show an inline explanation and keep the prompt open for correction. Validate again before committing the file.

Validate every generated candidate against filename-component and full-path limits, including the appended format extension and any collision suffix. If a candidate exceeds a limit, explain the problem and allow the user to enter a shorter stem before saving. Never silently truncate or otherwise rename the stem. If correction is unavailable after saving begins, fail clearly without inserting this extension's link. Document the supported limits and how they are measured during engineering planning; do not assume a single character count covers all supported filesystems.

The filename prompt should only define the filename, not another destination path.

Example:

```text
login-error
```

Allowed.

Example:

```text
../private/login-error
```

Not allowed.

---

## 10. File Extension Handling

Determine the extension using the pasted image MIME type.

Examples:

```text
image/png  → .png
image/jpeg → .jpg
image/webp → .webp
```

Always append the extension derived from the selected MIME type to the trimmed, validated stem. If the user enters:

```text
login-error
```

and the MIME type is `image/png`, save:

```text
login-error.png
```

If the user enters:

```text
login-error.png
```

save `login-error.png.png` for PNG data. A suffix in the entered stem is literal text, not an instruction to choose an image format. JPEG data uses `.jpg`, including when the stem ends in `.jpeg`.

---

## 11. Existing File Handling

Never overwrite an existing file. Use the entered stem and MIME-derived extension as the initial candidate.

Example:

```text
qa/screenshots/login-error.png
```

If that path already exists, automatically try:

```text
qa/screenshots/login-error-1.png
qa/screenshots/login-error-2.png
...
```

Append the smallest available positive integer to the full entered stem, before the generated extension. For stem `photo.jpg` and PNG data, the first collision candidate is `photo.jpg-1.png`. Any existing entry at a candidate path, including a directory or symlink, makes that name unavailable.

The generated Markdown link must reference the actual committed filename. No overwrite prompt is needed.

Checking existence alone is insufficient: require exclusive/no-clobber file creation at commit time. If another operation claims the candidate between checking and creating it, retry with another numbered candidate without modifying that existing entry.

---

## 12. Destination Folder Creation

If the configured directory does not exist:

```text
qa/screenshots
```

the extension should create it automatically before writing the image.

Nested directories should also be supported.

Example:

```text
qa/manual-testing/screenshots
```

should be created recursively when required.

---

## 13. Markdown Link Generation

After saving the image, calculate the relative path from the current Markdown document to the image.

Example workspace:

```text
project/
├── qa/
│   └── screenshots/
│       └── login-error.png
│
└── docs/
    └── testing.md
```

When pasting inside:

```text
docs/testing.md
```

insert:

```md
![](../qa/screenshots/login-error.png)
```

Do not insert an absolute filesystem path.

Bad:

```md
![](/Users/me/project/qa/screenshots/login-error.png)
```

Correct:

```md
![](../qa/screenshots/login-error.png)
```

Path separators in Markdown links should use `/`, including on Windows.

Calculate the path relative to the Markdown document's parent directory. Encode path segments so spaces, `#`, `%`, parentheses, and other Markdown/URI-sensitive characters cannot break the link. Preserve `/` separators and `..` navigation segments; avoid double encoding. This applies to destination directories as well as filenames.

---

## 14. Multiple Workspace Support

If VS Code has multiple workspace folders open, determine which workspace contains the current Markdown document.

Use that workspace as the root for:

```text
markdownImagePaste.destination
```

The extension should not assume the first workspace folder is always correct.

Read resource-scoped configuration for that document and resolve the resulting destination inside its own workspace folder. Different workspace folders may use different destination settings.

---

## 15. No Workspace Case

If the Markdown document is not inside a workspace, the extension should show an error such as:

```text
Cannot save pasted image because this Markdown file is not part of a workspace.
```

The extension should decline handling and allow normal VS Code paste fallback. No image is saved by this extension.

The first version does not need support for arbitrary absolute destination folders outside a workspace.

Untitled, nonlocal, and read-only targets are not supported. Decline handling without creating directories or files; provide a clear explanation when a supported image paste cannot be handled because the document or destination is not writable.

---

## 16. Recommended Project Structure

Keep the extension small:

```text
markdown-image-paste/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── extension.ts
    ├── pasteProvider.ts
    ├── configuration.ts
    └── fileUtils.ts
```

### `extension.ts`

Responsibilities:

- activate extension;
- register paste provider;
- register commands.

### `pasteProvider.ts`

Responsibilities:

- receive image paste;
- prompt for filename;
- arrange image creation only for the selected paste operation;
- generate Markdown link;
- return paste edit.

### `configuration.ts`

Responsibilities:

- read destination setting;
- update the selected workspace folder's destination setting.

### `fileUtils.ts`

Responsibilities:

- validate filename stems and final generated names;
- determine extension;
- create directories;
- allocate numbered filenames with no-clobber creation;
- enforce workspace containment and reject symlink/junction routes;
- calculate relative paths.

For a very small first implementation, all functionality may initially live in `extension.ts` and be split later.

---

## 17. VS Code APIs

The extension will primarily use:

```ts
vscode.languages.registerDocumentPasteEditProvider(...)
```

for intercepting image paste operations in Markdown.

Other useful APIs include:

```ts
vscode.window.showInputBox(...)
```

for custom filename entry.

```ts
vscode.window.showQuickPick(...)
```

for selecting a workspace folder when the destination command cannot infer one from an eligible active document.

```ts
vscode.workspace.getConfiguration(...)
```

for reading and writing the destination setting.

```ts
vscode.workspace.getWorkspaceFolder(...)
```

for finding the correct workspace.

```ts
vscode.workspace.fs.createDirectory(...)
```

for creating the configured destination.

```ts
vscode.workspace.fs.writeFile(...)
```

for saving clipboard image bytes.

Prefer VS Code's workspace filesystem APIs where they satisfy the required guarantees. A bare `workspace.fs.writeFile` after an existence check is not sufficient for no-clobber creation. For the local-desktop MVP, use appropriate local filesystem operations when needed for exclusive creation and symlink/junction validation.

### Pre-implementation Compatibility Gate

Choose and document a minimum stable VS Code version and a matching `engines.vscode` constraint after verifying the required APIs. Before committing to the implementation approach, test:

- OS clipboard PNG/JPEG/WebP access on the supported desktop platforms;
- ordinary Cmd+V / Ctrl+V precedence with built-in Markdown image paste enabled;
- cancellation and mixed image/text clipboard fallback;
- selection of alternative paste edits without unwanted prompts or file writes;
- a lifecycle that prompts and commits only for the selected operation, supports no-clobber creation, and handles cancellation/insertion failure as specified;
- multiple paste ranges and Undo behavior.

Investigate deferred paste-edit resolution and additional edits, but do not assume they provide transactional file creation, cancellation, or insertion-failure notification. Establish the actual lifecycle and guarantees experimentally. If the public APIs cannot meet a requirement, record the blocker and obtain approval for a revised behavior instead of silently weakening the specification.

Record compatibility results before approving an implementation approach. For each requirement below, record a status of **verified**, **blocked**, or **revised with approval**, the tested stable VS Code version, operating system, reproduction steps, observed result, and supporting evidence. A revised requirement must also identify the approved replacement behavior and approval; an untested requirement is blocked, not verified.

| Required compatibility check | Evidence required |
| --- | --- |
| Ordinary paste precedence | Cmd+V / Ctrl+V selects this extension with built-in Markdown image paste enabled. |
| Selected-edit-only lifecycle | Merely offering an edit causes neither a filename prompt nor directory/file creation; selecting it permits the required prompt and commit. |
| Clipboard representations | PNG, JPEG, and WebP access; alternative representations versus genuinely multiple images; mixed image/text input. |
| Cancellation and fallback | Cancelling before commit produces no image write and leaves normal fallback available. |
| Save and insertion outcome | Complete save precedes link insertion; insertion failure after saving can be detected and reported with the saved path. |
| Multiple ranges and Undo | One prompt and image serve all ranges; selections are replaced; Undo retains the image. |

Keep implementation planning conditional on these results. A blocked requirement prevents approval of the affected implementation approach until the requirement is verified or replacement behavior is explicitly approved. Results on one operating system do not establish support on another; record platform-specific blocked checks and the manual checks still needed.

Initial verification will use current stable desktop VS Code on macOS. The user will perform manual desktop and real-clipboard checks in a dedicated test workspace and isolated VS Code profile, with the built-in Markdown image provider enabled and unrelated extensions disabled. Record the actual macOS and VS Code versions with the results. Windows and Linux remain intended v1 platforms but unverified until their checks are performed; macOS results alone do not satisfy cross-platform release readiness. No live compatibility check has yet been recorded as verified.

---

## 18. `package.json` Contributions

The extension should contribute a configuration property similar to:

```json
{
  "contributes": {
    "configuration": {
      "title": "Markdown Image Paste",
      "properties": {
        "markdownImagePaste.destination": {
          "type": "string",
          "scope": "resource",
          "default": "qa/screenshots",
          "description": "Workspace-relative destination folder for images pasted into Markdown files."
        }
      }
    }
  }
}
```

It should also register the required destination command:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "markdownImagePaste.setDestination",
        "title": "Markdown Images: Set Destination Folder"
      }
    ]
  }
}
```

---

## 19. Activation

The extension only needs to activate for relevant Markdown usage.

The provider should target local Markdown documents, with a runtime check for saved `.md` files inside a workspace:

```ts
{
  language: "markdown",
  scheme: "file"
}
```

The extension should avoid intercepting image pastes in:

- JavaScript;
- TypeScript;
- JSON;
- text files;
- terminals;
- other editors.

Declare activation appropriate to Markdown documents and the destination command for the chosen minimum VS Code version. Language-based activation does not remove the runtime `.md`, workspace, and local-file checks.

---

## 20. Expected User Experience

Typical setup:

### Step 1

Install the extension.

### Step 2

Set:

```json
{
  "markdownImagePaste.destination": "qa/screenshots"
}
```

or run:

```text
Markdown Images: Set Destination Folder
```

### Step 3

Copy a screenshot.

### Step 4

Open a saved local `.md` file in Markdown language mode inside the workspace.

### Step 5

Press:

```text
Cmd+V
```

on macOS or:

```text
Ctrl+V
```

on Windows/Linux.

### Step 6

Prompt appears:

```text
Image filename (without extension):
```

User enters:

```text
checkout-validation-error
```

### Step 7

Extension creates:

```text
qa/screenshots/checkout-validation-error.png
```

### Step 8

Extension inserts:

```md
![](../qa/screenshots/checkout-validation-error.png)
```

---

## 21. Error Handling

The extension should provide clear messages for common failures.

### Destination not configured

Use the default:

```text
qa/screenshots
```

when the setting is absent. An explicitly invalid destination must show a validation error and permit normal paste fallback without writing an image.

### Invalid filename

Show:

```text
Please enter a valid filename without path separators.
```

Provide a specific inline reason when possible and keep the filename prompt open for correction.

### No workspace

Show:

```text
The current Markdown file must belong to a workspace before pasted images can be saved.
```

### File write failure

Show:

```text
Unable to save pasted image.
```

Include the underlying error in developer logs where useful.

Do not insert this extension's Markdown link if the image cannot be saved. Allow normal paste fallback when declining the operation. If a file was created before a later failure, do not delete it automatically; report its path.

An image counts as saved only after all image bytes have been written and the file operation has completed successfully. A failure after file creation may leave an empty or truncated artifact. Retain that artifact, explicitly identify it as incomplete in the notification, and include its actual path. Never describe it as a successfully saved image or insert a link to it.

### Image saved but link not inserted

Keep the saved image and show a message explaining that the Markdown link was not inserted, including the image's actual path. Never report the operation as fully successful.

### Unsupported input or environment

Decline unsupported image formats, genuinely multiple-image inputs, non-`.md` documents, remote/virtual documents, and untitled documents. Leave normal paste behavior available and create no directories or image files.

### User cancels filename prompt

Abandon this extension's paste edit without saving an image. Allow normal VS Code paste fallback; another provider or clipboard text may still modify the Markdown document.

---

## 22. Security and Path Safety

All generated image paths must resolve inside the document's workspace folder when validated. The v1 security guarantee is subject to the concurrent directory-replacement limitation below.

The extension must reject filename or destination values that resolve outside the workspace.

For example:

```text
../../../Desktop/image.png
```

must never be allowed.

Resolve and normalize paths before writing files.

Resolve the workspace root itself to its actual filesystem location. Reject symlinks or junctions along the destination route below that root, including existing destination directory components. Reject candidates that would escape the resolved root; use component-aware containment checks, not a string-prefix test.

Apply safety validation both in the destination command and immediately before directory/file creation. Treat existing symlinks at candidate image paths as collisions, never follow them for writing. Use no-clobber creation to protect against concurrent filename collisions.

### V1 Security Boundary: Concurrent Directory Replacement

A symbolic link (symlink) is a filesystem entry that points to another file or directory; a Windows junction provides similar directory redirection. The extension saves directly into the configured workspace directory and does not create these links. It must reject destination routes containing symlinks or junctions detected during validation.

V1 does not guarantee protection against another process deliberately replacing a destination directory or one of its parent directories after validation but before or during creation or writing. For example, replacing `qa/screenshots` with a symlink pointing outside the workspace in that interval could redirect the write outside the workspace. Revalidation reduces this risk but does not eliminate the timing gap.

Preventing hostile concurrent directory replacement is outside the v1 threat model. Document this limitation in user-facing security documentation; do not claim race-proof workspace containment. This exception does not permit knowingly accepting escaping paths or symlink/junction destination routes, and does not weaken exclusive/no-clobber creation or protection against ordinary concurrent filename collisions.

---

## 23. MVP Acceptance Criteria

The first release is complete when all of the following work:

- [ ] Ordinary Cmd+V / Ctrl+V into an eligible document selects this extension's supported image handling with built-in Markdown image paste enabled.
- [ ] A saved local `.md` file in Markdown language mode inside a workspace is eligible; other document types and unsupported environments are not handled.
- [ ] Single PNG, JPEG, and WebP images are saved with their MIME-derived extensions without conversion.
- [ ] Alternative representations of one image prefer PNG, then JPEG, then WebP; genuinely multiple-image and unsupported-format inputs allow normal fallback.
- [ ] Normal text paste is unaffected.
- [ ] User is prompted for a custom filename.
- [ ] Every entered stem receives the generated extension: PNG + `photo` gives `photo.png`, PNG + `photo.jpg` gives `photo.jpg.png`, and PNG + `photo.png` gives `photo.png.png`.
- [ ] Image is saved under the configured workspace-relative directory.
- [ ] Missing destination directories are automatically created.
- [ ] Collisions automatically use the smallest available positive integer suffix before the generated extension, and the link uses the actual committed name.
- [ ] Concurrent collision attempts cannot overwrite existing files or other filesystem entries.
- [ ] Correct relative Markdown link is inserted.
- [ ] Nested Markdown files produce correct relative paths.
- [ ] Links containing spaces, `#`, `%`, parentheses, and Unicode characters resolve correctly without double encoding.
- [ ] Multi-root workspaces use the correct workspace.
- [ ] Folder-specific configuration is respected; the destination command updates the selected folder's setting and cancellation leaves settings unchanged.
- [ ] An absent destination setting uses `qa/screenshots`; invalid explicit destinations are rejected.
- [ ] Invalid/path-traversal filenames are rejected.
- [ ] Invalid stems produce inline explanations without silent character replacement; surrounding whitespace is trimmed.
- [ ] Filename-component and full-path limits are checked for every generated candidate, including collision suffixes; over-limit names offer correction before saving without silent truncation, or fail clearly without a link if correction is unavailable after saving begins.
- [ ] Absolute, escaping, and symlink/junction destination routes below the resolved workspace root are rejected before writing.
- [ ] Path safety is revalidated immediately before directory/file creation; user-facing security documentation explains that hostile concurrent replacement of destination or parent directories is outside the v1 guarantee, without weakening no-clobber collision handling.
- [ ] Cancelling the filename prompt produces no image write from this extension and allows normal fallback, including mixed image/text clipboard content.
- [ ] Unselected paste edits create no directories or image files.
- [ ] If the original document changes, closes, or moves during the filename prompt, this extension abandons the operation, explains the invalidation, and does not save an image or apply stale ranges; any image already saved before detection is retained and its path reported.
- [ ] Changing the destination setting during the filename prompt does not redirect the current paste; the captured destination is revalidated and the new setting applies to subsequent pastes.
- [ ] Multiple paste ranges prompt once, save one image, and receive the same link, replacing selections normally.
- [ ] Undo removes the inserted link(s) but retains the image.
- [ ] Write failures insert no link from this extension and report a clear error.
- [ ] Empty or truncated artifacts from failed writes are retained, reported as incomplete with their actual path, and never treated as successfully saved images.
- [ ] If an image is saved but link insertion fails, the image is retained and a notification includes its path.
- [ ] Read-only documents/destinations are handled without false success reports.
- [ ] The minimum VS Code version and compatibility-gate results are documented, including any blocked requirements.
- [ ] Non-Markdown editors are unaffected.

---

## 24. Future Enhancements

Possible later additions:

- remember the previous filename prefix;
- automatic sequential naming;
- default filename from current Markdown heading;
- filename from selected text;
- slugify filenames automatically;
- image resizing;
- image compression;
- WebP conversion;
- configurable Markdown syntax;
- optional alt-text prompt;
- drag-and-drop support;
- destination folder picker instead of text input;
- reveal saved image in Explorer;
- automatically organize images by document name;
- automatically organize screenshots by date.

Example future structure:

```text
qa/screenshots/
└── testing/
    ├── login-error.png
    ├── checkout-validation.png
    └── payment-failed.png
```

---

## 25. Final MVP Definition

The extension should solve one focused problem:

> When a single supported image is pasted into a saved local `.md` document in Markdown language mode inside a workspace, prompt for a filename stem, append the format's extension, save without overwriting to that workspace folder's configured destination, and insert the correct encoded relative Markdown reference at every paste range.

Default destination:

```text
qa/screenshots
```

Expected interaction:

```text
Cmd+V
→ Enter filename stem (without extension)
→ Image saved under a unique name
→ Markdown link inserted
```

Cancellation permits normal paste fallback. Undo retains the image. The destination-setting command is included; no sidebar, webview, or image-editing UI is required for the first version. Automatic paste handling remains subject to the compatibility gate in section 17.
