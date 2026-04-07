import React, { useState } from 'react';
import { 
  History, FileText, Pill, FlaskConical, Clipboard, 
  AlertCircle, Activity, Upload 
} from 'lucide-react';
import MedicalHistory from '../../components/emr/MedicalHistory';
import DiagnosisReport from '../../components/emr/DiagnosisReport';
import Prescriptions from '../../components/emr/Prescriptions';
import LabReports from '../../components/emr/LabReports';
import ClinicalNotes from '../../components/emr/ClinicalNotes';
import AllergyInfo from '../../components/emr/AllergyInfo';
import MedicationHistory from '../../components/emr/MedicationHistory';
import UploadedDocuments from '../../components/emr/UploadedDocuments';

const EMRPage = () => {
  const [activeTab, setActiveTab] = useState('history');

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

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || MedicalHistory;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Electronic Medical Record (EMR)</h1>
          <p className="text-sm text-slate-500">Comprehensive health and clinical history overview.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default EMRPage;
