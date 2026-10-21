# Image preview contract

Available from `@smartdoca/markdown` 0.4.4. The package root exports the types
`MarkdownImagePreviewEvent` and `MarkdownPreviewImage`. Both
`CollaborativeMarkdownEditorProps` and `MarkdownPreviewProps` provide:

```ts
onImagePreview?: (event: MarkdownImagePreviewEvent) => void
```

When supplied, the callback completely owns preview. Otherwise the package opens
its built-in gallery. A custom `components.Preview` must forward the prop to
`MarkdownPreview` to retain this behavior, as it forwards `interaction` for comments.

```tsx
const onImagePreview = (event: MarkdownImagePreviewEvent) => {
  // The host already knows the document ID and its current access flags.
  // Authorize image.path through the host asset service; do not persist image.src.
  openHostGallery(event.images, event.index)
}
```

`event.image === event.images[event.index]`. `images` is a snapshot of the current
preview in document order: ordinary Markdown images, reference images, sanitized
HTML images, repeated resource occurrences, and successfully rendered Mermaid
diagrams. It is scoped to one `MarkdownPreview`; it never queries other documents
or the host's asset directory. Unresolved images remain in the collection with
their original `path` and an absent `src`. Diagrams without a rendered SVG cannot
be previewed and are omitted.

Each item contains:

| Field | Meaning |
| --- | --- |
| `id` | Deterministic kind/source identity plus occurrence number. Stable through signed-URL refreshes and unrelated text edits. Duplicate insertion/reordering can change occurrence identity; this is not a persistent comment anchor. |
| `kind` | `image` or `mermaid`. |
| `path?` | For images, the original renderer resource path, before `resolveImageUrl` / `resources.resolveUrl`. It is the host-owned resource identity. |
| `src?` | Current resolved display URL for images; generated SVG data URL for diagrams. Transient view state, never a durable resource identifier or authorization grant. |
| `alt` / `title?` | Document-provided display text; diagram alt text uses the UI catalog. |
| `source?` | UTF-16 `from` / `to` offsets in the displayed Markdown snapshot, when the parser supplies them. Offsets are not permanent anchors and can lag current editing while preview debounce is active. |
| `width?` / `height?` | Known natural image dimensions or SVG view-box dimensions. |

The callback is synchronous and its return value is ignored. Hosts may launch
their own async URL resolution inside it. The latest callback is used on each
activation. Linked images prevent link navigation when preview opens. Enter and
Space activate focused images and diagrams; readonly mode uses the same callback.

The built-in gallery supports pointer drag at every zoom, wheel/button zoom,
previous/next buttons, arrow keys, initial-zoom touch swipes, reset, Escape,
focus containment/restoration, and restoring the body's previous scroll state.
Changing displayed Markdown, the resolver, or preview ownership closes its
snapshot. Preview does not upload/download resources, create a transport, write
Markdown/Yjs, replace the editor, or change undo history.

While the built-in gallery is open, pending image URL resolutions refresh the
existing snapshot items in place. They do not change the active occurrence or
write to the document. A pending Mermaid rerender cannot expose the preceding
diagram SVG under a new source identity.

This optional UI boundary introduces no codec, schema, migration, legacy reader,
format default, or stored-data conversion. Host ACLs and existing resource access
flags must still be enforced when opening a gallery or resolving another item.
