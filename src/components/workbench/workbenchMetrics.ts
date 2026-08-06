import type { ReviewList, Task, User, Version } from '../../types';

export const PROJECT_TIME_ZONE = 'Asia/Shanghai';

const OPEN_REVIEW_STATUSES = new Set<ReviewList['status']>(['待审核', '审核中']);

export const getDateKeyInTimeZone = (
  value: Date,
  timeZone = PROJECT_TIME_ZONE,
): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const getMyDueTasks = (
  tasks: Task[],
  userId: string,
  now = new Date(),
  timeZone = PROJECT_TIME_ZONE,
) => {
  const today = getDateKeyInTimeZone(now, timeZone);
  const unfinished = tasks.filter(task => task.assigneeId === userId && task.status !== '已完成');
  return {
    dueToday: unfinished.filter(task => task.dueDate === today),
    overdue: unfinished.filter(task => task.dueDate < today),
  };
};

export const getRecentProjectVersions = (
  versions: Version[],
  now = new Date(),
  windowMs = 24 * 60 * 60 * 1000,
): Version[] => {
  const cutoff = now.getTime() - windowMs;
  return versions
    .filter(version => {
      const createdAt = new Date(version.createdAt.replace(' ', 'T')).getTime();
      return Number.isFinite(createdAt) && createdAt >= cutoff && createdAt <= now.getTime();
    })
    .sort((left, right) =>
      new Date(right.createdAt.replace(' ', 'T')).getTime()
      - new Date(left.createdAt.replace(' ', 'T')).getTime());
};

const participantRoleMatchesUser = (
  user: User,
  participantRole: ReviewList['participants'][number]['role'],
) => {
  if (participantRole === '观察者') return false;
  return user.role === 'client' ? participantRole === '客户' : participantRole === '审核人';
};

export const getPendingReviewTasks = (
  tasks: Task[],
  versions: Version[],
  reviewLists: ReviewList[],
  user: User,
): Task[] => {
  const pendingVersionIds = new Set(
    reviewLists
      .filter(reviewList => OPEN_REVIEW_STATUSES.has(reviewList.status))
      .filter(reviewList => reviewList.participants.some(participant =>
        participant.userId === user.id
        && !participant.hasCompleted
        && participantRoleMatchesUser(user, participant.role)))
      .flatMap(reviewList => reviewList.versionIds),
  );
  const pendingTaskIds = new Set(
    versions.filter(version => pendingVersionIds.has(version.id)).map(version => version.taskId),
  );
  return tasks.filter(task => task.status === '待审核' && pendingTaskIds.has(task.id));
};
