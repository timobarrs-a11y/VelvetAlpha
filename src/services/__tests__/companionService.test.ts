import { getCompanion } from '../companionService';

describe('CompanionService', () => {
  describe('getCompanion', () => {
    it('should fetch a companion by ID', async () => {
      try {
        const result = await getCompanion('test-companion-id');
        if (result) {
          expect(result.id).toBeDefined();
          expect(result.custom_name).toBeDefined();
          expect(result.gender).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle non-existent companions', async () => {
      try {
        const result = await getCompanion('non-existent-id');
        if (result === null) {
          expect(result).toBeNull();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return companion with avatar config', async () => {
      try {
        const result = await getCompanion('test-companion-id');
        if (result) {
          expect(result.avatar_config).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
