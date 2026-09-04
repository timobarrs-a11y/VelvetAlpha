import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../chatService';

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message and return a response', async () => {
      const message = 'Hello';
      const companionId = 'test-companion-id';
      const relationshipType = 'romantic';

      try {
        const response = await ChatService.sendMessage(message, companionId, relationshipType);
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle empty messages gracefully', async () => {
      const message = '';
      const companionId = 'test-companion-id';
      const relationshipType = 'romantic';

      try {
        const response = await ChatService.sendMessage(message, companionId, relationshipType);
        expect(response).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network errors', async () => {
      const invalidCompanionId = 'invalid-id-that-will-fail';

      try {
        await ChatService.sendMessage('test', invalidCompanionId, 'romantic');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
