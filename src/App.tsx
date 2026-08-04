/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { WorkbenchView } from './components/workbench/WorkbenchView';
import { ProjectOverviewView } from './components/project/ProjectOverviewView';
import { ShotsView } from './components/shots/ShotsView';
import { AssetsView } from './components/assets/AssetsView';
import { ReviewView } from './components/review/ReviewView';
import { FilesView } from './components/files/FilesView';
import { CommunicationView } from './components/communication/CommunicationView';

import { VersionUploadModal } from './components/common/VersionUploadModal';
import { ImportExcelModal } from './components/common/ImportExcelModal';
import { NewShotModal } from './components/common/NewShotModal';
import { NewAssetModal } from './components/common/NewAssetModal';
import { ImportAssetsModal } from './components/common/ImportAssetsModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { createFallbackAvatar } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Clapperboard, Loader2 } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ProjectSetupView } from './components/project/ProjectSetupView';
import type { Project, User } from './types';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  // Modal triggers
  const [showNewShotModal, setShowNewShotModal] = useState(false);
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [showImportAssetsModal, setShowImportAssetsModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [initialTaskIdForVersion, setInitialTaskIdForVersion] = useState<string | undefined>(undefined);

  const handleOpenNewVersion = (taskId?: string) => {
    setInitialTaskIdForVersion(taskId);
    setShowNewVersionModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenNewShot={() => setShowNewShotModal(true)}
        onOpenNewAsset={() => setShowNewAssetModal(true)}
        onOpenNewVersion={handleOpenNewVersion}
        onOpenImportExcel={() => setShowImportExcelModal(true)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <SidebarNav />

        {/* Dynamic Content View Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {activeTab === 'workbench' && (
            <WorkbenchView onOpenNewVersion={handleOpenNewVersion} />
          )}

          {activeTab === 'communication' && (
            <CommunicationView />
          )}

          {activeTab === 'project' && (
            <ProjectOverviewView onOpenNewVersion={handleOpenNewVersion} />
          )}

          {activeTab === 'shots' && (
            <ShotsView
              onOpenNewShot={() => setShowNewShotModal(true)}
              onOpenImportExcel={() => setShowImportExcelModal(true)}
              onOpenNewVersion={handleOpenNewVersion}
            />
          )}

          {activeTab === 'assets' && (
            <AssetsView
              onOpenNewAsset={() => setShowNewAssetModal(true)}
              onOpenImportAssets={() => setShowImportAssetsModal(true)}
              onOpenNewVersion={handleOpenNewVersion}
            />
          )}

          {activeTab === 'review' && (
            <ReviewView />
          )}

          {activeTab === 'files' && (
            <FilesView />
          )}
        </main>
      </div>

      {/* Modals */}
      {showNewShotModal && (
        <NewShotModal onClose={() => setShowNewShotModal(false)} />
      )}

      {showNewAssetModal && (
        <NewAssetModal onClose={() => setShowNewAssetModal(false)} />
      )}

      {showImportAssetsModal && (
        <ImportAssetsModal onClose={() => setShowImportAssetsModal(false)} />
      )}

      {showImportExcelModal && (
        <ImportExcelModal onClose={() => setShowImportExcelModal(false)} />
      )}

      {showNewVersionModal && (
        <VersionUploadModal
          initialTaskId={initialTaskIdForVersion}
          onClose={() => {
            setShowNewVersionModal(false);
            setInitialTaskIdForVersion(undefined);
          }}
        />
      )}
    </div>
  );
};

const LoadingScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center space-y-3">
    <div className="relative">
      <Clapperboard className="w-10 h-10 text-indigo-400" />
      <Loader2 className="w-5 h-5 text-indigo-300 animate-spin absolute -right-4 -bottom-2" />
    </div>
    <span className="text-xs font-semibold">{message}</span>
  </div>
);

const WorkspaceApp: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { selectedProject, members, isLoading } = useWorkspace();

  if (isLoading) {
    return <LoadingScreen message="正在读取项目工作区…" />;
  }

  if (!selectedProject) return <ProjectSetupView />;

  const domainProject: Project = {
    id: selectedProject.id,
    name: selectedProject.name,
    code: selectedProject.code,
    type: selectedProject.type,
    aspectRatio: selectedProject.aspectRatio,
    totalDurationMin: selectedProject.totalDurationMin,
    deliveryDate: selectedProject.deliveryDate || '',
    directorId: selectedProject.directorId || currentUser.id,
    members: members.map(member => member.id),
    status: selectedProject.status,
    currentPhase: selectedProject.currentPhase,
    totalShots: selectedProject.totalShots,
    completedShots: selectedProject.completedShots,
    pendingReviewShots: 0,
    revisingShots: 0,
    blockedShots: 0,
    storageKey: selectedProject.storageKey,
    storagePath: selectedProject.storagePath,
    storageDirectories: selectedProject.storageDirectories,
  };
  const domainUsers: User[] = members.map(member => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    department: member.department,
    avatar: member.avatar || createFallbackAvatar(member.name),
  }));

  return (
    <AppProvider
      key={selectedProject.id}
      currentUser={currentUser}
      initialProject={domainProject}
      initialUsers={domainUsers}
    >
      <AppContent />
    </AppProvider>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="正在连接工作室服务器…" />;
  }

  if (!user) return <LoginView />;

  return (
    <WorkspaceProvider>
      <WorkspaceApp currentUser={user} />
    </WorkspaceProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
