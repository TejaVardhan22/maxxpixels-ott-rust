'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engagementApi, catalogApi } from '../api/services';
import { queryKeys } from '../queryKeys';

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.addComment(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); },
  });
}

export function useEditComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.editComment(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.deleteComment(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments'] }); },
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.addRemoveBookmark(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bookmarks });
      qc.invalidateQueries({ queryKey: ['contentDetail'] });
      qc.invalidateQueries({ queryKey: ['stream'] });
    },
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.addRemoveLike(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contentDetail'] }); },
  });
}

export function useAddVideoView() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.addVideoView(body),
  });
}

export function useAddContinueWatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.addContinueWatching(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.continueWatching });
      qc.invalidateQueries({ queryKey: ['stream', 'continue'] });
    },
  });
}

export function useRemoveContinueWatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => engagementApi.removeContinueWatching(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.continueWatching });
      qc.invalidateQueries({ queryKey: ['stream', 'continue'] });
    },
  });
}

export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => catalogApi.readNotification(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
      qc.invalidateQueries({ queryKey: ['stream', 'notifications'] });
    },
  });
}

export function useComments(videoType: number, videoId: number, subVideoType = 0, pageNo = 1) {
  return useQuery({
    queryKey: ['comments', videoType, videoId, subVideoType, pageNo],
    queryFn: () => engagementApi.getComment({
      video_type: videoType,
      video_id: videoId,
      sub_video_type: subVideoType,
      page_no: pageNo,
    }),
    enabled: videoId > 0,
  });
}

export function useReplyComments(commentId: number, pageNo = 1) {
  return useQuery({
    queryKey: ['replyComments', commentId, pageNo],
    queryFn: () => engagementApi.getReplyComment({
      comment_id: commentId,
      page_no: pageNo,
    }),
    enabled: commentId > 0,
  });
}
