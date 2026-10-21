# Markdown 0.4.4 verification

Scope: issue tracker rows 46 and 57 for Markdown, plus the two existing Doca
0.4.3 host patches. All browser documents and sessions are synthetic and isolated.
No Doca source, user document, database or account data is modified.

The editor and standalone MarkdownPreview now expose optional onImagePreview.
The event carries the current item, ordered same-preview media collection and
index. Resource paths remain host-owned identities; resolved URLs and generated
SVGs are temporary view state. Default preview supports pan, zoom and gallery
navigation. See ../../IMAGE_PREVIEW.md for the published type and identity rules.

The release also retains generated KaTeX positioning styles after sanitization,
and loads PDF conversion dependencies only on an explicit PDF operation. Root
exports, errors and function signatures remain available. No schema, protocol,
codec, historical reader, format default or data conversion is introduced.

Verification commands:

```sh
yarn build:lib
yarn typecheck
yarn build:demo
node --experimental-strip-types --test tests/i18n.test.mjs
node --test tests/contract.test.mjs tests/idle.test.mjs tests/markdown-file.test.mjs tests/pdf-file.test.mjs tests/scroll-sync.test.mjs tests/pdf-lazy.test.mjs
npm pack --ignore-scripts --pack-destination /tmp
```

For browser acceptance, start Vite on a loopback port. Without
EXMD_TEST_PACKAGE_DIR the fixture imports src/lib/index.ts. Set that variable to
an unpacked tarball's package directory to import dist/index.js instead. Keep a
node_modules directory resolvable from that unpacked directory.

```sh
EXMD_CHROME_EXECUTABLE=/path/to/chrome \
EXMD_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
node tests/browser/verify-images.mjs http://127.0.0.1:5198 source
```

The automation runs the image, editor/session, precise preview-comment and
end-of-document suites, followed by real browser mouse drags at initial and
increased zoom, native touch swiping and KaTeX/sanitization checks. JSON logs
record zero preview content writes, stable editor instances, no SDK-created
transport/storage and no eager PDF requests. Screenshots show the dragged image,
Mermaid preview and positioned math. These desktop browser checks do not claim
physical-device or production Doca asset-service acceptance.

The host integration is a separate handoff: upgrade the exact published package,
forward onImagePreview through custom Preview wrappers, retain current asset ACL
and history/trash access flags, and update the shared integration/skill records.

Results: 36/36 final Node tests (including the 60-second idle check), 3/3
i18n tests, and 35/35 packed Node tests passed. Source and packed browser runs
both passed all four suites plus native mouse/touch and math checks, with zero
page errors and no eager PDF requests. Typecheck, library/demo builds and diff
checks passed. The PDF implementation body is byte-identical after extraction.
