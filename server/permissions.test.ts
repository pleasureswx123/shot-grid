import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  canCommentReview,
  canCreateReviewList,
  canCreateTask,
  canDeleteFile,
  canEditProject,
  canManageMembers,
  canReviewVersion,
  canSubmitVersion,
  canViewProject,
  requireRole,
  type ProjectPermissionContext,
} from './permissions';

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


const coreCapabilities = {
  canViewProject,
  canEditProject,
  canManageMembers,
  canCreateTask,
  canSubmitVersion,
  canReviewVersion,
  canCreateReviewList,
  canCommentReview,
  canDeleteFile,
};

const evaluateCapabilities = (context: ProjectPermissionContext) =>
  Object.fromEntries(
    Object.entries(coreCapabilities).map(([name, capability]) => [name, capability(context)]),
  );

test('project capabilities allow system admin inside or outside any project', () => {
  const expected = Object.fromEntries(Object.keys(coreCapabilities).map((name) => [name, true]));

  assert.deepEqual(evaluateCapabilities({ systemRole: 'admin', projectRole: null }), expected);
  assert.deepEqual(evaluateCapabilities({ systemRole: 'admin', projectRole: 'client' }), expected);
});

test('project capabilities allow project directors to manage workflow but not outside projects', () => {
  assert.deepEqual(evaluateCapabilities({ systemRole: 'director', projectRole: 'director' }), {
    canViewProject: true,
    canEditProject: true,
    canManageMembers: true,
    canCreateTask: true,
    canSubmitVersion: true,
    canReviewVersion: true,
    canCreateReviewList: true,
    canCommentReview: true,
    canDeleteFile: true,
  });
  assert.deepEqual(evaluateCapabilities({ systemRole: 'director', projectRole: null }), {
    canViewProject: false,
    canEditProject: false,
    canManageMembers: false,
    canCreateTask: false,
    canSubmitVersion: false,
    canReviewVersion: false,
    canCreateReviewList: false,
    canCommentReview: false,
    canDeleteFile: false,
  });
});

test('project capabilities allow creators to submit production work but not review or administer', () => {
  assert.deepEqual(evaluateCapabilities({ systemRole: 'creator', projectRole: 'creator' }), {
    canViewProject: true,
    canEditProject: false,
    canManageMembers: false,
    canCreateTask: true,
    canSubmitVersion: true,
    canReviewVersion: false,
    canCreateReviewList: false,
    canCommentReview: true,
    canDeleteFile: false,
  });
  assert.deepEqual(evaluateCapabilities({ systemRole: 'creator', projectRole: null }), {
    canViewProject: false,
    canEditProject: false,
    canManageMembers: false,
    canCreateTask: false,
    canSubmitVersion: false,
    canReviewVersion: false,
    canCreateReviewList: false,
    canCommentReview: false,
    canDeleteFile: false,
  });
});

test('project capabilities keep clients read/review focused and deny outside access', () => {
  assert.deepEqual(evaluateCapabilities({ systemRole: 'client', projectRole: 'client' }), {
    canViewProject: true,
    canEditProject: false,
    canManageMembers: false,
    canCreateTask: false,
    canSubmitVersion: false,
    canReviewVersion: true,
    canCreateReviewList: false,
    canCommentReview: true,
    canDeleteFile: false,
  });
  assert.deepEqual(evaluateCapabilities({ systemRole: 'client', projectRole: null }), {
    canViewProject: false,
    canEditProject: false,
    canManageMembers: false,
    canCreateTask: false,
    canSubmitVersion: false,
    canReviewVersion: false,
    canCreateReviewList: false,
    canCommentReview: false,
    canDeleteFile: false,
  });
});
