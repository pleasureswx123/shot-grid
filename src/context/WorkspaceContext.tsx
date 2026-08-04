import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState
} from 'react';
import type { UserRole } from '../types';

const SELECTED_PROJECT_KEY = 'shotgrid_selected_project_id';

export interface ServerProject {
  id: string;
  name: string;
  code: string;
  type: string;
  aspectRatio: string;
  totalDurationMin: number;
  deliveryDate: string | null;
  directorId: string | null;
  status: '进行中' | '已完成' | '筹备中';
  currentPhase: string;
  storageKey: string;
  storagePath: string;
  storageDirectories: string[];
  projectRole: UserRole;
  totalShots: number;
  completedShots: number;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string | null;
  isActive: boolean;
  projectRole: UserRole;
  joinedAt: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string | null;
}

interface CreateProjectInput {
  name: string;
  code: string;
  type: string;
  aspectRatio: string;
}

interface WorkspaceContextValue {
  projects: ServerProject[];
  selectedProject: ServerProject | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string) => void;
  members: ProjectMember[];
  directory: DirectoryUser[];
  isLoading: boolean;
  isMembersLoading: boolean;
  error: string | null;
  createProject: (input: CreateProjectInput) => Promise<void>;
  addMember: (userId: string, projectRole: UserRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const parseError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Ignore malformed error bodies.
  }
  return `请求失败（${response.status}）`;
};

const requestJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init?.headers,
  });
  if (!response.ok) throw new Error(await parseError(response));
  if (response.status === 204) return null;
  return response.json();
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [selectedProjectIdState, setSelectedProjectIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_PROJECT_KEY),
  );
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSelectedProjectId = useCallback((projectId: string) => {
    setSelectedProjectIdState(projectId);
    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
  }, []);

  const loadWorkspace = useCallback(async (preferredProjectId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectsBody, usersBody] = await Promise.all([
        requestJson('/api/projects'),
        requestJson('/api/users'),
      ]);
      const nextProjects: ServerProject[] = projectsBody.projects;
      setProjects(nextProjects);
      setDirectory(usersBody.users);

      const candidateId = preferredProjectId || selectedProjectIdState;
      const nextSelectedId = nextProjects.some(project => project.id === candidateId)
        ? candidateId!
        : nextProjects[0]?.id || null;
      setSelectedProjectIdState(nextSelectedId);
      if (nextSelectedId) localStorage.setItem(SELECTED_PROJECT_KEY, nextSelectedId);
      else localStorage.removeItem(SELECTED_PROJECT_KEY);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取项目工作区。');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectIdState]);

  useEffect(() => {
    void loadWorkspace();
    // Initial workspace load only; later changes use explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMembers = useCallback(async () => {
    if (!selectedProjectIdState) {
      setMembers([]);
      return;
    }
    setIsMembersLoading(true);
    setError(null);
    try {
      const body = await requestJson(`/api/projects/${selectedProjectIdState}/members`);
      setMembers(body.members);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取项目成员。');
    } finally {
      setIsMembersLoading(false);
    }
  }, [selectedProjectIdState]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  const createProject = async (input: CreateProjectInput): Promise<void> => {
    const body = await requestJson('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await loadWorkspace(body.project.id);
  };

  const addMember = async (userId: string, projectRole: UserRole): Promise<void> => {
    if (!selectedProjectIdState) throw new Error('请先选择项目。');
    await requestJson(`/api/projects/${selectedProjectIdState}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, projectRole }),
    });
    await refreshMembers();
  };

  const removeMember = async (userId: string): Promise<void> => {
    if (!selectedProjectIdState) throw new Error('请先选择项目。');
    await requestJson(`/api/projects/${selectedProjectIdState}/members/${userId}`, {
      method: 'DELETE',
    });
    await refreshMembers();
  };

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedProjectIdState) || null,
    [projects, selectedProjectIdState],
  );

  return (
    <WorkspaceContext.Provider value={{
      projects,
      selectedProject,
      selectedProjectId: selectedProjectIdState,
      setSelectedProjectId,
      members,
      directory,
      isLoading,
      isMembersLoading,
      error,
      createProject,
      addMember,
      removeMember,
      refreshMembers,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
