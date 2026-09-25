import test from 'node:test'
import assert from 'node:assert/strict'
import { editorMessageKeys, resolveEditorLocale, translate } from '../src/editor/i18n.ts'

test('zh and en catalogs use the same keys', () => {
  const keys = editorMessageKeys()
  assert.deepEqual(keys.zh, keys.en)
  assert.ok(keys.en.length > 0)
  for (const key of keys.en) {
    assert.notEqual(translate('en', key), key)
    assert.notEqual(translate('zh', key), key)
  }
})

test('omitted locale is Chinese and unknown locales are English', () => {
  assert.equal(resolveEditorLocale(), 'zh')
  assert.equal(resolveEditorLocale(''), 'zh')
  assert.equal(resolveEditorLocale('zh'), 'zh')
  assert.equal(resolveEditorLocale('en'), 'en')
  assert.equal(resolveEditorLocale('zh-CN'), 'en')
  assert.equal(translate(undefined, 'toolbar.undo'), '撤销')
  assert.equal(translate('fr', 'toolbar.undo'), 'Undo')
})

test('placeholders, plurals, and overrides', () => {
  assert.equal(translate('en', 'header.room', { roomId: 'alpha' }), 'Room · alpha')
  assert.equal(translate('zh', 'editor.characters', { count: 1 }), '1 字符')
  assert.equal(translate('en', 'editor.characters', { count: 1 }), '1 character')
  assert.equal(translate('en', 'editor.characters', { count: 0 }), '0 characters')
  assert.equal(translate('en', 'toolbar.undo', undefined, { 'toolbar.undo': 'Revert' }), 'Revert')
  assert.equal(translate('en', 'missing.key'), 'missing.key')
  assert.equal(translate('zh', 'pdf.fileTooLarge', { maxBytes: 10 }), 'PDF 文件超过 10 字节限制')
})
