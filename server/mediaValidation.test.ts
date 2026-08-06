import assert from 'node:assert/strict';
import test from 'node:test';
import { validateKnownMediaMime, validateVersionMediaExtension } from './mediaValidation';

test('maps review extensions to image, video and audio version types', () => {
  assert.equal(validateVersionMediaExtension('image', 'png'), null);
  assert.equal(validateVersionMediaExtension('video', 'mp4'), null);
  assert.equal(validateVersionMediaExtension('audio', 'wav'), null);
  assert.equal(validateVersionMediaExtension('audio', 'mp3'), null);
  assert.match(validateVersionMediaExtension('video', 'mp3') || '', /不匹配/);
  assert.match(validateVersionMediaExtension('document', 'pdf') || '', /image、video 或 audio/);
});

test('validates browser MIME types for supported audio uploads', () => {
  assert.equal(validateKnownMediaMime('wav', 'audio/wav'), null);
  assert.equal(validateKnownMediaMime('wav', 'audio/x-wav'), null);
  assert.equal(validateKnownMediaMime('mp3', 'audio/mpeg'), null);
  assert.match(validateKnownMediaMime('mp3', 'video/mp4') || '', /MIME/);
});
