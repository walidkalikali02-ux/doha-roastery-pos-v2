import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../App';
import { User, Mail, Save, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ProfileView: React.FC = () => {
  const { t } = useLanguage();
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await updateProfile({
        name: formData.full_name,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-[32px] shadow-sm border border-orange-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t.profile}</h1>
              <p className="text-white/80 text-sm">{t.editProfile || 'Edit your profile'}</p>
            </div>
          </div>
        </div>

        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-sm font-medium">
            {t.changesSaved || 'Changes saved successfully!'}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              <User size={14} />
              {t.name}
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              placeholder={t.name}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              <Mail size={14} />
              {t.email}
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">{t.emailCannotChange || 'Email cannot be changed'}</p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t.saving || 'Saving...'}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {t.save}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-700 mb-2">{t.accountInfo || 'Account'}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t.role}</span>
                <span className="font-bold text-gray-900">{user?.role || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;