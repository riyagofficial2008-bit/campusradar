import {
  Ban,
  BookOpen,
  ExternalLink,
  Flag,
  Heart,
  MessageCircle,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  addPostComment,
  createCommunityPost,
  createStudyGroup,
  deleteCommunityPost,
  reportCommunityPost,
  sendDirectMessage,
  toggleJoinStudyGroup,
  toggleLikePost,
} from '../services/communityService';
import type {
  CommunityPost,
  CommunityPostType,
  DirectMessage,
  PostComment,
  PublicStudentProfile,
  StudyGroup,
  StudyGroupType,
} from '../types/campus';
import { formatRelativeTime } from '../utils/statusLogic';

type CommunitySubTab = 'feed' | 'groups' | 'directory' | 'messages';

interface CommunityViewProps {
  currentUid: string | null;
  myProfile: PublicStudentProfile | null;
  isAdmin: boolean;
  blockedUids: string[];
  profiles: PublicStudentProfile[];
  posts: CommunityPost[];
  comments: PostComment[];
  groups: StudyGroup[];
  messages: DirectMessage[];
  activeDmPartner: { uid: string; name: string; context?: string } | null;
  onSetActiveDmPartner: (partner: { uid: string; name: string; context?: string } | null) => void;
  onBlockUser: (uid: string) => void;
  onUnblockUser: (uid: string) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

export function CommunityView({
  currentUid,
  myProfile,
  isAdmin,
  blockedUids,
  profiles,
  posts,
  comments,
  groups,
  messages,
  activeDmPartner,
  onSetActiveDmPartner,
  onBlockUser,
  onUnblockUser,
  onAuthRequired,
  onNotify,
}: CommunityViewProps) {
  const [subTab, setSubTab] = useState<CommunitySubTab>(() =>
    activeDmPartner ? 'messages' : 'feed'
  );
  const [postFilter, setPostFilter] = useState<CommunityPostType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [postType, setPostType] = useState<CommunityPostType>('discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [department, setDepartment] = useState(myProfile?.department ?? '');
  const [resourceUrl, setResourceUrl] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Comment replies keyed by postId
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Study group composer
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupType, setGroupType] = useState<StudyGroupType>('study_group');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSpot, setGroupSpot] = useState('');

  // DM input
  const [dmText, setDmText] = useState('');
  const [sendingDm, setSendingDm] = useState(false);

  // Switch to messages tab automatically when activeDmPartner is set externally (e.g., from Marketplace / Lost & Found)
  const effectiveTab: CommunitySubTab = activeDmPartner ? 'messages' : subTab;

  const visiblePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (blockedUids.includes(p.authorUid)) return false;
      if (postFilter !== 'all' && p.postType !== postFilter) return false;
      if (q) {
        return (
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.authorName.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [posts, blockedUids, postFilter, searchQuery]);

  const commentsByPostId = useMemo(() => {
    const map = new Map<string, PostComment[]>();
    for (const c of comments) {
      if (blockedUids.includes(c.authorUid)) continue;
      const arr = map.get(c.postId);
      if (arr) arr.push(c);
      else map.set(c.postId, [c]);
    }
    return map;
  }, [comments, blockedUids]);

  const conversationPartners = useMemo(() => {
    const map = new Map<string, { uid: string; name: string; lastMsg?: DirectMessage }>();
    for (const m of messages) {
      const otherUid = m.senderId === currentUid ? m.recipientId : m.senderId;
      const otherName = m.senderId === currentUid ? m.recipientName : m.senderName;
      if (blockedUids.includes(otherUid)) continue;
      map.set(otherUid, { uid: otherUid, name: otherName, lastMsg: m });
    }
    if (activeDmPartner && !map.has(activeDmPartner.uid)) {
      map.set(activeDmPartner.uid, {
        uid: activeDmPartner.uid,
        name: activeDmPartner.name,
      });
    }
    return Array.from(map.values());
  }, [messages, currentUid, blockedUids, activeDmPartner]);

  const activeThreadMessages = useMemo(() => {
    if (!activeDmPartner) return [];
    return messages.filter(
      (m) =>
        (m.senderId === currentUid && m.recipientId === activeDmPartner.uid) ||
        (m.senderId === activeDmPartner.uid && m.recipientId === currentUid)
    );
  }, [messages, currentUid, activeDmPartner]);

  const canMessageStudent = (target: PublicStudentProfile): boolean => {
    if (!currentUid || target.uid === currentUid) return false;
    if (blockedUids.includes(target.uid)) return false;
    if (target.allowDirectMessages === 'none') return false;
    if (target.allowDirectMessages === 'department') {
      return Boolean(
        myProfile?.department &&
          target.department &&
          myProfile.department.toLowerCase() === target.department.toLowerCase()
      );
    }
    return true;
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPost(true);
    const res = await createCommunityPost({
      postType,
      title,
      body,
      department,
      resourceUrl,
      authorName: myProfile?.displayName,
    });
    setSubmittingPost(false);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setTitle('');
    setBody('');
    setResourceUrl('');
    setComposerOpen(false);
    onNotify('Published to Student Community.');
  };

  const handleAddComment = async (postId: string) => {
    const draft = (replyDrafts[postId] ?? '').trim();
    if (!draft) return;
    const res = await addPostComment({
      postId,
      body: draft,
      authorName: myProfile?.displayName,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createStudyGroup({
      name: groupName,
      subject: groupSubject,
      groupType,
      description: groupDesc,
      meetingSpot: groupSpot,
      creatorName: myProfile?.displayName,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setGroupName('');
    setGroupSubject('');
    setGroupDesc('');
    setGroupSpot('');
    setGroupModalOpen(false);
    onNotify('Study group created.');
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDmPartner || !dmText.trim()) return;
    setSendingDm(true);
    const res = await sendDirectMessage({
      recipientId: activeDmPartner.uid,
      recipientName: activeDmPartner.name,
      text: dmText,
      contextLabel: activeDmPartner.context,
      senderName: myProfile?.displayName,
    });
    setSendingDm(false);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setDmText('');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Student Community
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Discussions, Q&amp;A, study groups, project partners, and privacy-respecting campus messaging.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onSetActiveDmPartner(null);
                setSubTab('feed');
                setComposerOpen((v) => !v);
              }}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap"
            >
              New Post
            </button>
            <button
              type="button"
              onClick={() => {
                onSetActiveDmPartner(null);
                setSubTab('groups');
                setGroupModalOpen((v) => !v);
              }}
              className="h-10 px-3.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap"
            >
              Create Study Group
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B1120] border border-slate-800 rounded-xl p-2">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ['feed', `Discussions (${visiblePosts.length})`],
                ['groups', `Study Groups (${groups.length})`],
                ['directory', `Student Profiles (${profiles.length})`],
                ['messages', `Messages (${conversationPartners.length})`],
              ] as [CommunitySubTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id !== 'messages') onSetActiveDmPartner(null);
                  setSubTab(id);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  effectiveTab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts, students, courses..."
            aria-label="Search community"
            className="h-9 w-full sm:w-64 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* New Post Composer */}
        {composerOpen && (
          <form
            onSubmit={handleCreatePost}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display font-semibold text-sm text-white">
              Create Community Post
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value as CommunityPostType)}
                aria-label="Post type"
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                <option value="discussion">General Discussion</option>
                <option value="question">Ask a Question</option>
                <option value="resource">Share Useful Resource</option>
                <option value="project_partner">Find Project Partner</option>
                <option value="announcement">Campus Announcement</option>
              </select>

              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department / Course (optional, e.g. B.Tech CSE)"
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
              />
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clear headline..."
              required
              className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-sm text-white placeholder:text-slate-400"
            />

            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share details, ask a question, or describe the project team you are building..."
              required
              className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
            />

            {postType === 'resource' && (
              <input
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="Optional study link (https://...)"
                className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPost}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                {submittingPost ? 'Publishing...' : 'Publish Post'}
              </button>
            </div>
          </form>
        )}

        {/* Study Group Composer */}
        {groupModalOpen && (
          <form
            onSubmit={handleCreateGroup}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display font-semibold text-sm text-white">
              Start a Study Group or Project Team
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name (e.g. DSA Evening Prep)"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
              />
              <input
                type="text"
                value={groupSubject}
                onChange={(e) => setGroupSubject(e.target.value)}
                placeholder="Subject / Tech stack"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
              />
              <select
                value={groupType}
                onChange={(e) => setGroupType(e.target.value as StudyGroupType)}
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                <option value="study_group">Study Group</option>
                <option value="project_team">Project Collaboration</option>
                <option value="doubt_circle">Doubt Solving Circle</option>
              </select>
            </div>
            <input
              type="text"
              value={groupSpot}
              onChange={(e) => setGroupSpot(e.target.value)}
              placeholder="Campus meetup spot (optional, e.g. Central Library 1st Floor)"
              className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
            />
            <textarea
              rows={2}
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Goals, timings, and who should join..."
              required
              className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder:text-slate-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Create Group
              </button>
            </div>
          </form>
        )}

        {/* FEED TAB */}
        {effectiveTab === 'feed' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['discussion', 'Discussions'],
                  ['question', 'Questions'],
                  ['resource', 'Resources'],
                  ['project_partner', 'Project Partners'],
                  ['announcement', 'Announcements'],
                ] as [CommunityPostType | 'all', string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPostFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    postFilter === id
                      ? 'bg-violet-600/25 border-violet-500/60 text-violet-200'
                      : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {visiblePosts.length === 0 ? (
              <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
                No community posts yet. Start a discussion, ask a question, or look for project teammates.
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePosts.map((post) => {
                  const postComments = commentsByPostId.get(post.id) ?? [];
                  const liked = currentUid ? post.likedBy.includes(currentUid) : false;
                  const isExpanded = expandedPostId === post.id;
                  const isMine = currentUid === post.authorUid;

                  return (
                    <article
                      key={post.id}
                      className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-blue-400 font-medium">
                            {post.postType.replace('_', ' ')}
                            {post.department ? ` · ${post.department}` : ''}
                            {' · '}
                            {post.authorName}
                            {' · '}
                            <span className="text-slate-400 font-mono">
                              {formatRelativeTime(post.createdAt)}
                            </span>
                          </div>
                          <h3 className="font-display font-semibold text-base text-white mt-1">
                            {post.title}
                          </h3>
                        </div>

                        {!isMine && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              title="Message author"
                              onClick={() => {
                                onSetActiveDmPartner({
                                  uid: post.authorUid,
                                  name: post.authorName,
                                  context: `Post: ${post.title}`,
                                });
                              }}
                              className="p-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-slate-300"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Report post"
                              onClick={async () => {
                                const res = await reportCommunityPost(post);
                                onNotify(res.error ?? 'Post flagged for review.');
                              }}
                              className="p-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Block user"
                              onClick={() => onBlockUser(post.authorUid)}
                              className="p-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                        {post.body}
                      </p>

                      {post.resourceUrl && (
                        <a
                          href={post.resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open shared resource</span>
                        </a>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await toggleLikePost(post);
                              if (res.error) onNotify(res.error);
                            }}
                            className={`flex items-center gap-1.5 text-xs font-medium ${
                              liked ? 'text-rose-400' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                            <span className="tabular-nums">{post.likesCount} Likes</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPostId((prev) =>
                                prev === post.id ? null : post.id
                              )
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="tabular-nums">
                              {postComments.length} Comments
                            </span>
                          </button>
                        </div>

                        {(isMine || isAdmin) && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await deleteCommunityPost(post.id);
                              onNotify(res.error ?? 'Post removed.');
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-3">
                          {postComments.map((c) => (
                            <div key={c.id} className="text-xs space-y-0.5 pl-3 border-l border-slate-700">
                              <div className="text-slate-400">
                                <span className="text-slate-200 font-medium">
                                  {c.authorName}
                                </span>
                                {' · '}
                                {formatRelativeTime(c.createdAt)}
                              </div>
                              <p className="text-slate-300">{c.body}</p>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyDrafts[post.id] ?? ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Write a helpful reply..."
                              className="flex-1 h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddComment(post.id)}
                              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STUDY GROUPS TAB */}
        {effectiveTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.length === 0 ? (
              <div className="md:col-span-2 bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
                No study groups or project teams created yet.
              </div>
            ) : (
              groups.map((grp) => {
                const isMember = currentUid ? grp.memberUids.includes(currentUid) : false;
                return (
                  <div
                    key={grp.id}
                    className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs text-violet-300 font-medium">
                        {grp.groupType.replace('_', ' ')} · {grp.subject}
                      </div>
                      <h3 className="font-display font-semibold text-base text-white">
                        {grp.name}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {grp.description}
                      </p>
                      {grp.meetingSpot && (
                        <div className="text-xs text-slate-400">
                          Meetup: {grp.meetingSpot}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {grp.memberUids.length} members
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await toggleJoinStudyGroup(grp);
                          onNotify(
                            res.error ??
                              (isMember ? 'Left group.' : 'Joined study group!')
                          );
                        }}
                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                          isMember
                            ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isMember ? 'Joined' : 'Join Group'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* DIRECTORY TAB */}
        {effectiveTab === 'directory' && (
          <div className="space-y-4">
            {blockedUids.length > 0 && (
              <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>You have blocked {blockedUids.length} user(s).</span>
                <div className="flex flex-wrap gap-2">
                  {blockedUids.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onUnblockUser(b)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      Unblock {b.slice(0, 6)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles
                .filter((p) => !blockedUids.includes(p.uid))
                .filter((p) => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    p.displayName.toLowerCase().includes(q) ||
                    p.department?.toLowerCase().includes(q) ||
                    p.course?.toLowerCase().includes(q)
                  );
                })
                .map((p) => {
                  const canDm = canMessageStudent(p);
                  return (
                    <div
                      key={p.uid}
                      className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        {p.photoDataUrl ? (
                          <img
                            src={p.photoDataUrl}
                            alt={p.displayName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0">
                            {p.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {p.displayName}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {p.course || p.department || 'JECRC Student'}
                            {p.year ? ` · ${p.year}` : ''}
                          </div>
                        </div>
                      </div>

                      {p.bio && (
                        <p className="text-xs text-slate-300 line-clamp-2">{p.bio}</p>
                      )}

                      {p.interests && p.interests.length > 0 && (
                        <div className="text-[11px] text-slate-400">
                          Interests: {p.interests.join(', ')}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          <span>
                            DMs: {p.allowDirectMessages}
                          </span>
                        </span>
                        {p.uid !== currentUid && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canDm}
                              onClick={() =>
                                onSetActiveDmPartner({
                                  uid: p.uid,
                                  name: p.displayName,
                                })
                              }
                              className="h-8 px-3 rounded-lg bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-xs font-medium text-white"
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              onClick={() => onBlockUser(p.uid)}
                              title="Block student"
                              className="h-8 px-2 rounded-lg bg-[#0F172A] border border-slate-700 text-slate-400 hover:text-rose-300"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* MESSAGES TAB */}
        {effectiveTab === 'messages' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[420px]">
            <div className="md:col-span-4 bg-[#0B1120] border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="px-2 py-1 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Conversations</span>
              </div>
              {conversationPartners.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">
                  Start a private chat from Student Profiles, Posts, Marketplace, or Lost &amp; Found.
                </p>
              ) : (
                conversationPartners.map((partner) => (
                  <button
                    key={partner.uid}
                    type="button"
                    onClick={() =>
                      onSetActiveDmPartner({ uid: partner.uid, name: partner.name })
                    }
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      activeDmPartner?.uid === partner.uid
                        ? 'bg-blue-600/20 border-blue-500/50 text-white'
                        : 'bg-[#0F172A] border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{partner.name}</div>
                    {partner.lastMsg && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {partner.lastMsg.text}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="md:col-span-8 bg-[#0B1120] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              {!activeDmPartner ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400">
                  <BookOpen className="w-6 h-6 text-slate-500 mb-2" />
                  Select a student conversation on the left, or click Message on any profile/listing.
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-[#0F172A]">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {activeDmPartner.name}
                      </div>
                      {activeDmPartner.context && (
                        <div className="text-[11px] text-blue-300">
                          {activeDmPartner.context}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onBlockUser(activeDmPartner.uid);
                        onSetActiveDmPartner(null);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200"
                    >
                      Block User
                    </button>
                  </div>

                  <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[340px]">
                    {activeThreadMessages.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        No messages yet. Say hello — private contact details stay hidden unless you share them.
                      </p>
                    ) : (
                      activeThreadMessages.map((m) => {
                        const mine = m.senderId === currentUid;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs ${
                                mine
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-[#0F172A] border border-slate-800 text-slate-200'
                              }`}
                            >
                              {m.contextLabel && (
                                <div className="text-[10px] opacity-75 mb-0.5">
                                  Re: {m.contextLabel}
                                </div>
                              )}
                              <div>{m.text}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={handleSendDm}
                    className="p-3 border-t border-slate-800 flex gap-2 bg-[#0F172A]"
                  >
                    <input
                      type="text"
                      value={dmText}
                      onChange={(e) => setDmText(e.target.value)}
                      placeholder={`Message ${activeDmPartner.name}...`}
                      className="flex-1 h-10 px-3 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-white"
                    />
                    <button
                      type="submit"
                      disabled={sendingDm}
                      className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
