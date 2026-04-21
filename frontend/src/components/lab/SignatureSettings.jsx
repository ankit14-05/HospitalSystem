import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Upload,
  Save,
  Image as ImageIcon,
  Check,
  Layout,
  MousePointer2,
  Settings2,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { buildServerFileUrl } from '../../utils/fileUrls';

export default function SignatureSettings() {
  const [settings, setSettings] = useState({
    SignaturePreference: 'NewPage',
    SignatureText: '',
    SignatureImagePath: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lab/signature-settings');
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load signature settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('signaturePreference', settings.SignaturePreference);
      formData.append('signatureText', settings.SignatureText || '');
      if (selectedFile) {
        formData.append('signatureImage', selectedFile);
      }

      const res = await api.post('/lab/signature-settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.success) {
        toast.success('Settings saved successfully');
        fetchSettings();
        setSelectedFile(null);
        setPreviewUrl(null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 pointer-events-none opacity-40">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 font-bold text-slate-500">Loading settings...</p>
      </div>
    );
  }

  const signatureImageUrl = previewUrl || buildServerFileUrl(settings.SignatureImagePath);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
              <Settings2 size={20} className="text-teal-600" />
              Signature Configuration
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-500 mb-3 block uppercase tracking-wider">Placement Strategy</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'NewPage', label: 'Dedicated Final Page', icon: Layout, desc: 'Appends a clean approval page at the end of the report.' },
                    { id: 'Corner', label: 'Bottom-Right Stamp', icon: MousePointer2, desc: 'Stamps the signature onto the last page of results.' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSettings((current) => ({ ...current, SignaturePreference: option.id }))}
                      className={[
                        'w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4',
                        settings.SignaturePreference === option.id
                          ? 'border-teal-500 bg-teal-50/50 ring-4 ring-teal-500/10'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className={[
                        'p-3 rounded-xl',
                        settings.SignaturePreference === option.id ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-400',
                      ].join(' ')}>
                        <option.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <p className={[
                          'font-bold text-sm',
                          settings.SignaturePreference === option.id ? 'text-teal-900' : 'text-slate-700',
                        ].join(' ')}>
                          {option.label}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{option.desc}</p>
                      </div>
                      {settings.SignaturePreference === option.id ? <Check className="text-teal-500" size={18} /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-500 mb-2 block uppercase tracking-wider">Official Designation</label>
                <input
                  type="text"
                  placeholder="e.g., Chief Pathologist, Lab Incharge"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-700"
                  value={settings.SignatureText || ''}
                  onChange={(event) => setSettings((current) => ({ ...current, SignatureText: event.target.value }))}
                />
                <p className="text-[10px] text-slate-400 mt-2 font-medium flex items-start gap-1.5 px-1">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  This text will appear below your name on all digitally signed reports.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              'w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all',
              saving
                ? 'bg-slate-100 text-slate-400'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10',
            ].join(' ')}
          >
            {saving ? <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving Changes...' : 'Update Signature Settings'}
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
              <ImageIcon size={20} className="text-teal-600" />
              Scanned Signature
            </h3>

            <div className="flex-1 flex flex-col">
              <div
                className={[
                  'flex-1 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all relative overflow-hidden',
                  signatureImageUrl ? 'border-teal-200 bg-teal-50/20' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {signatureImageUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={signatureImageUrl}
                      alt="Signature Preview"
                      className="max-h-40 object-contain drop-shadow-sm"
                    />
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setSettings((current) => ({ ...current, SignatureImagePath: '' }));
                      }}
                      className="mt-4 text-xs font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
                    >
                      Remove & Replace
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-4 group-hover:text-teal-500 transition-colors">
                      <Upload size={32} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Upload Signature Image</p>
                    <p className="text-xs text-slate-400 mt-1">PNG or JPG, transparent background recommended</p>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </>
                )}
              </div>

              <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500 font-medium leading-relaxed">
                "Tip: Sign on a plain white paper, take a clear photo, and crop it tightly before uploading for the best result on your lab reports."
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
