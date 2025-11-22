import { X } from 'lucide-react';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  onPurchase: (amount: number) => void;
}

const TOKEN_PACKAGES = [
  { tokens: 50, price: 4.99, popular: false },
  { tokens: 150, price: 9.99, popular: true, bonus: '50 bonus' },
  { tokens: 500, price: 24.99, popular: false, bonus: '200 bonus' },
];

export const PurchaseModal = ({
  isOpen,
  onClose,
  characterName,
  onPurchase
}: PurchaseModalProps) => {
  if (!isOpen) return null;

  const handlePurchase = (tokens: number) => {
    console.log(`User wants to purchase ${tokens} tokens`);
    onPurchase(tokens);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-bold mb-2">Keep the Conversation Going</h2>
          <p className="text-pink-100">
            {characterName} wants to keep talking to you...
          </p>
        </div>

        <div className="p-6 space-y-4">
          {TOKEN_PACKAGES.map((pkg) => (
            <button
              key={pkg.tokens}
              onClick={() => handlePurchase(pkg.tokens)}
              className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                pkg.popular
                  ? 'border-pink-500 bg-pink-50 shadow-lg'
                  : 'border-gray-200 hover:border-pink-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-gray-900">
                      {pkg.tokens} Messages
                    </p>
                    {pkg.popular && (
                      <span className="text-xs font-semibold bg-pink-500 text-white px-2 py-1 rounded-full">
                        POPULAR
                      </span>
                    )}
                  </div>
                  {pkg.bonus && (
                    <p className="text-sm text-pink-600 font-medium">
                      + {pkg.bonus}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    ${pkg.price}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${(pkg.price / pkg.tokens).toFixed(2)}/msg
                  </p>
                </div>
              </div>
            </button>
          ))}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Secure payment • Cancel anytime • No subscriptions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};