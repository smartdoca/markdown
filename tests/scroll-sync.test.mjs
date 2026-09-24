import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectScroll } from '../src/editor/scroll-sync.ts'
test('content centers move at different speeds across code, text and images', () => {
  const points = [{source:0,target:0},{source:100,target:300},{source:500,target:500},{source:600,target:1000}]
  assert.equal(projectScroll(points,50),150)
  assert.equal(projectScroll(points,300),400)
  assert.equal(projectScroll(points,550),750)
  assert.equal(projectScroll(points.map(p=>({source:p.target,target:p.source})),750),550)
  assert.equal(projectScroll(points,-10),0)
  assert.equal(projectScroll(points,700),1000)
})
