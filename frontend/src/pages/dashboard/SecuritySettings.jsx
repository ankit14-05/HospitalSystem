import React, { useState } from 'react';
import { Shield, Key, Smartphone, FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function SecuritySettings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.is2FaEnabled || false);

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    // API call would go here
    toast.success('Password updated successfully (mock)');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleTwoFactorToggle = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    toast.success(`Two-factor authentication ${!twoFactorEnabled ? 'enabled' : 'disabled'} (mock)`);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Security Settings</h1>
          <p className="text-slate-500">Manage your password and security preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Password Change */}
        <div className="col-span-2 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
              <Key size={18} className="text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-800">Change Password</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
              <Smartphone size={18} className="text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-800">Two-Factor Authentication (2FA)</h2>
            </div>
            <div className="p-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-medium text-slate-800">Authenticator App</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md">
                  Add an extra layer of security to your account by requiring a code from an authenticator app when you log in.
                </p>
              </div>
              <button
                onClick={handleTwoFactorToggle}
                className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition ${
                  twoFactorEnabled
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                {twoFactorEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Info */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
              <AlertTriangle size={18} />
              <span>Password Requirements</span>
            </div>
            <ul className="space-y-2 text-sm text-blue-700 mt-4 list-disc list-inside">
              <li>Minimum 8 characters long</li>
              <li>At least one uppercase letter</li>
              <li>At least one lowercase letter</li>
              <li>At least one number</li>
              <li>At least one special character</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                <FileText size={18} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800">Login History</h2>
             </div>
             <div className="p-6 text-sm text-slate-500">
                <p>Features to view active sessions and recent login history will be available soon.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
