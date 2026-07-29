import { logger } from './logger';

export type EventType =
  | 'AUTH_READY'
  | 'COMPANION_SELECTED'
  | 'CONVERSATION_LOADED'
  | 'USER_MESSAGE_SENT'
  | 'AI_MESSAGE_RECEIVED'
  | 'VIDEO_SHARED'
  | 'SUBSCRIPTION_UPDATED';

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
}

export interface AuthReadyEvent extends BaseEvent {
  type: 'AUTH_READY';
  userId: string;
}

export interface CompanionSelectedEvent extends BaseEvent {
  type: 'COMPANION_SELECTED';
  companionId: string;
}

export interface ConversationLoadedEvent extends BaseEvent {
  type: 'CONVERSATION_LOADED';
  messageCount: number;
}

export interface UserMessageSentEvent extends BaseEvent {
  type: 'USER_MESSAGE_SENT';
  contentLength: number;
}

export interface AiMessageReceivedEvent extends BaseEvent {
  type: 'AI_MESSAGE_RECEIVED';
  contentLength: number;
}

export interface VideoSharedEvent extends BaseEvent {
  type: 'VIDEO_SHARED';
  videoUrl: string;
}

export interface SubscriptionUpdatedEvent extends BaseEvent {
  type: 'SUBSCRIPTION_UPDATED';
  tier: string;
}

export type DispatchEvent =
  | Omit<AuthReadyEvent, 'timestamp'>
  | Omit<CompanionSelectedEvent, 'timestamp'>
  | Omit<ConversationLoadedEvent, 'timestamp'>
  | Omit<UserMessageSentEvent, 'timestamp'>
  | Omit<AiMessageReceivedEvent, 'timestamp'>
  | Omit<VideoSharedEvent, 'timestamp'>
  | Omit<SubscriptionUpdatedEvent, 'timestamp'>;

export type ConversationEvent =
  | AuthReadyEvent
  | CompanionSelectedEvent
  | ConversationLoadedEvent
  | UserMessageSentEvent
  | AiMessageReceivedEvent
  | VideoSharedEvent
  | SubscriptionUpdatedEvent;

export interface OrchestratorState {
  currentUserId?: string;
  currentCompanionId?: string;
}

class ConversationOrchestrator {
  private state: OrchestratorState = {};
  private eventHistory: ConversationEvent[] = [];
  private maxHistory = 100;

  dispatch(event: DispatchEvent): void {
    const fullEvent = {
      ...event,
      timestamp: new Date(),
    } as ConversationEvent;

    this.updateState(fullEvent);

    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    logger.info(`[Orchestrator] Event: ${event.type}`, this.getEventLogData(fullEvent));
  }

  private updateState(event: ConversationEvent): void {
    switch (event.type) {
      case 'AUTH_READY':
        this.state.currentUserId = event.userId;
        break;
      case 'COMPANION_SELECTED':
        this.state.currentCompanionId = event.companionId;
        break;
      default:
        break;
    }
  }

  private getEventLogData(event: ConversationEvent): Record<string, unknown> {
    const baseData = {
      currentUserId: this.state.currentUserId,
      currentCompanionId: this.state.currentCompanionId,
    };

    switch (event.type) {
      case 'AUTH_READY':
        return { ...baseData, userId: event.userId };
      case 'COMPANION_SELECTED':
        return { ...baseData, companionId: event.companionId };
      case 'CONVERSATION_LOADED':
        return { ...baseData, messageCount: event.messageCount };
      case 'USER_MESSAGE_SENT':
        return { ...baseData, contentLength: event.contentLength };
      case 'AI_MESSAGE_RECEIVED':
        return { ...baseData, contentLength: event.contentLength };
      case 'VIDEO_SHARED':
        return { ...baseData, videoUrl: event.videoUrl };
      case 'SUBSCRIPTION_UPDATED':
        return { ...baseData, tier: event.tier };
      default:
        return baseData;
    }
  }

  getState(): Readonly<OrchestratorState> {
    return { ...this.state };
  }

  getEventHistory(): readonly ConversationEvent[] {
    return [...this.eventHistory];
  }

  reset(): void {
    this.state = {};
    this.eventHistory = [];
  }
}

export const conversationOrchestrator = new ConversationOrchestrator();
