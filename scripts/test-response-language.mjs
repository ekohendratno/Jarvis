import assert from 'node:assert/strict'
import test from 'node:test'
import { responseLanguageInstruction } from '../src/lib/response-language.ts'

test('Indonesian setting locks the response language instead of relying on short-input detection', () => {
  const instruction = responseLanguageInstruction('id-ID')
  assert.match(instruction, /Bahasa Indonesia/)
  assert.match(instruction, /wajib/i)
})

test('English setting locks its response language', () => {
  assert.match(responseLanguageInstruction('en-US'), /English \(US\)/)
})
