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
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <MessageCircle size={19} className="text-[#FF6D2E]" /> Comments
      </h3>

      {userId && (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 rounded-md border border-white/15 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF6D2E] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || addMut.isPending}
            className="rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      )}

      <div className="space-y-4">
        {comments.map((c) => (
          <div
            key={c.id}
            className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#141414] p-3.5"
          >
            <img
              src={avatarUrl(c.user_image)}
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-full bg-[#1F1F1F] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{firstText(c.full_name)}</span>
                <span className="text-xs text-zinc-500">{firstText(c.created_at)}</span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-300">{firstText(c.comment)}</p>
              <div className="mt-1 flex gap-4">
                <button
                  onClick={() => setReplyTo(c.id ?? null)}
                  className="text-xs font-semibold text-zinc-400 transition-colors hover:text-[#FF6D2E]"
                >
                  Reply {c.reply_count ? `(${c.reply_count})` : ''}
                </button>
              </div>
            </div>
          </div>
        ))}

        {comments.length === 0 && !commentsQ.isLoading && (
          <p className="py-8 text-center text-sm text-zinc-500">
            No comments yet. Be the first!
          </p>
        )}
      </div>
    </section>
  );
}
