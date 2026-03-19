import React from 'react';
import { Settings, Shield, Bell, User, Lock, Database } from 'lucide-react';
import { Card } from '../../components/ui';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hospital Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage global configurations for the application.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Side Settings Menu */}
        <div className="col-span-1 border border-slate-100 bg-white rounded-3xl p-3 shadow-sm sticky top-6">
          <p className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-50">Preferences</p>
          <div className="flex flex-col gap-1 mt-2">
            {[
              { icon: Settings, label: 'General', active: true },
              { icon: Shield, label: 'Security', active: false },
              { icon: Bell, label: 'Notifications', active: false },
              { icon: User, label: 'Permissions', active: false },
              { icon: Database, label: 'Database & Backups', active: false }
            ].map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={`${active ? 'text-blue-600' : 'text-slate-400'} transition-colors`} />
                  {label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side Config Panel */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-4">General Settings</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Hospital Name</label>
                <input 
                  type="text" 
                  defaultValue="MediCore HMS" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Timezone</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-slate-700 font-semibold bg-white cursor-pointer hover:border-slate-300">
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
              <div className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">Maintenance Mode</p>
                  <p className="text-xs text-slate-400">Put the site down for patients.</p>
                </div>
                <button className="relative w-11 h-6 rounded-full bg-slate-200 transition-colors hover:bg-slate-300">
                  <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
                </button>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
              <Lock size={18} className="text-emerald-500" /> Administrative Security
            </h3>
            <div className="pt-2 flex items-center justify-between pb-4 border-b border-slate-50">
              <div>
                <p className="font-bold text-slate-800 text-sm">Require 2FA for Super Admins</p>
                <p className="text-xs text-slate-400">Enforce two-factor authentication.</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-emerald-500 transition-colors">
                <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
              </button>
            </div>
            
            <div className="pt-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 text-sm">Session Timeout</p>
                <p className="text-xs text-slate-400">Force logout after inactivity.</p>
              </div>
              <select className="w-auto min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-semibold bg-white">
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="120">2 Hours</option>
              </select>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
