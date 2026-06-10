import { useState } from 'react';
import { MessageCircle, ShoppingBag, Gem, ChevronRight } from 'lucide-react';
import type { NpcDef, ShopItem, RPGSave } from './rpgTypes';

interface Props {
  npc: NpcDef;
  save: RPGSave;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
}

export function NpcDialogueModal({ npc, save, onClose, onBuy }: Props) {
  const [lineIndex, setLineIndex] = useState(0);
  const [showShop, setShowShop] = useState(false);

  const currentLine = npc.dialogue[lineIndex];
  const isLast = lineIndex === npc.dialogue.length - 1;

  function advance() {
    if (!isLast) {
      setLineIndex(i => i + 1);
    } else if (npc.shopItems?.length) {
      setShowShop(true);
    } else {
      onClose();
    }
  }

  const roleColor = npc.role === 'merchant' ? 'amber'
    : npc.role === 'sage' ? 'blue'
    : npc.role === 'quest_giver' ? 'emerald'
    : 'red';

  const roleLabel = npc.role === 'merchant' ? 'Merchant'
    : npc.role === 'sage' ? 'Sage'
    : npc.role === 'quest_giver' ? 'Quest Giver'
    : 'Survivor';

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center pb-16 px-6 pointer-events-none">
      <div className="w-full max-w-xl pointer-events-auto">
        {showShop && npc.shopItems ? (
          <ShopPanel
            npc={npc}
            items={npc.shopItems}
            wallet={save.rupeeWallet}
            save={save}
            onBuy={item => { onBuy(item); }}
            onClose={onClose}
            roleColor={roleColor}
          />
        ) : (
          <div className="bg-gradient-to-b from-slate-900/98 to-slate-950/98 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-${roleColor}-950/40`}>
              <div className={`w-8 h-8 rounded-full bg-${roleColor}-600/30 border border-${roleColor}-400/40 flex items-center justify-center`}>
                <MessageCircle size={14} className={`text-${roleColor}-300`} />
              </div>
              <div>
                <span className="text-white font-bold text-sm">{npc.name}</span>
                <span className={`text-${roleColor}-400/70 text-xs ml-2`}>{roleLabel}</span>
              </div>
            </div>

            <div className="px-5 py-4 min-h-[80px] flex items-center">
              <p className="text-white/90 text-sm leading-relaxed">{currentLine}</p>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
              <div className="flex gap-1">
                {npc.dialogue.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lineIndex ? 'bg-white' : 'bg-white/20'}`}
                  />
                ))}
              </div>
              <button
                onClick={advance}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isLast && npc.shopItems?.length ? (
                  <>
                    <ShoppingBag size={13} /> Shop
                  </>
                ) : isLast ? (
                  'Close'
                ) : (
                  <>
                    Next <ChevronRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShopPanel({
  npc, items, wallet, save, onBuy, onClose, roleColor,
}: {
  npc: NpcDef;
  items: ShopItem[];
  wallet: number;
  save: RPGSave;
  onBuy: (item: ShopItem) => void;
  onClose: () => void;
  roleColor: string;
}) {
  function canAfford(item: ShopItem) { return wallet >= item.cost; }
  function alreadyHas(item: ShopItem) {
    if (item.type === 'sword') return save.hasSword;
    if (item.type === 'shield') return save.hasShield;
    if (item.type === 'hookshot') return save.hasHookshot;
    if (item.type === 'bow') return save.hasBow;
    return false;
  }

  return (
    <div className="bg-gradient-to-b from-slate-900/98 to-slate-950/98 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 border-b border-white/8 bg-${roleColor}-950/40`}>
        <div className="flex items-center gap-3">
          <ShoppingBag size={16} className={`text-${roleColor}-300`} />
          <span className="text-white font-bold text-sm">{npc.name}'s Shop</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
          <Gem size={11} className="text-emerald-400" />
          <span className="text-emerald-300 text-sm font-bold font-mono">{wallet}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 gap-2">
        {items.map(item => {
          const owned = alreadyHas(item);
          const affordable = canAfford(item);
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-xl p-3 border transition-all
                ${owned ? 'bg-white/3 border-white/5 opacity-50' :
                  affordable ? 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20' :
                  'bg-white/3 border-white/5 opacity-60'}
              `}
            >
              <div>
                <div className="text-white text-sm font-medium">{item.name}</div>
                <div className="text-white/40 text-xs">{item.description}</div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="flex items-center gap-1 text-emerald-300 font-bold font-mono text-sm">
                  <Gem size={11} className="text-emerald-400" />
                  {item.cost}
                </div>
                <button
                  onClick={() => !owned && affordable && onBuy(item)}
                  disabled={owned || !affordable}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${owned ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' :
                      affordable ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' :
                      'bg-slate-700/50 text-slate-500 cursor-not-allowed'}
                  `}
                >
                  {owned ? 'Owned' : 'Buy'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4 flex justify-end">
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white text-sm transition-colors"
        >
          Leave Shop
        </button>
      </div>
    </div>
  );
}
