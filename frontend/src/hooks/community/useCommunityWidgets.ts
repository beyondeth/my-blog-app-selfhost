'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  CommunitySidebarWidget,
  CreateCommunityWidgetInput,
  UpdateCommunityWidgetInput,
  ReorderCommunityWidgetsInput,
} from '@/types/community';
import { communityQueryKeys } from './useCommunities';

const widgetQueryKey = (slug: string, scope: 'public' | 'manage' = 'public') =>
  [...communityQueryKeys.detail(slug), 'widgets', scope] as const;

const invalidateWidgetQueries = (queryClient: ReturnType<typeof useQueryClient>, slug: string) => {
  queryClient.invalidateQueries({ queryKey: widgetQueryKey(slug, 'public') });
  queryClient.invalidateQueries({ queryKey: widgetQueryKey(slug, 'manage') });
};

export function useCommunityWidgets(slug: string) {
  return useQuery<CommunitySidebarWidget[]>({
    queryKey: widgetQueryKey(slug, 'public'),
    queryFn: () => communityService.getCommunityWidgets(slug),
    enabled: Boolean(slug),
  });
}

interface ManageWidgetOptions {
  enabled?: boolean;
}

export function useManageCommunityWidgets(slug: string, options?: ManageWidgetOptions) {
  const enabled = options?.enabled ?? true;
  return useQuery<CommunitySidebarWidget[]>({
    queryKey: widgetQueryKey(slug, 'manage'),
    queryFn: () => communityService.getManageCommunityWidgets(slug),
    enabled: Boolean(slug) && enabled,
  });
}

export function useCreateCommunityWidget(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCommunityWidgetInput) =>
      communityService.createCommunityWidget(slug, dto),
    onSuccess: () => invalidateWidgetQueries(queryClient, slug),
  });
}

export function useUpdateCommunityWidget(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { widgetId: string; dto: UpdateCommunityWidgetInput }) =>
      communityService.updateCommunityWidget(slug, payload.widgetId, payload.dto),
    onSuccess: () => invalidateWidgetQueries(queryClient, slug),
  });
}

export function useDeleteCommunityWidget(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (widgetId: string) =>
      communityService.deleteCommunityWidget(slug, widgetId),
    onSuccess: () => invalidateWidgetQueries(queryClient, slug),
  });
}

export function useReorderCommunityWidgets(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ReorderCommunityWidgetsInput) =>
      communityService.reorderCommunityWidgets(slug, dto),
    onSuccess: () => invalidateWidgetQueries(queryClient, slug),
  });
}

export function useUploadCommunityWidgetImage(slug: string) {
  return useMutation({
    mutationFn: (payload: { widgetId: string; file: File }) =>
      communityService.uploadCommunityWidgetImage(slug, payload.widgetId, payload.file),
  });
}
