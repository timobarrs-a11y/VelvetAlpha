import { analyticsService } from './analyticsService';

export type CustomizerContext = 'user' | 'companion' | 'demo';

export function trackOpenCustomizer(context: CustomizerContext): void {
  analyticsService.trackEvent({
    action_type: 'feature_used',
    action_target: 'avatar_creator',
    page_path: window.location.pathname,
    metadata: { event: 'open_customizer', context },
  });
}

export function trackApplyPreset(presetId: string, presetName: string): void {
  analyticsService.trackEvent({
    action_type: 'button_clicked',
    action_target: 'avatar_apply_preset',
    page_path: window.location.pathname,
    metadata: { event: 'apply_preset', preset_id: presetId, preset_name: presetName },
  });
}

export function trackRandomize(): void {
  analyticsService.trackEvent({
    action_type: 'button_clicked',
    action_target: 'avatar_randomize',
    page_path: window.location.pathname,
    metadata: { event: 'randomize' },
  });
}

export function trackSaveAvatar(context: CustomizerContext): void {
  analyticsService.trackEvent({
    action_type: 'form_submitted',
    action_target: 'avatar_save',
    page_path: window.location.pathname,
    metadata: { event: 'save_avatar', context },
  });
}

export function trackSkipAvatar(context: CustomizerContext): void {
  analyticsService.trackEvent({
    action_type: 'button_clicked',
    action_target: 'avatar_skip',
    page_path: window.location.pathname,
    metadata: { event: 'skip_avatar', context },
  });
}
