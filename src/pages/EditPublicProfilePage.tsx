import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PublicProfileSettings } from '../components/PublicProfileSettings';

export default function EditPublicProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="ds-page text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[rgba(12,10,30,0.8)] backdrop-blur-sm">
        <button onClick={() => navigate('/my-profile')} className="p-2 rounded-lg hover:bg-white/8 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold">Edit Public Profile</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Your public profile</h1>
          <p className="text-sm text-white/40">Control how other members see you. Everything here is visible to anyone who visits your profile.</p>
        </div>
        <PublicProfileSettings />
      </div>
    </div>
  );
}
