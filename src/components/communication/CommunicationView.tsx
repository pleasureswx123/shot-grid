import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ChatMessage, DepartmentChannel, User } from '../../types';
import { ImageEditorModal } from './ImageEditorModal';
import {
  MessageSquare, Send, Image, Film, Pencil, Paperclip, Users, Hash,
  Sparkles, Heart, Search, Plus, X, Maximize2, Check, Video, Play, Pause,
  Share2, Shield, Eye, Layers, ChevronRight, UserCheck, Megaphone, Palette, Scissors, AlertCircle
} from 'lucide-react';

export const CommunicationView: React.FC = () => {
  const {
    currentUser,
    users,
    shots,
    assets,
    channels,
    chatMessages,
    sendChatMessage,
    updateChatMessageMedia,
    toggleLikeMessage,
    createDepartmentChannel,
    addVersion
  } = useApp();

  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');

  // Media attachments in message compose
  const [selectedMediaType, setSelectedMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string>('');
  const [selectedMediaName, setSelectedMediaName] = useState<string>('');
  const [referencedEntity, setReferencedEntity] = useState<{ type: 'shot' | 'asset' | 'task'; id: string; code: string; title?: string } | undefined>(undefined);

  // Modals
  const [editingImageMessage, setEditingImageMessage] = useState<{ id: string; url: string; name?: string } | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ type: 'image' | 'video'; url: string; title?: string } | null>(null);
  const [showNewChannelModal, setShowNewChannelModal] = useState<boolean>(false);
  const [newChanName, setNewChanName] = useState<string>('');
  const [newChanDept, setNewChanDept] = useState<string>('AI视频生成组');
  const [newChanDesc, setNewChanDesc] = useState<string>('');

  // Quick preset gallery for testing uploads
  const [showPresetGallery, setShowPresetGallery] = useState<'none' | 'image' | 'video'>('none');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeChannel = channels.find(c => c.id === selectedChannelId) || channels[0];
  const channelMessages = chatMessages.filter(m => m.channelId === selectedChannelId);

  // Sample media presets for direct click-to-attach testing
  const presetImages = [
    { name: '太空舱破裂概念图.png', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80', entity: { type: 'shot' as const, id: 'sh001', code: 'SH001', title: '太空舱玻璃破裂' } },
    { name: '男主苟翱天三视图.png', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80', entity: { type: 'asset' as const, id: 'a1', code: '苟翱天', title: '角色资产' } },
    { name: '外星遗迹建筑参考.png', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80', entity: { type: 'asset' as const, id: 'a2', code: '失落科幻城市', title: '场景资产' } },
    { name: '激光脉冲枪细节.png', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80', entity: { type: 'asset' as const, id: 'a3', code: '高能粒子枪', title: '道具资产' } }
  ];

  const presetVideos = [
    { name: 'SH001_Hailuo_Test_V003.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', entity: { type: 'shot' as const, id: 'sh001', code: 'SH001', title: '太空舱玻璃破裂' } },
    { name: 'SH002_Kling1.5_V001.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', entity: { type: 'shot' as const, id: 'sh002', code: 'SH002', title: '警报红灯闪烁' } }
  ];

  const getChannelIcon = (iconName: string) => {
    switch (iconName) {
      case 'Megaphone': return <Megaphone className="w-4 h-4" />;
      case 'Film': return <Film className="w-4 h-4" />;
      case 'Palette': return <Palette className="w-4 h-4" />;
      case 'Scissors': return <Scissors className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && selectedMediaType === 'none') return;

    sendChatMessage({
      channelId: selectedChannelId,
      senderId: currentUser.id,
      content: textInput.trim(),
      mediaType: selectedMediaType,
      mediaUrl: selectedMediaUrl || undefined,
      mediaName: selectedMediaName || undefined,
      referencedEntity: referencedEntity
    });

    // Reset input fields
    setTextInput('');
    setSelectedMediaType('none');
    setSelectedMediaUrl('');
    setSelectedMediaName('');
    setReferencedEntity(undefined);
    setShowPresetGallery('none');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    const dummyUrl = URL.createObjectURL(file);
    setSelectedMediaType(isVideo ? 'video' : 'image');
    setSelectedMediaUrl(dummyUrl);
    setSelectedMediaName(file.name);
    setShowPresetGallery('none');
  };

  const handleSaveEditedImage = (editedDataUrl: string) => {
    if (editingImageMessage) {
      updateChatMessageMedia(editingImageMessage.id, editedDataUrl);
      setEditingImageMessage(null);
    }
  };

  // Quick action to send chat video to Version Review
  const handlePushVideoToReview = (msg: ChatMessage) => {
    if (!msg.mediaUrl) return;
    addVersion({
      taskId: 't_sh001_2',
      entityType: msg.referencedEntity?.type === 'asset' ? 'asset' : 'shot',
      entityId: msg.referencedEntity?.id || 'sh001',
      versionNumber: 'V004_ChatReview',
      fileUrl: msg.mediaUrl,
      fileType: 'video',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      uploaderId: currentUser.id,
      changelog: `来自部门沟通【${activeChannel.name}】讨论视频直接提交集评`,
      status: '待审核'
    });
    alert(`已成功将视频【${msg.mediaName || '交流视频'}】作为新版本提交集评审核！`);
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* 1. Left Sidebar: Channels & Departments */}
      <div className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between">
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h1 className="text-sm font-bold tracking-wide text-slate-100">部门交流系统</h1>
            </div>
            <button
              onClick={() => setShowNewChannelModal(true)}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="新建交流频道"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="搜索频道或聊天记录..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>部门与专项频道</span>
              <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                {channels.length}
              </span>
            </div>

            <div className="space-y-1">
              {channels
                .filter(c => c.name.includes(searchQuery) || c.department.includes(searchQuery))
                .map(channel => {
                  const isActive = channel.id === selectedChannelId;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                          {getChannelIcon(channel.icon)}
                        </span>
                        <div className="truncate">
                          <p className="font-medium truncate">{channel.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{channel.department}</p>
                        </div>
                      </div>
                      {channel.unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.2 text-[10px] bg-indigo-500 text-white font-bold rounded-full font-mono">
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Quick Department Roster Status */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="px-2 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Users className="w-3 h-3 text-emerald-400" />
              <span>项目成员（业务数据待迁移）</span>
            </div>

            <div className="space-y-1.5">
              {users.map(u => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <div
                    key={u.id}
                    className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-[11px] ${
                      isCurrent
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                        <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                          isCurrent ? 'bg-emerald-400' : 'bg-slate-600'
                        }`} />
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-slate-200 truncate">{u.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{u.department}</p>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                        当前
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[10px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center space-x-1 text-slate-400">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>登录为: <strong className="text-indigo-300">{currentUser.name}</strong></span>
          </div>
          <span className="text-slate-600 font-mono">{currentUser.department}</span>
        </div>
      </div>

      {/* 2. Middle Panel: Main Chat Conversation */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
        {/* Channel Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {getChannelIcon(activeChannel.icon)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-100">{activeChannel.name}</h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  {activeChannel.department}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeChannel.description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>全组成员 ({users.length}人在线)</span>
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {channelMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-700" />
              <p className="text-xs">暂无交流记录，点击下方输入框发送您的首条部门想法吧！</p>
            </div>
          ) : (
            channelMessages.map(msg => {
              const sender = users.find(u => u.id === msg.senderId) || {
                name: '未知成员',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                department: '通用部门',
                role: 'creator'
              };
              const isSelf = msg.senderId === currentUser.id;
              const hasLiked = msg.likes?.includes(currentUser.id);

              return (
                <div key={msg.id} className="flex space-x-3 group">
                  <img
                    src={sender.avatar}
                    alt={sender.name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-800 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Header info */}
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-semibold text-slate-200">{sender.name}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                        {sender.department}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{msg.createdAt}</span>
                    </div>

                    {/* Message Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed shadow-sm max-w-2xl">
                      {/* Text content with code tags highlighting */}
                      {msg.content && (
                        <p className="whitespace-pre-wrap mb-2 font-sans">
                          {msg.content}
                        </p>
                      )}

                      {/* Referenced Shot or Asset Tag Badge */}
                      {msg.referencedEntity && (
                        <div className="mb-2 flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-indigo-300">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          <span>关联对象: <strong>#{msg.referencedEntity.code}</strong></span>
                          {msg.referencedEntity.title && (
                            <span className="text-slate-400 font-normal">({msg.referencedEntity.title})</span>
                          )}
                        </div>
                      )}

                      {/* Image Attachment Rendering */}
                      {msg.mediaType === 'image' && (msg.mediaUrl || msg.editedMediaUrl) && (
                        <div className="mt-2 space-y-2">
                          <div className="relative group/img rounded-lg overflow-hidden border border-slate-800 bg-slate-950 max-w-md">
                            <img
                              src={msg.editedMediaUrl || msg.mediaUrl}
                              alt={msg.mediaName || '交流图片'}
                              className="w-full h-auto max-h-80 object-cover"
                            />

                            {/* Image overlay controls */}
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/img:opacity-100 transition duration-200 flex items-center justify-center space-x-2">
                              <button
                                onClick={() => setEditingImageMessage({ id: msg.id, url: msg.editedMediaUrl || msg.mediaUrl!, name: msg.mediaName })}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-lg"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>编辑 / 画笔批注</span>
                              </button>
                              <button
                                onClick={() => setFullscreenMedia({ type: 'image', url: msg.editedMediaUrl || msg.mediaUrl!, title: msg.mediaName })}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                                title="放大预览"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                            <span className="flex items-center space-x-1">
                              <Image className="w-3 h-3 text-sky-400" />
                              <span>{msg.mediaName || '设计草图参考.png'}</span>
                              {msg.editedMediaUrl && (
                                <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                  已修改批注
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => setEditingImageMessage({ id: msg.id, url: msg.editedMediaUrl || msg.mediaUrl!, name: msg.mediaName })}
                              className="text-indigo-400 hover:underline flex items-center space-x-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>进入图像批注</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Video Attachment Rendering */}
                      {msg.mediaType === 'video' && msg.mediaUrl && (
                        <div className="mt-2 space-y-2 max-w-md">
                          <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                            <video
                              src={msg.mediaUrl}
                              controls
                              className="w-full h-auto max-h-72"
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                            <span className="flex items-center space-x-1">
                              <Video className="w-3 h-3 text-amber-400" />
                              <span>{msg.mediaName || 'AI生成动作视频.mp4'}</span>
                            </span>

                            <button
                              onClick={() => handlePushVideoToReview(msg)}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition font-medium"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>直接提交版本审核</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions / Reactions */}
                    <div className="flex items-center space-x-3 mt-1.5 text-[11px] text-slate-500">
                      <button
                        onClick={() => toggleLikeMessage(msg.id, currentUser.id)}
                        className={`flex items-center space-x-1 transition ${
                          hasLiked ? 'text-rose-400 font-semibold' : 'hover:text-slate-300'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
                        <span>{msg.likes?.length || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Media Preview before sending */}
        {selectedMediaType !== 'none' && (
          <div className="px-6 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              <div className="p-1.5 rounded bg-indigo-500/20 text-indigo-400">
                {selectedMediaType === 'image' ? <Image className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </div>
              <div>
                <p className="font-semibold text-slate-200">{selectedMediaName || '待上传文件'}</p>
                <p className="text-[10px] text-slate-500">准备随同消息一同发送给部门同事</p>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedMediaType('none');
                setSelectedMediaUrl('');
                setSelectedMediaName('');
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Preset Gallery Selector Drawer */}
        {showPresetGallery !== 'none' && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>快速选择已生成的项目素材上传:</span>
              </span>
              <button
                onClick={() => setShowPresetGallery('none')}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                关闭
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {(showPresetGallery === 'image' ? presetImages : presetVideos).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedMediaType(showPresetGallery);
                    setSelectedMediaUrl(item.url);
                    setSelectedMediaName(item.name);
                    setReferencedEntity(item.entity);
                    setShowPresetGallery('none');
                  }}
                  className="group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-1.5 hover:border-indigo-500/60 transition text-left"
                >
                  {showPresetGallery === 'image' ? (
                    <img src={item.url} alt={item.name} className="w-full h-24 object-cover rounded" />
                  ) : (
                    <div className="w-full h-24 bg-slate-900 rounded flex items-center justify-center text-amber-400">
                      <Play className="w-8 h-8" />
                    </div>
                  )}
                  <p className="text-[11px] font-medium text-slate-300 mt-1.5 truncate">{item.name}</p>
                  <p className="text-[9px] text-indigo-400">#{item.entity.code}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="bg-slate-950 border border-slate-800 focus-within:border-indigo-500/80 rounded-xl p-2.5 transition shadow-inner">
            <textarea
              rows={2}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={`在【${activeChannel.name}】中输入工作建议、标注提示或方案讨论...`}
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
              {/* Media upload buttons */}
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-800 transition"
                  title="上传图片或视频"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                  <span>本地文件</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPresetGallery(showPresetGallery === 'image' ? 'none' : 'image')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-800 transition"
                >
                  <Image className="w-3.5 h-3.5 text-sky-400" />
                  <span>选参考图</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPresetGallery(showPresetGallery === 'video' ? 'none' : 'video')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-800 transition"
                >
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>选演示视频</span>
                </button>

                {/* Shot entity tagger */}
                <select
                  value={referencedEntity?.id || ''}
                  onChange={e => {
                    const shot = shots.find(s => s.id === e.target.value);
                    if (shot) {
                      setReferencedEntity({ type: 'shot', id: shot.id, code: shot.shotCode, title: shot.description });
                    } else {
                      setReferencedEntity(undefined);
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 text-slate-400 text-[11px] px-2 py-1 rounded focus:outline-none"
                >
                  <option value=""># 关联镜头编号...</option>
                  {shots.map(s => (
                    <option key={s.id} value={s.id}>#{s.shotCode} ({s.sceneCode})</option>
                  ))}
                </select>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!textInput.trim() && selectedMediaType === 'none'}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs shadow-md shadow-indigo-600/30 transition active:scale-95"
              >
                <span>发送</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. Modal for Image Editor / Annotator */}
      {editingImageMessage && (
        <ImageEditorModal
          imageUrl={editingImageMessage.url}
          imageName={editingImageMessage.name}
          onClose={() => setEditingImageMessage(null)}
          onSave={handleSaveEditedImage}
        />
      )}

      {/* 4. Fullscreen Preview Modal */}
      {fullscreenMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <div className="relative max-w-5xl w-full flex flex-col items-center">
            <button
              onClick={() => setFullscreenMedia(null)}
              className="absolute top-0 right-0 p-2 rounded-full bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <X className="w-6 h-6" />
            </button>
            {fullscreenMedia.type === 'image' ? (
              <img src={fullscreenMedia.url} alt="预览" className="max-h-[85vh] rounded-lg object-contain shadow-2xl border border-slate-800" />
            ) : (
              <video src={fullscreenMedia.url} controls autoPlay className="max-h-[85vh] rounded-lg border border-slate-800 shadow-2xl" />
            )}
            <p className="mt-3 text-xs text-slate-400">{fullscreenMedia.title}</p>
          </div>
        </div>
      )}

      {/* 5. Create Channel Modal */}
      {showNewChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                创建新部门/专项交流频道
              </h3>
              <button onClick={() => setShowNewChannelModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">频道名称</label>
                <input
                  type="text"
                  placeholder="例如: 声音与音乐制作组"
                  value={newChanName}
                  onChange={e => setNewChanName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">所属部门或专项</label>
                <select
                  value={newChanDept}
                  onChange={e => setNewChanDept(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="导演组">导演组</option>
                  <option value="AI视频生成组">AI视频生成组</option>
                  <option value="概念美术组">概念美术组</option>
                  <option value="剪辑特效组">剪辑特效组</option>
                  <option value="技术运维组">技术运维组</option>
                  <option value="跨部门协作">跨部门协作</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">频道讨论主题说明</label>
                <textarea
                  rows={2}
                  placeholder="说明该频道的日常沟通范围..."
                  value={newChanDesc}
                  onChange={e => setNewChanDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowNewChannelModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!newChanName.trim()) return;
                  createDepartmentChannel({
                    name: newChanName.trim(),
                    department: newChanDept,
                    description: newChanDesc.trim() || '部门日常工作探讨频道',
                    icon: 'Sparkles'
                  });
                  setShowNewChannelModal(false);
                  setNewChanName('');
                  setNewChanDesc('');
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                创建频道
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
