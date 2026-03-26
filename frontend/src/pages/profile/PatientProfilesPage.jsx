import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, MapPin, Bed, TrendingUp, Phone, Plus, UserRound, ArrowRight, LogOut 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Colour helpers (Identical to LoginPage) ───────────────────────────────────
function shiftColor(hex, amt) {
  try {
    const n = parseInt((hex || '#6d28d9').replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (n >> 16)        + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff)        + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex || '#6d28d9'; }
}

const FloatCard = ({ icon: Icon, value, label, delay }) => (
  <div
    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/8 shadow-xl backdrop-blur-md"
    style={{ animation: `lp-up .65s ease both`, animationDelay: delay }}>
    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
      <Icon size={15} className="text-white" />
    </div>
    <div>
      <p className="text-white font-bold text-sm leading-none">{value}</p>
      <p className="text-white/45 text-xs mt-0.5">{label}</p>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function PatientProfilesPage() {
  const navigate = useNavigate();
  const { branding } = useHospitalBranding(1);
  const {
    patientProfiles,
    activePatientProfile,
    refreshCurrentUser,
    switchPatientProfile,
    logout,
  } = useAuth();
  
  const [loadingId, setLoadingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const year    = new Date().getFullYear();
  const primary = branding?.primaryColor || '#6d28d9';
  const deep    = shiftColor(primary, -65);

  useEffect(() => {
    if (!patientProfiles.length) {
      setRefreshing(true);
      refreshCurrentUser().finally(() => setRefreshing(false));
    }
  }, [patientProfiles.length, refreshCurrentUser]);

  const handleSwitch = async (patientId) => {
    setLoadingId(patientId);
    try {
      await switchPatientProfile(patientId);
      navigate('/dashboard/patient', { replace: true });
    } finally {
      setLoadingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const activeId = activePatientProfile?.patientId;

  return (
    <>
      <style>{`
        @keyframes lp-up {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes lp-orb1 {
          0%,100% { transform:scale(1);    opacity:.12; }
          50%      { transform:scale(1.15); opacity:.06; }
        }
        @keyframes lp-orb2 {
          0%,100% { transform:translate(0,0); }
          40%     { transform:translate(14px,-10px); }
          80%     { transform:translate(-8px,12px); }
        }
        .profile-card {
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .profile-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,.08);
          border-color: ${primary}55;
        }
      `}</style>

      {/* Root: fixed full viewport, no overflow */}
      <div className="h-screen w-screen flex overflow-hidden" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>

        {/* ═══════════════ LEFT — Immersive brand panel ═══════════════════ */}
        <div
          className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col relative overflow-hidden flex-shrink-0"
          style={{ background:`linear-gradient(155deg, ${primary} 0%, ${deep} 100%)` }}>

          {/* Animated orbs */}
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white pointer-events-none"
            style={{ opacity:.1, animation:'lp-orb1 7s ease-in-out infinite' }} />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white pointer-events-none"
            style={{ opacity:.07, animation:'lp-orb1 9s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none"
            style={{ opacity:.04, animation:'lp-orb2 14s ease-in-out infinite' }} />

          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:'radial-gradient(rgba(255,255,255,.35) 1px, transparent 1px)',
              backgroundSize:'26px 26px',
              opacity:.08,
            }} />

          {/* Diagonal sheen */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -right-16 top-0 bottom-0 w-32 opacity-10"
              style={{ background:'linear-gradient(to bottom,transparent,white 50%,transparent)', transform:'skewX(-6deg)' }} />
          </div>

          <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">

            {/* Logo */}
            <div className="flex items-center gap-3.5 mb-10"
              style={{ animation:'lp-up .55s ease both' }}>
              {branding?.logoUrl
                ? <img src={branding.logoUrl} alt="logo"
                    className="w-12 h-12 rounded-2xl object-contain bg-white/15 border border-white/20 p-1.5" />
                : <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Activity size={22} className="text-white" strokeWidth={2.5} />
                  </div>
              }
              <div>
                <p className="text-white font-bold text-xl leading-tight">{branding?.name || 'MediCore HMS'}</p>
                <p className="text-white/40 text-xs tracking-wide">{branding?.shortName || 'Hospital Management System'}</p>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-8" style={{ animation:'lp-up .55s ease .08s both' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-sm mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation:'lp-orb1 2s ease-in-out infinite' }} />
                <span className="text-white/75 text-xs font-semibold tracking-wide">Secure Family Access</span>
              </div>

              <h2 className="text-white font-bold leading-[1.12] mb-3" style={{ fontSize:'clamp(24px,2.6vw,34px)' }}>
                Your Health,<br />
                Your Family,<br />
                <span className="text-white/40">Connected.</span>
              </h2>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Manage appointments, view medical records, and coordinate care for everyone in your household seamlessly.
              </p>
            </div>

            {/* Stat cards */}
            <div className="space-y-2 mb-8 hidden xl:block">
              {branding?.bedCapacity && <FloatCard icon={Bed} value={`${branding.bedCapacity}+ Beds`} label="Total hospital capacity" delay=".18s" />}
              <FloatCard icon={TrendingUp} value="Real-time Updates" label="Instant access to reports" delay=".34s" />
              {branding?.emergencyNumber && <FloatCard icon={Phone} value={branding.emergencyNumber} label="24/7 Emergency line" delay=".42s" />}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-white/10"
              style={{ animation:'lp-up .55s ease .6s both' }}>
              {branding?.city && (
                <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
                  <MapPin size={10} />
                  <span>{[branding.city, branding.stateName].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <p className="text-white/20 text-xs">© {year} {branding?.name || 'MediCore HMS'} · All rights reserved</p>
            </div>
          </div>
        </div>

        {/* ═══════════════ RIGHT — Profile Selection ════════════════ */}
        <div className="flex-1 flex flex-col justify-center bg-slate-50 overflow-y-auto w-full relative">
          
          <button 
            onClick={handleLogout}
            className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 transition"
          >
            <LogOut size={16} />
            <span className="text-sm font-bold">Sign Out</span>
          </button>

          <div className="w-full max-w-2xl px-8 mx-auto" style={{ animation:'lp-up .6s ease .12s both' }}>
            
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-7 lg:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:primary }}>
                <Activity size={17} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-800 text-base">{branding?.name || 'MediCore HMS'}</span>
            </div>

            {/* Heading */}
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-1.5">Select Profile</h2>
              <p className="text-slate-400 text-sm font-semibold">Who is accessing care today?</p>
            </div>

            {/* Profiles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Actual Profiles */}
              {patientProfiles.map((profile) => {
                const isActive = profile.patientId === activeId;
                const isLoading = loadingId === profile.patientId;
                return (
                  <button
                    key={profile.patientId}
                    disabled={loadingId !== null}
                    onClick={() => (isActive ? navigate('/dashboard/patient', { replace: true }) : handleSwitch(profile.patientId))}
                    className={`profile-card flex flex-col items-center justify-center text-center p-6 rounded-[22px] border bg-white overflow-hidden relative cursor-pointer
                      ${isActive ? 'ring-2' : ''}`}
                    style={{ borderColor: isActive ? primary : '#e2e8f0', boxShadow: isActive ? `0 0 0 4px ${primary}1A` : '' }}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase"
                        style={{ backgroundColor: `${primary}15`, color: primary }}>
                        Active
                      </div>
                    )}
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: `${primary}10`, color: primary }}>
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primary, borderTopColor: 'transparent' }} />
                      ) : (
                        <UserRound size={26} />
                      )}
                    </div>
                    <h3 className="text-[17px] font-bold text-slate-900 leading-tight">{profile.fullName}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{profile.relationshipToUser || 'Self'}</p>
                    
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold transition-opacity opacity-0 group-hover:opacity-100"
                      style={{ color: primary }}>
                      Enter Dashboard <ArrowRight size={13} />
                    </div>
                  </button>
                );
              })}

              {/* Add New Profile */}
              <button
                onClick={() => navigate('/patient/family/add')}
                className="profile-card flex flex-col items-center justify-center text-center p-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50/50 hover:bg-white cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-slate-100 text-slate-400 group-hover:bg-slate-200 transition-colors">
                  <Plus size={26} />
                </div>
                <h3 className="text-[17px] font-bold text-slate-700 leading-tight">Add Family Member</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">Register a new dependent</p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Register <ArrowRight size={13} />
                </div>
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
