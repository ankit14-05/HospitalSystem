import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  History, FileText, Pill, FlaskConical, Clipboard, 
  AlertCircle, Activity, Upload, User, Calendar, Droplets
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

import MedicalHistory from '../../components/emr/MedicalHistory';
import DiagnosisReport from '../../components/emr/DiagnosisReport';
import Prescriptions from '../../components/emr/Prescriptions';
import LabReports from '../../components/emr/LabReports';
import ClinicalNotes from '../../components/emr/ClinicalNotes';
import AllergyInfo from '../../components/emr/AllergyInfo';
import MedicationHistory from '../../components/emr/MedicationHistory';
import UploadedDocuments from '../../components/emr/UploadedDocuments';

const EMRPage = () => {
  const { patientId: urlPatientId } = useParams();
  const { user, activePatientProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('history');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolvedPatId, setResolvedPatId] = useState(null);

  // Resolve which patient we are looking at
  // Priority: URL param → activePatientProfile → fetch own profile (for patients)
  useEffect(() => {
    if (urlPatientId) {
      setResolvedPatId(Number(urlPatientId));
      return;
    }
    if (activePatientProfile?.Id) {
      setResolvedPatId(activePatientProfile.Id);
      return;
    }
    // For logged-in patients with no URL param, fetch their own profile
    if (user?.role === 'patient') {
      api.get('/patients/profile')
        .then(res => {
          const profile = res.data?.data || res.data;
          const id = profile?.Id || profile?.id;
          if (id) setResolvedPatId(Number(id));
          else setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [urlPatientId, activePatientProfile, user]);

  const patId = resolvedPatId;

  useEffect(() => {
    if (!patId) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patId}/summary`);
        setSummary(res.data?.data || res.data || res);
      } catch (err) {
        toast.error('Failed to load patient EMR summary');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [patId]);

  const tabs = [
    { id: 'history', label: 'Medical History', icon: History, component: MedicalHistory },
    { id: 'diagnosis', label: 'Diagnosis Report', icon: FileText, component: DiagnosisReport },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill, component: Prescriptions },
    { id: 'lab', label: 'Lab Report', icon: FlaskConical, component: LabReports },
    { id: 'notes', label: 'Clinical Notes', icon: Clipboard, component: ClinicalNotes },
    { id: 'allergies', label: 'Allergy Information', icon: AlertCircle, component: AllergyInfo },
    { id: 'medication', label: 'Medication History', icon: Activity, component: MedicationHistory },
    { id: 'documents', label: 'Uploaded Documents', icon: Upload, component: UploadedDocuments },
  ];

  if (!patId) {
    // For patients: show a loading spinner while resolving their own profile ID
    // For doctors/admins: show 'select a patient' prompt
    if (!loading || user?.role !== 'patient') {
      return (
        <div className="p-12 text-center text-slate-500">
          <User size={48} className="mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-bold">No Patient Selected</h2>
          <p>Please select a patient from the directory to view their EMR.</p>
        </div>
      );
    }
    return (
      <div className="p-12 text-center">
        <div className="spinner w-8 h-8 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">Loading your medical records...</p>
      </div>
    );
  }

  if (loading && !summary) {
    return (
      <div className="p-12 text-center">
        <div className="spinner w-8 h-8 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">Loading patient records...</p>
      </div>
    );
  }

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || MedicalHistory;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Patient Profile Header — shown only for doctors/admins, not for the patient themselves */}
      {summary && user?.role !== 'patient' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold border border-indigo-100 uppercase">
            {summary.FirstName?.[0]}{summary.LastName?.[0]}
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">{summary.FirstName} {summary.LastName}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5 font-mono bg-slate-100 px-2 py-0.5 rounded text-indigo-700 font-bold uppercase tracking-wider">
                UHID: {summary.UHID}
              </span>
              <span className="flex items-center gap-1.5 capitalize">
                <User size={14} /> {summary.Gender}, {summary.Age} yrs
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> Born {summary.DateOfBirth ? new Date(summary.DateOfBirth).toLocaleDateString() : 'Unknown'}
              </span>
              <span className="flex items-center gap-1.5">
                <Droplets size={14} className="text-rose-500" /> {summary.BloodGroup || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Electronic Medical Record (EMR)</h1>
        <p className="text-sm text-slate-500">Comprehensive health and clinical history overview.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        <ActiveComponent patientId={patId} />
      </div>
    </div>
  );
};

export default EMRPage;
