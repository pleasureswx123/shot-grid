import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { requireRole } from './permissions';

const createResponse = () => {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, state };
};

test('role middleware rejects anonymous requests', () => {
  const { response, state } = createResponse();
  let nextCalled = false;
  requireRole('admin')(
    {} as Request,
    response,
    (() => { nextCalled = true; }) as NextFunction,
  );

  assert.equal(state.status, 401);
  assert.equal(nextCalled, false);
});

test('role middleware rejects an authenticated role outside the allowlist', () => {
  const { response, state } = createResponse();
  const request = {
    authUser: { role: 'creator' },
  } as unknown as Request;
  let nextCalled = false;
  requireRole('admin', 'director')(
    request,
    response,
    (() => { nextCalled = true; }) as NextFunction,
  );

  assert.equal(state.status, 403);
  assert.equal(nextCalled, false);
});

test('role middleware allows a matching authenticated role', () => {
  const { response, state } = createResponse();
  const request = {
    authUser: { role: 'director' },
  } as unknown as Request;
  let nextCalled = false;
  requireRole('admin', 'director')(
    request,
    response,
    (() => { nextCalled = true; }) as NextFunction,
  );

  assert.equal(state.status, undefined);
  assert.equal(nextCalled, true);
});

