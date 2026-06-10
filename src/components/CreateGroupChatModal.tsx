import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Check, MessageCircle } from 'lucide-react';
import { Avatar } from './Avatar';
import { AvatarConfig } from '../types/avatar';
import type { Companion } from '../services/companionService';

interface CreateGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  companions: Companion[];
  onCreateGroup: (name: string, companionIds: string[]) => void;
}

const DEFAULT_AVATAR_IMAGES: Record<string, string> = {
  female: '/images/riley-positive.jpg',
  male: '/images/jake-positive.jpg',
};

export function CreateGroupChatModal({ isOpen, onClose, companions, onCreateGroup }: CreateGroupChatModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleCompanion = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (selectedIds.length < 2 || !groupName.trim()) return;
    onCreateGroup(groupName.trim(), selectedIds);
    setGroupName('');
    setSelectedIds([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">New Group Chat</h2>
                  <p className="text-sm text-gray-400">Select at least 2 companions</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Group Name <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g., The Squad, Movie Night..."
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">Give your group a name so you can find it again later</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Choose Companions ({selectedIds.length} selected)
                </label>
                <div className="space-y-2">
                  {companions.map(companion => {
                    const isSelected = selectedIds.includes(companion.id);
                    return (
                      <button
                        key={companion.id}
                        onClick={() => toggleCompanion(companion.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-teal-400 bg-teal-500/10'
                            : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-600 flex-shrink-0">
                          {companion.avatar_config ? (
                            <Avatar config={companion.avatar_config as AvatarConfig} className="w-full h-full" />
                          ) : (
                            <img
                              src={DEFAULT_AVATAR_IMAGES[companion.gender]}
                              alt={companion.custom_name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="text-white font-semibold">{companion.custom_name}</h3>
                          <span className="text-xs text-gray-400 capitalize">{companion.relationship_type}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-teal-500 border-teal-500'
                            : 'border-gray-500'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700">
              <button
                onClick={handleCreate}
                disabled={selectedIds.length < 2 || !groupName.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg"
              >
                <MessageCircle className="w-5 h-5" />
                {!groupName.trim()
                  ? 'Enter a group name to continue'
                  : selectedIds.length < 2
                  ? `Select ${2 - selectedIds.length} more companion${selectedIds.length === 0 ? 's' : ''}`
                  : 'Start Group Chat'
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
