const results = document.getElementById('results')
import { runPreviewSuite, selectRenderedText } from './preview.js'
import { runFileSuite } from './files.js'
import { runPerformanceSuite } from './performance.js'
const clients = document.getElementById('clients')
let frames = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function assert(value, message) { if (!value) throw new Error(message) }
async function until(predicate, message) {
  for (let n = 0; n < 100; n++) { if (predicate()) return; await pause(30) }
  throw new Error(message)
}
function log(message) { results.textContent += message + '\n' }
async function client(view = 'split') {
  const frame = document.createElement('iframe')
  frame.src = './client.html?view=' + view; frame.style = 'width:50%;height:560px;border:1px solid #ddd'
  clients.appendChild(frame); frames.push(frame)
  await until(() => frame.contentWindow?.fixture, 'client did not load')
  return { api: frame.contentWindow.fixture, dom: frame.contentDocument }
}
function button(client, title) { client.dom.querySelector('button[title="' + title + '"]').click() }
function sync(a, b) { for (const bytes of a.api.takeUpdates()) b.api.apply(bytes) }
function same(a, b) {
  assert(a.api.text() === b.api.text(), 'replicas diverged ' + JSON.stringify({ a: a.api.trace().slice(-2), b: b.api.trace().slice(-2) }))
  for (const item of [a, b]) {
    assert(item.api.editor().getMarkdown() === item.api.text(), 'handle disagrees with model')
    assert(item.api.view().state.doc.toString() === item.api.text(), 'CodeMirror disagrees with Y.Text')
  }
}
async function reset() {
  for (const frame of frames) frame.contentWindow?.fixture?.dispose()
  frames = []; clients.replaceChildren(); results.textContent = ''
}
document.getElementById('visual').onclick = async () => {
  await reset()
  const a = await client()
  frames[0].style.width = '100%'
  await a.api.bootstrap('Alpha **Bravo** Charlie\n\n同一段文字可以同时拥有多条评论。\n\n在预览区选中 Bravo，点击“评”验证五字符锚点。')
  await until(() => a.api.view(), 'editor not ready')
  a.api.watch()
  const comment = a.api.comment('comment-demo', 8, 13)
  a.api.editor().renderAnchors([comment, a.api.comment('comment-overlap', 10, 13)])
  a.api.editor().renderRemoteSelections([
    a.api.remote(4, 4, 'tab-remote', '小明 · 页面一'),
    a.api.remote(31, 48, 'second', '小明 · 页面二'),
  ])
  a.api.editor().onAnchorClick(id => log('区域 → 宿主评论卡片：' + id))
  log('公开 renderRemoteSelections / renderAnchors 示例；点击下划线激活评论。')
}
document.getElementById('end-tests').onclick = async () => {
  await reset()
  try {
    for (const text of ['', '最后一行文字', '第一行\n最后一行', '末尾有换行\n', '自动折行文字 '.repeat(25)]) {
      const a = await client('edit')
      await a.api.bootstrap(text)
      await until(() => a.api.view(), 'editor not ready')
      await pause(100)
      a.api.remember(); a.api.takeUpdates()
      const before = a.api.count().changes
      const view = a.api.view(), pane = a.dom.querySelector('.editor-pane')
      const clickBlank = (options = {}, lowerBlank = false) => {
        const last = view.coordsAtPos(view.state.doc.length)
        const rect = pane.getBoundingClientRect()
        const x = rect.left + rect.width / 2, y = lowerBlank ? rect.bottom - 24 : last.bottom + 24
        const target = a.dom.elementFromPoint(x, y)
        assert(target && pane.contains(target), 'blank test point is outside pane')
        return target.dispatchEvent(new a.dom.defaultView.MouseEvent('mousedown', {
          bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...options,
        }))
      }
      for (const readonly of [false, true]) {
        a.api.readonly(readonly); await pause(50)
        a.api.select(0); view.contentDOM.blur()
        assert(!clickBlank(), 'blank click was not handled')
        assert(view.state.selection.main.empty && view.state.selection.main.head === text.length, 'caret not at document end')
        if (!readonly) assert(view.hasFocus, 'editable view not focused')
        a.api.select(0); view.contentDOM.blur()
        assert(!clickBlank({}, true), 'lower pane blank click was not handled')
        assert(view.state.selection.main.empty && view.state.selection.main.head === text.length, 'lower blank did not move caret to end')
        assert(a.api.text() === text && a.api.count().pending === 0 && a.api.count().changes === before, 'blank click wrote content')
      }
      a.api.readonly(false); await pause(50)
      a.api.select(0)
      assert(clickBlank({ button: 2 }), 'right click was intercepted')
      assert(view.state.selection.main.head === 0, 'right click moved selection')
      const label = pane.querySelector('.pane-label')
      label.dispatchEvent(new a.dom.defaultView.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      assert(view.state.selection.main.head === 0, 'header click moved selection')
      assert(a.api.stable(), 'click rebuilt editor')
      clickBlank()
      a.api.insert('追加')
      assert(a.api.text() === text + '追加', 'typing did not append')
      log('PASS blank click: ' + JSON.stringify(text.slice(0, 18)) + ' / readonly / no content writes / append')
      a.api.dispose(); frames.forEach(f => f.remove()); frames = []
    }
    log('PASS all document-end click cases')
  } catch (error) { log('FAIL ' + error.stack) }
}
document.getElementById('file-tests').onclick = async () => {
  await reset()
  try { await runFileSuite({ client, assert, pause, until, sync, same, log }) }
  catch (error) { log('FAIL ' + error.stack) }
}
document.getElementById('performance-tests').onclick = async () => {
  await reset()
  try { await runPerformanceSuite({ client, assert, pause, until, sync, same, log }) }
  catch (error) { log('FAIL ' + error.stack) }
}
document.getElementById('run').onclick = async () => {
  await reset()
  try {
    for (const baseline of ['', '# existing\nHello world']) {
      const a = await client(), b = await client()
      assert(a.api.text() === '' && !a.api.view() && a.api.count().pending === 0, 'host initialValue was applied')
      await a.api.bootstrap(baseline)
      await b.api.load(a.api.checkpoint())
      await until(() => a.api.view() && b.api.view(), 'editors not ready')
      a.api.remember(); b.api.remember()
      a.api.select(a.api.text().length); a.api.insert('\n# Markdown test\nHello world')
      sync(a, b); same(a, b)
      a.api.takeUpdates(); b.api.takeUpdates()
      for (let n = 0; n < 4; n++) {
        button(a, '仅预览'); await pause(60)
        assert(a.dom.querySelector('.editor-pane').hidden, 'preview did not hide the editor')
        button(a, n % 2 ? '仅编辑' : '分栏'); await pause(60)
        same(a, b)
        assert(a.api.stable(), 'preview toggling rebuilt the editor or handle')
      }
      assert(a.api.count().pending === 0 && b.api.count().pending === 0, 'mode switch emitted a write')
      button(a, '仅预览'); await pause(60)
      b.api.select(0); b.api.insert('REMOTE ')
      sync(b, a)
      a.api.status('disconnected'); a.api.readonly(true); await pause(60)
      same(a, b)
      a.api.status('ready'); a.api.readonly(false)
      button(a, '分栏'); await pause(60)
      a.api.select(a.api.text().length)
      a.api.view().dom.dispatchEvent(new a.dom.defaultView.InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true }))
      sync(a, b); same(a, b)
      assert(a.api.text().includes('REMOTE '), 'local undo removed remote work')
      a.api.editor().redo(); sync(a, b); same(a, b)
      a.api.insert(' continued'); sync(a, b); same(a, b)
      assert(a.api.stable(), 'readonly/status rebuilt view')
      assert(Object.values(a.api.effects()).every(count => count === 0), 'host editor opened transport/storage')
      // Reconfigure status/props while retaining undo history.
      const previous = a.api.text()
      a.api.editor().replaceAll('world', 'Earth'); sync(a, b); same(a, b)
      a.api.editor().undo(); sync(a, b); same(a, b)
      assert(a.api.text() === previous, 'replaceAll undo merged with earlier typing')
      log('PASS ' + (baseline ? 'existing' : 'empty') + ': preview cycles, remote edit while hidden, readonly/status, undo/redo, replaceAll')
      a.api.dispose(); b.api.dispose(); frames.forEach(f => f.remove()); frames = []
    }
    {
      const p = await client('preview')
      await p.api.bootstrap('initial preview')
      await until(() => p.api.view(), 'initial preview did not mount backing editor')
      p.api.remember(); p.api.status('error', false); await pause(50)
      assert(!p.api.editor().insertText('blocked'), 'error state allowed editing')
      p.api.status('ready', true)
      button(p, '分栏'); await pause(80)
      assert(p.api.text() === p.api.view().state.doc.toString() && p.api.stable(), 'initial preview/status reinitializes')
      log('PASS initial preview + ready/error transitions retain backing model/view')
      p.api.dispose(); frames.forEach(f => f.remove()); frames = []
    }
    const a = await client(), b = await client()
    await a.api.bootstrap('Hello world\nsecond line')
    await b.api.load(a.api.checkpoint())
    await until(() => a.api.view() && b.api.view(), 'editors not ready')
    a.api.remember(); a.api.watch()
    // Both tabs edit without delivery, then host replays original updates.
    a.api.select(0); b.api.select(b.api.text().length)
    a.api.insert('A'); b.api.insert('B')
    const aa = a.api.takeUpdates(), bb = b.api.takeUpdates()
    aa.forEach(bytes => b.api.apply(bytes)); bb.forEach(bytes => a.api.apply(bytes))
    same(a, b)
    assert(!a.api.count().pending && !b.api.count().pending, 'remote echo')
    log('PASS concurrent local edits + host reconnect replay converge without echo')
    const caret = a.api.remote(3), range = a.api.remote(4, 19, 'second', '另一个会话')
    a.api.editor().renderRemoteSelections([caret, range])
    await pause(50)
    assert(a.dom.querySelectorAll('.exmd-remote-caret').length === 2, 'collapsed/expanded carets missing')
    assert(a.dom.querySelectorAll('.exmd-remote-label').length === 2, 'names missing')
    assert(a.dom.querySelectorAll('.exmd-remote-selection').length >= 2, 'multi-line selection missing')
    const position = a.api.view().posAtDOM(a.dom.querySelector('[data-session-id="tab-remote"]'))
    b.api.select(0); b.api.insert('prefix '); sync(b, a)
    await pause(50)
    assert(a.api.view().posAtDOM(a.dom.querySelector('[data-session-id="tab-remote"]')) === position + 7, 'remote caret did not move with CRDT')
    a.api.editor().renderRemoteSelections([{ ...caret, selection: null }])
    assert(a.dom.querySelectorAll('.exmd-remote-caret').length === 0, 'leave/blur snapshot did not clear')
    a.api.editor().renderRemoteSelections([caret])
    a.api.readonly(true); await pause(80)
    assert(!a.dom.querySelector('.exmd-remote-caret'), 'readonly retained caret')
    assert(a.api.selections().at(-1) === null, 'readonly did not emit null')
    assert(a.api.editor().insertText('FORBIDDEN') === false && a.api.editor().undo() === false, 'readonly handle allowed writes')
    assert(a.dom.querySelector('.cm-content').getAttribute('contenteditable') === 'false', 'readonly DOM')
    a.api.readonly(false); await pause(60)
    assert(a.api.stable(), 'readonly rebuilt view')
    a.api.view().focus(); a.api.select(3); await pause(180)
    assert(a.api.selections().at(-1)?.kind === 'text', 'selection subscription missing')
    a.api.view().contentDOM.blur(); await pause(180)
    assert(a.api.selections().at(-1) === null, 'blur did not publish null')
    log('PASS public remote carets/names, multi-line ranges, same-user sessions, position updates and clear/readonly')
    const comment = a.api.comment('comment-1', 8, 13)
    a.api.editor().renderAnchors([comment])
    assert(a.dom.querySelector('.exmd-comment-anchor'), 'comment underline missing')
    a.dom.querySelector('.exmd-comment-anchor').click()
    assert(a.api.clicks().at(-1) === 'comment-1', 'comment click callback')
    assert(a.dom.querySelector('.exmd-comment-active'), 'comment click did not activate')
    a.api.editor().setActiveAnchor(null)
    assert(!a.dom.querySelector('.exmd-comment-active'), 'comment deactivate')
    button(a, '仅预览'); await pause(60)
    a.api.editor().setActiveAnchor('comment-1')
    assert(a.api.editor().revealAnchor(comment.anchor), 'card reveal failed')
    await pause(60)
    assert(a.dom.querySelector('.editor-pane').hidden && a.dom.querySelector('.exmd-preview-comment-active'), 'preview card-to-region failed')
    button(a, '分栏'); await pause(60)
    a.api.editor().renderAnchors([{ ...comment, resolved: true }])
    assert(!a.dom.querySelector('.exmd-comment-anchor'), 'resolved comment visible')
    a.api.editor().renderAnchors([{ ...comment, deleted: true }])
    assert(!a.dom.querySelector('.exmd-comment-anchor'), 'deleted comment visible')
    a.api.editor().renderAnchors([comment])
    const anchorRange = a.api.editor().resolveAnchor(comment.anchor)
    a.api.select(anchorRange.from, anchorRange.to); a.api.insert('')
    sync(a, b)
    assert(!a.dom.querySelector('.exmd-comment-anchor'), 'orphan still rendered')
    assert(a.api.editor().resolveAnchor(comment.anchor) === null, 'deleted range still resolves')
    log('PASS comment underline/active/click/card reveal/clear/resolved/deleted/orphan')
    a.api.select(0)
    a.api.startUpload(); await pause(30)
    button(a, '仅预览'); await pause(60)
    b.api.select(0); b.api.insert('during-upload '); sync(b, a)
    a.api.resolveUpload(); await pause(80); sync(a, b)
    button(a, '分栏'); await pause(60)
    same(a, b)
    assert(a.api.text().includes('![fixture](stable-asset-123)'), 'upload path missing')
    assert(a.api.text().startsWith('during-upload '), 'upload lost relative selection')
    a.api.startUpload(); await pause(30)
    a.api.readonly(true); await pause(60)
    assert(a.api.aborted(), 'readonly did not abort')
    const before = a.api.text()
    a.api.resolveUpload(); await pause(60)
    assert(a.api.text() === before, 'late upload inserted after readonly')
    assert(a.api.stable(), 'upload/preview rebuilt editor')
    assert(Object.values(a.api.effects()).every(count => count === 0), 'host editor opened transport/storage')
    log('PASS preview upload completion, concurrent remote edit, readonly abort + ignored late result')
    log('ALL PASSED')
  } catch (error) { log('FAIL ' + error.stack) }
}

document.getElementById('preview-tests').onclick = async () => {
  await reset()
  try { await runPreviewSuite({ client, pause, assert, until, sync, same, button, log }); log('PREVIEW ALL PASSED') }
  catch (error) { log('FAIL ' + error.stack) }
}

document.getElementById('idle').onclick = async () => {
  await reset()
  try {
    const a = await client()
    await a.api.bootstrap('Idle baseline\n\n' + 'line\n'.repeat(1000))
    await until(() => a.api.view(), 'editor not ready')
    a.api.remember()
    const before = a.api.count()
    const comment = a.api.comment('idle-comment', 0, 4)
    a.api.editor().renderAnchors([comment])
    const start = performance.now()
    for (let n = 0; n < 60; n++) {
      if (n % 2) {
        selectRenderedText(a, '.markdown-body p', 0, 4)
      } else a.api.select(n)
      a.api.editor().setActiveAnchor(n % 2 ? 'idle-comment' : null)
      a.api.status('ready')
      assert(await a.api.exportFile().blob.text() === a.api.text(), 'idle export changed source')
      a.dom.querySelector('.editor-pane').scrollTop = n * 8
      a.dom.querySelector('.preview-pane').scrollTop = n * 4
      frames[0].style.width = (n % 2 ? 650 : 680) + 'px'
      if (n % 10 === 0) log('静置与选区/状态/滚动/尺寸变化/原文导出 ' + n + 's')
      await pause(1000)
    }
    assert(a.api.count().pending === before.pending && a.api.count().changes === before.changes, 'idle emitted content changes')
    assert(a.api.stable(), 'idle props rebuilt editor')
    log('PASS real browser idle ' + Math.round(performance.now() - start) + 'ms: 0 content updates; stable CodeMirror')
  } catch (error) { log('FAIL ' + error.stack) }
}
