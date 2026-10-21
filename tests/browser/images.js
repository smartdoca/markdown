const imageSelector = '.markdown-body img[data-exmd-preview-kind="image"]'
const dialogSelector = '.exmd-image-lightbox[role="dialog"]'

export async function runImageSuite({ client, pause, assert, until, log }) {
  const source = '# Gallery\n\n![First](asset-main "Original title")\n\n![Reference][ref]\n\n<img src="asset-html" alt="HTML" title="HTML title" />\n\n[![Linked](asset-linked)](https://example.test/linked-image)\n\n![Again](asset-main)\n\n```mermaid\ngraph TD\n  A[Start] --> B[Finish]\n```\n\n[ref]: asset-ref "Reference title"\n'
  const a = await client('preview')
  a.api.imageHost(true, 'first')
  await a.api.bootstrap(source)
  const images = () => [...a.dom.querySelectorAll(imageSelector)]
  const diagram = () => a.dom.querySelector('.markdown-body [data-exmd-preview-kind="mermaid"]')
  await until(() => a.api.view() && images().length === 5 && images().every(image => image.complete && image.naturalWidth) && diagram()?.querySelector('svg'), 'gallery images or Mermaid did not render')
  a.api.remember()
  const baseline = a.api.count()
  const click = (element, options = {}) => element.dispatchEvent(new a.dom.defaultView.MouseEvent('click', { bubbles: true, cancelable: true, ...options }))
  const last = () => a.api.imageEvents().at(-1)
  const noWrites = (before = baseline) => {
    assert(a.api.count().pending === before.pending && a.api.count().changes === before.changes, 'image preview emitted a content update')
    assert(a.api.stable(), 'image preview rebuilt the editor or handle')
  }
  click(images()[0])
  const original = last().event
  assert(last().callback === 'first' && original.index === 0 && original.image === original.images[0], 'host callback did not receive the selected gallery entry')
  assert(!a.dom.querySelector(dialogSelector), 'host callback also opened the built-in preview')
  assert(original.images.length === 6, 'gallery did not include five image occurrences and one Mermaid diagram')
  assert(JSON.stringify(original.images.map(image => image.kind)) === JSON.stringify(['image', 'image', 'image', 'image', 'image', 'mermaid']), 'gallery order or kinds are incorrect')
  assert(JSON.stringify(original.images.slice(0, 5).map(image => image.path)) === JSON.stringify(['asset-main', 'asset-ref', 'asset-html', 'asset-linked', 'asset-main']), 'original image paths were replaced by resolved URLs')
  assert(original.image.alt === 'First' && original.image.title === 'Original title' && original.images[1].title === 'Reference title' && original.images[2].title === 'HTML title', 'image alt/title metadata was lost')
  assert(original.image.src.startsWith('data:image/svg+xml,') && original.image.width === 1800 && original.image.height === 1200, 'resolved image URL or natural dimensions missing')
  assert(original.images[5].src.startsWith('data:image/svg+xml') && original.images[5].width > 0, 'Mermaid generated preview is missing')
  assert(new Set(original.images.map(image => image.id)).size === 6 && original.images[0].id !== original.images[4].id, 'duplicate image occurrences do not have distinct identities')
  const start = source.indexOf('![First]')
  assert(original.image.source?.from === start && original.image.source.to === start + '![First](asset-main "Original title")'.length, 'source UTF-16 offsets do not point to the original image')
  for (const image of original.images) assert(!image.source || Number.isInteger(image.source.from) && image.source.to > image.source.from && image.source.to <= source.length, 'invalid source metadata')
  assert(click(images()[3]) === false && last().event.index === 3, 'linked image preview did not prevent link navigation')
  click(diagram())
  assert(last().event.image.kind === 'mermaid' && last().event.index === 5, 'Mermaid preview did not enter the shared host gallery')
  noWrites()
  log('PASS host gallery: Markdown/reference/HTML/linked/duplicate images and Mermaid; original paths, titles, dimensions, source offsets and distinct IDs')

  a.api.imageResolution('normal')
  await until(() => images()[0]?.getAttribute('src') && images()[0].getAttribute('src') !== original.image.src, 'refreshed image URL did not render')
  click(images()[0])
  assert(JSON.stringify(last().event.images.map(image => image.id)) === JSON.stringify(original.images.map(image => image.id)), 'URL refresh changed gallery identities')
  a.api.imageHost(true, 'latest')
  a.api.readonly(true)
  await pause(70)
  click(images()[1])
  assert(last().callback === 'latest' && last().event.index === 1 && !a.dom.querySelector(dialogSelector), 'readonly image click did not use the latest host callback')
  images()[0].focus()
  images()[0].dispatchEvent(new a.dom.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  assert(last().callback === 'latest' && last().event.index === 0, 'keyboard image activation did not call the host')
  noWrites()
  log('PASS latest host callback, readonly and keyboard activation, URL refresh with stable identities, zero content writes and stable editor')

  a.api.readonly(false)
  await pause(50)
  const prefix = 'Unrelated text before the gallery.\n\n'
  assert(a.api.replaceSource(prefix + source), 'could not prepare the unrelated prefix edit')
  await until(() => a.dom.querySelector('.markdown-body')?.textContent.includes('Unrelated text'), 'prefix did not render')
  await until(() => diagram()?.querySelector('svg'), 'Mermaid did not render after the prefix edit')
  const afterEdit = a.api.count()
  click(images()[0])
  assert(JSON.stringify(last().event.images.map(image => image.id)) === JSON.stringify(original.images.map(image => image.id)), 'unrelated text edit changed gallery identities')
  assert(last().event.image.source.from === original.image.source.from + prefix.length, 'source offset did not follow the displayed source snapshot')
  assert(a.api.source() === source && a.api.text() === prefix + source, 'fixture original source or edited source was changed by preview')
  noWrites(afterEdit)
  log('PASS unrelated text edit preserves image identities and updates source offsets; preview adds no writes')

  a.api.imageHost(false)
  a.api.readonly(true)
  await pause(70)
  const beforeLightbox = a.api.count()
  const overflow = a.dom.body.style.overflow
  images()[0].focus()
  click(images()[0])
  await until(() => a.dom.querySelector(dialogSelector), 'built-in image preview did not open')
  const dialog = () => a.dom.querySelector(dialogSelector)
  const counter = () => dialog().querySelector('.exmd-image-lightbox-counter').textContent
  const previewImage = () => dialog().querySelector('.exmd-image-lightbox-image')
  const key = value => a.dom.dispatchEvent(new a.dom.defaultView.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  assert(counter() === '1 / 6' && dialog().querySelector('.exmd-image-lightbox-previous').disabled, 'initial gallery index or first-item boundary is incorrect')
  assert(a.dom.activeElement === dialog() && a.dom.body.style.overflow === 'hidden', 'preview did not contain focus and lock background scrolling')
  dialog().querySelector('.exmd-image-lightbox-next').click()
  await pause(40)
  assert(counter() === '2 / 6' && previewImage().alt === 'Reference', 'next-image button did not advance')
  key('ArrowLeft'); await pause(40)
  assert(counter() === '1 / 6', 'left arrow did not return to the previous image')
  dialog().querySelector('button[title="放大"]').click(); await pause(40)
  assert(dialog().querySelector('.exmd-image-lightbox-scale').textContent === '125%', 'zoom-in control did not update the view')
  const stage = dialog().querySelector('.exmd-image-lightbox-stage')
  const wheel = new a.dom.defaultView.WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true })
  stage.dispatchEvent(wheel); await pause(40)
  assert(wheel.defaultPrevented && parseInt(dialog().querySelector('.exmd-image-lightbox-scale').textContent) > 125, 'wheel did not zoom or prevent background scrolling')

  // Synthetic events do not create a browser-owned active pointer. Retain and
  // verify the capture contract while exercising the real React pan handlers.
  const nativeCapture = stage.setPointerCapture, nativeHasCapture = stage.hasPointerCapture, nativeRelease = stage.releasePointerCapture
  let captured
  stage.setPointerCapture = id => { captured = id }
  stage.hasPointerCapture = id => captured === id
  stage.releasePointerCapture = id => { if (captured === id) captured = undefined }
  const pointer = (target, type, x, y) => target.dispatchEvent(new a.dom.defaultView.PointerEvent(type, {
    bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 41, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y,
  }))
  try {
    pointer(previewImage(), 'pointerdown', 100, 100)
    pointer(stage, 'pointermove', 173, 142)
    pointer(stage, 'pointerup', 173, 142)
    await pause(40)
    assert(previewImage().style.transform.includes('translate(73px, 42px)') && captured === undefined, 'drag did not pan the large image or release capture')
    assert(dialog(), 'drag unexpectedly closed the image preview')
  } finally {
    stage.setPointerCapture = nativeCapture; stage.hasPointerCapture = nativeHasCapture; stage.releasePointerCapture = nativeRelease
  }
  dialog().querySelector('button[title="重置缩放和位置"]').click(); await pause(40)
  assert(previewImage().style.transform === 'translate(0px, 0px) scale(1)', 'reset did not restore image position and scale')
  for (let n = 0; n < 5; n++) { key('ArrowRight'); await pause(30) }
  assert(counter() === '6 / 6' && dialog().querySelector('.exmd-image-lightbox-next').disabled && previewImage().src.startsWith('data:image/svg+xml'), 'Mermaid or last-image boundary is incorrect')
  key('Escape'); await pause(50)
  assert(!dialog() && a.dom.body.style.overflow === overflow && a.dom.activeElement === images()[0], 'closing did not restore focus and background scrolling')
  noWrites(beforeLightbox)
  log('PASS readonly built-in gallery: next/previous buttons and keys, zoom/wheel, synthetic pointer pan, reset, Mermaid, Escape/focus/scroll cleanup; zero writes')

  for (const mode of ['throw', 'reject']) {
    a.api.imageResolution(mode)
    await pause(50)
    await until(() => a.api.imageResolutions().at(-1)?.mode === mode && images().length === 5 && images().every(image => !image.getAttribute('src')) && diagram()?.querySelector('svg'), 'failed resolver retained stale image URLs or did not commit: ' + mode)
    click(images()[0]); await pause(40)
    assert(dialog()?.querySelector('.exmd-image-lightbox-unavailable'), 'failed image did not show an unavailable state: ' + mode)
    dialog().querySelector('.exmd-image-lightbox-next').click(); await pause(30)
    assert(counter() === '2 / 6', 'failed image blocked gallery navigation: ' + mode)
    key('Escape'); await pause(30)
  }
  a.api.imageResolution('late')
  await pause(50)
  await until(() => a.api.pendingImageResolutions() >= 5 && images().every(image => !image.getAttribute('src')) && diagram()?.querySelector('svg'), 'late image resolutions did not start')
  click(images()[1]); await pause(40)
  const pendingDialog = dialog()
  assert(pendingDialog?.querySelector('.exmd-image-lightbox-unavailable') && counter() === '2 / 6', 'pending image did not open at the selected gallery position')
  a.api.resolveImages()
  await until(() => dialog() === pendingDialog && previewImage()?.getAttribute('src') && previewImage().complete && previewImage().naturalWidth, 'open gallery did not refresh when the image resolver completed')
  assert(counter() === '2 / 6' && previewImage().alt === 'Reference', 'resolver completion changed the selected gallery index')
  key('Escape'); await pause(40)
  assert(!dialog(), 'resolved image preview did not close')
  noWrites(beforeLightbox)
  log('PASS pending image resolves inside the same open gallery without changing the selected index or writing content')

  a.api.imageResolution('late')
  await pause(50)
  await until(() => a.api.pendingImageResolutions() >= 5 && images().every(image => !image.getAttribute('src')), 'second late image resolutions did not start')
  a.api.imageResolution('normal')
  await until(() => images().every(image => image.getAttribute('src')), 'replacement resolver did not render')
  const latestUrls = images().map(image => image.getAttribute('src'))
  a.api.resolveImages(); await pause(70)
  assert(JSON.stringify(images().map(image => image.getAttribute('src'))) === JSON.stringify(latestUrls), 'late resolver replaced newer authorized display URLs')
  noWrites(beforeLightbox)
  log('PASS synchronous/asynchronous URL resolution failures, unavailable-state navigation and ignored late resolver results; zero writes and stable editor')

  a.api.readonly(false)
  a.api.imageHost(true, 'mermaid-current')
  await pause(60)
  await until(() => diagram()?.querySelector('svg')?.textContent.includes('Start'), 'original Mermaid label did not render before the identity test')
  let observedNewCode = false
  let staleDiagram = false
  const observeIdentity = () => {
    const current = diagram()
    if (!current?.dataset.exmdPreviewKey.includes('NewLabel')) return
    observedNewCode = true
    const svg = current.querySelector('svg')
    if (svg && !svg.textContent.includes('NewLabel')) staleDiagram = true
  }
  const identityObserver = new a.dom.defaultView.MutationObserver(observeIdentity)
  identityObserver.observe(a.dom.querySelector('.markdown-body'), {
    childList: true, subtree: true, attributes: true, attributeFilter: ['data-exmd-preview-key'],
  })
  try {
    const nextSource = a.api.text().replace('A[Start]', 'A[NewLabel]')
    assert(nextSource !== a.api.text() && a.api.replaceSource(nextSource), 'could not prepare the explicit Mermaid label edit')
    await until(() => diagram()?.dataset.exmdPreviewKey.includes('NewLabel') && diagram()?.querySelector('svg')?.textContent.includes('NewLabel'), 'updated Mermaid label did not render')
    assert(observedNewCode && !staleDiagram, 'new Mermaid source identity was displayed with the previous SVG')
    const afterMermaidEdit = a.api.count()
    click(diagram())
    const current = last()
    const svgSource = decodeURIComponent(current.event.image.src.split(',').slice(1).join(','))
    const svgText = new a.dom.defaultView.DOMParser().parseFromString(svgSource, 'image/svg+xml').documentElement.textContent
    assert(current.callback === 'mermaid-current' && current.event.image.kind === 'mermaid' && svgText.includes('NewLabel') && !svgText.includes('Start'), 'host callback received an SVG from the previous Mermaid source')
    noWrites(afterMermaidEdit)
  } finally {
    identityObserver.disconnect()
  }
  log('PASS Mermaid source identity never exposes the previous SVG; host callback receives the current generated diagram without preview writes or editor replacement')
}
