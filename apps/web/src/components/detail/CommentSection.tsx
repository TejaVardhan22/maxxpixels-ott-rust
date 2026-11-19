'use client';

import { useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { useComments, useAddComment, avatarUrl } from '@ott/shared';
import type { Comment } from '@ott/shared';

function firstText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(firstText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstText(record.name ?? record.title ?? record.value ?? '');
  }
  return '';
}

interface Props {
  videoType: number;
  videoId: number;
  subVideoType?: number;
  userId?: number | string;
}

export default function CommentSection({ videoType, videoId, subVideoType = 0, userId }: Props) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const commentsQ = useComments(videoType, videoId, subVideoType);
  const addMut = useAddComment();
  const comments = (commentsQ.data?.result ?? []) as Comment[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId) return;
    await addMut.mutateAsync({
      user_id: userId,
      video_type: videoType,
      video_id: videoId,
      sub_video_type: subVideoType,
      comment: text.trim(),
      ...(replyTo ? { comment_id: replyTo } : {}),
    });
    setText('');
    setReplyTo(null);
  };

  return (
    <section className="mt-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle size={20} /> Comments
      </h3>

      {userId && (
        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 bg-surface border border-ott-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-text focus:outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={!text.trim() || addMut.isPending}
            className="bg-primary hover:bg-primary-dark disabled:opacity-40 text-white rounded-lg px-5 py-3 font-semibold text-sm transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      )}

      <div className="space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <img
              src={avatarUrl(c.user_image)}
              alt=""
              className="w-9 h-9 rounded-full flex-shrink-0 bg-shimmer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{firstText(c.full_name)}</span>
                <span className="text-xs text-muted-text">{firstText(c.created_at)}</span>
              </div>
              <p className="text-sm text-body-text mt-0.5">{firstText(c.comment)}</p>
              <div className="flex gap-4 mt-1">
                <button
                  onClick={() => setReplyTo(c.id ?? null)}
                  className="text-xs text-desc-text hover:text-primary transition-colors"
                >
                  Reply {c.reply_count ? `(${c.reply_count})` : ''}
                </button>
              </div>
            </div>
          </div>
        ))}

        {comments.length === 0 && !commentsQ.isLoading && (
          <p className="text-center text-desc-text text-sm py-8">No comments yet. Be the first!</p>
        )}
      </div>
    </section>
  );
}
