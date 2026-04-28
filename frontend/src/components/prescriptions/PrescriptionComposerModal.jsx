import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Loader,
  PenLine,
  Pill,
  Plus,
  Printer,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';
import './PrescriptionPrint.css';

const FREQS = [
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'SOS / as needed',
  'Before food',
  'After food',
  'At bedtime',
];

const ROUTES = ['Oral', 'Topical', 'Injection', 'Inhalation', 'IV', 'Other'];

const SIGNATURE_PREFS = [
  { id: 'Stamp', label: 'Bottom-Right Stamp' },
  { id: 'NewPage', label: 'Dedicated Last Page' },
  { id: 'TextOnly', label: 'Text Only' },
];

const createInitialItem = () => ({
  localId: Math.random().toString(36).substr(2, 9),
  medicineName: '',
  genericName: '',
  dosage: '',
  schedule: '',
  instruction: '',
  route: 'Oral',
  days: '',
  quantity: '',
});

const createLabTestItem = () => ({
  localId: Math.random().toString(36).substr(2, 9),
  testName: '',
  criteria: '',
  details: '',
});

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const trimString = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseJson = (value, fallback = {}) => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch {
    return fallback;
  }
};

const toDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const normalizeTextObject = (obj = {}) => {
  const normalized = {};
  Object.entries(obj).forEach(([key, value]) => {
    const clean = trimString(value);
    if (clean != null) normalized[key] = clean;
  });
  return normalized;
};

const resolvePatientId = (patient) =>
  patient?.PatientId || patient?.patientId || patient?.ProfileId || patient?.profileId || patient?.Id || patient?.id || null;

const resolvePatientName = (patient) =>
  patient?.PatientFullName ||
  patient?.PatientName ||
  patient?.Name ||
  patient?.name ||
  `${patient?.PatientFirstName || patient?.firstName || ''} ${patient?.PatientLastName || patient?.lastName || ''}`.trim() ||
  'Patient';

const resolveDoctorName = (patient) =>
  patient?.DoctorName ||
  patient?.doctorName ||
  `${patient?.DoctorFirstName || ''} ${patient?.DoctorLastName || ''}`.trim() ||
  'Doctor';

const resolveAppointmentId = (patient, appointmentId) =>
  appointmentId || patient?.AppointmentId || patient?.appointmentId || null;

const resolvePrescriptionId = (patient, prescriptionId) =>
  prescriptionId || patient?.LatestPrescriptionId || patient?.latestPrescriptionId || null;

const resolveAgeSex = (patient) => {
  const age = patient?.Age || patient?.age || patient?.PatientAge || patient?.patientAge || null;
  const sex = patient?.Gender || patient?.gender || patient?.Sex || patient?.sex || null;
  return [trimString(age), trimString(sex)].filter(Boolean).join(' / ') || null;
};

const resolveApiOrigin = () => {
  const base = import.meta.env.VITE_API_URL || '';
  if (!/^https?:\/\//i.test(base)) return '';
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
};

const API_ORIGIN = resolveApiOrigin();

const buildAssetUrl = (filePath) => {
  const clean = trimString(filePath);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${API_ORIGIN}${clean}`;
};

const createInitialForm = ({
  patient,
  patientName,
  doctorName,
  initialDiagnosis,
  initialNotes,
  initialValidUntil,
}) => ({
  header: {
    hospitalName: trimString(patient?.HospitalName || patient?.hospitalName) || 'Hospital',
    location: trimString(patient?.HospitalName || patient?.hospitalName) || 'Main Campus',
    pageLabel: 'Page 1 of 1',
    referredBy: 'SELF',
    invoiceNo: '',
    date: '',
    patientName,
    ageSex: resolveAgeSex(patient) || '',
    maxId: trimString(patient?.UHID || patient?.uhid) || '',
    doctorName,
    department: trimString(patient?.DepartmentName || patient?.departmentName) || '',
    speciality: trimString(patient?.Specialization || patient?.speciality) || '',
    allergy: trimString(patient?.KnownAllergies || patient?.knownAllergies) || '',
  },
  vitals: {
    bp: '',
    pulse: '',
    spo2: '',
    fallRisk: '0',
    temperature: '',
    weight: '',
  },
  sections: {
    chiefComplaints: '',
    historyPresentIllness: '',
    pastHistory: '',
    clinicalNotes: initialNotes || '',
    procedure: '',
    diagnosis: initialDiagnosis || '',
    medicineAdvised: '',
  },
  medicineNotes: '',
  labValues: {
    inr: '',
    salb: '',
    albuminNote: '',
    other: '',
  },
  followUp: {
    instructions: '',
    when: toDateInput(initialValidUntil),
  },
  amendReason: '',
  items: [createInitialItem()],
  labTests: [createLabTestItem()],
});

const normalizeItemFromAny = (item = {}) => ({
  localId: Math.random().toString(36).substr(2, 9),
  medicineName: item.medicineName || item.MedicineName || item.drugName || item.name || '',
  genericName: item.genericName || item.GenericName || item.generic || '',
  dosage: item.dosage || item.Dosage || item.dose || '',
  schedule: item.schedule || item.frequency || item.Frequency || '',
  instruction: item.instruction || item.instructions || item.Instructions || item.notes || '',
  route: item.route || item.Route || 'Oral',
  days: item.days || item.Duration || item.duration || '',
  quantity: item.quantity || item.Quantity || '',
});

const normalizeSignatureSettings = (settings = {}) => ({
  SignaturePreference: settings.SignaturePreference || settings.signaturePreference || 'Stamp',
  SignatureText: settings.SignatureText || settings.signatureText || '',
  SignatureImagePath: settings.SignatureImagePath || settings.signatureImagePath || '',
});

const hasNonEmpty = (value) => trimString(value) != null;

function SectionPreview({ title, text, isInline = false }) {
  if (!hasNonEmpty(text)) return null;

  if (isInline) {
    return (
      <div className="mb-2.5 text-[12px] text-slate-900">
        <u className="font-bold">{title}:</u> {text}
      </div>
    );
  }

  return (
    <div className="mb-2.5 text-[12px] text-slate-900">
      <u className="font-bold">{title}</u>
      <p className="whitespace-pre-line leading-5 mt-0.5">{text}</p>
    </div>
  );
}

function PrescriptionPrintSheet({ model, signatureImageUrl }) {
  return (
    <div className="rx-print-sheet mx-auto bg-white text-slate-900 shadow-xl relative px-8 py-6">
      <table className="w-full border-none border-collapse">
        {/* REPEATING HEADER */}
        <thead className="display-table-header-group">
          <tr>
            <td>
              <div className="border-b border-slate-400 pb-3 mb-3">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#003b5c] text-white flex items-center justify-center font-bold text-xl leading-none pt-1 shadow-sm">
                      +
                    </div>
                    <div>
                      <p className="text-3xl font-black tracking-tight text-[#003b5c] leading-none">MAX</p>
                      <p className="text-[14px] font-semibold tracking-wide text-slate-700 leading-none">Healthcare</p>
                    </div>
                    <div className="ml-4 border-l border-slate-400 pl-4">
                      <p className="text-xl font-black text-[#003b5c] leading-none flex items-center gap-2">
                        <span className="text-4xl text-slate-300">25</span>
                        <span className="text-[9px] font-bold uppercase leading-tight text-[#003b5c]">YEARS OF<br />SERVICE AND<br />EXCELLENCE</span>
                      </p>
                    </div>
                  </div>
                  {model.rxNumber ? <div className="text-xl font-medium text-slate-600 handwritten-style px-2">{model.rxNumber}</div> : null}
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-8 text-[12px] leading-[1.6]">
                  <div className="space-y-0.5 text-left">
                    <p>Patient Name: &nbsp;&nbsp;{model.patientName || '-'}</p>
                    <p>Age / Sex: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{model.ageSex || '-'}</p>
                    <p>MaxId: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{model.maxId || '-'}</p>
                    <p>Doctor Name: &nbsp;&nbsp;{model.doctorName || '-'}</p>
                    <p>Department: &nbsp;&nbsp;&nbsp;{model.department || '-'}</p>
                  </div>
                  <div className="text-right space-y-0.5 text-slate-800">
                    <p className="mb-2">{model.pageLabel || 'Page 1 of 1'}</p>
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 text-left">
                      <span>Location:</span> <span>{model.location || '-'}</span>
                      <span>Date:</span> <span>{model.dateLabel}</span>
                      <span>Invoice No:</span> <span>{model.invoiceNo || '-'}</span>
                      <span>Referred By:</span> <span>{model.referredBy || '-'}</span>
                      <span>Speciality:</span> <span>{model.speciality || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 border border-slate-400 py-1.5 px-3 text-[12px] font-semibold text-slate-800 flex flex-wrap gap-x-6 gap-y-2 items-center bg-slate-50/50">
                <span>BP: {model.vitals.bp || '-'}</span>
                <span>Pulse: {model.vitals.pulse || '-'}</span>
                <span>SPO2: {model.vitals.spo2 || '-'}</span>
                <span>Fall Risk Assessment: {model.vitals.fallRisk || '0'}</span>
              </div>
            </td>
          </tr>
        </thead>

        {/* MAIN CONTENT */}
        <tbody>
          <tr>
            <td className="py-2">
              <div className="min-h-[500px]">
                <SectionPreview title="Allergy" text={model.allergy || 'No Known Allergy'} isInline />
                <SectionPreview title="Chief Complaints" text={model.sections.chiefComplaints} />
                <SectionPreview title="History of Present Illness" text={model.sections.historyPresentIllness} />
                <SectionPreview title="Past History" text={model.sections.pastHistory} />
                <SectionPreview title="Clinical Notes / Old Reports" text={model.sections.clinicalNotes} />
                <SectionPreview title="Procedure" text={model.sections.procedure} />

                {model.sections.diagnosis ? (
                  <div className="mb-2.5">
                    <SectionPreview title="Diagnosis" text={model.sections.diagnosis} />
                  </div>
                ) : null}

                {hasNonEmpty(model.sections.medicineAdvised) || model.items.length > 0 ? (
                  <div className="mt-4 mb-2.5 break-inside-avoid">
                    <u className="text-[12px] font-bold text-slate-900">Medicine Advised</u>
                    {hasNonEmpty(model.sections.medicineAdvised) ? (
                      <p className="whitespace-pre-line text-[12px] leading-5 text-slate-900 mt-1">{model.sections.medicineAdvised}</p>
                    ) : null}

                    {model.items.length > 0 ? (
                      <div className="mt-2.5">
                        <table className="w-full border-collapse text-[11px] text-slate-900 border border-slate-400">
                          <thead>
                            <tr className="bg-slate-100/50">
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold w-10">Sno</th>
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Medicine</th>
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Schedule</th>
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Instruction</th>
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Route</th>
                              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Days</th>
                            </tr>
                          </thead>
                          <tbody>
                            {model.items.map((item, index) => (
                              <tr key={item.localId || `item-${index}`} className="break-inside-avoid">
                                <td className="border border-slate-400 px-2 py-1.5 align-top">{index + 1}</td>
                                <td className="border border-slate-400 px-2 py-1.5 align-top">
                                  <span className="font-semibold">{item.medicineName || '-'}</span>
                                  {item.dosage ? ` ${item.dosage}` : ''}
                                  {item.genericName ? <div className="text-[10px] mt-0.5 uppercase text-slate-700">({item.genericName})</div> : null}
                                </td>
                                <td className="border border-slate-400 px-2 py-1.5 align-top">{item.schedule ? item.schedule.toUpperCase() : '-'}</td>
                                <td className="border border-slate-400 px-2 py-1.5 align-top">{item.instruction || '-'}</td>
                                <td className="border border-slate-400 px-2 py-1.5 align-top">{item.route ? item.route.toUpperCase() : 'ORAL'}</td>
                                <td className="border border-slate-400 px-2 py-1.5 align-top">{item.days || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {model.labTests && model.labTests.length > 0 ? (
                  <div className="mt-4 mb-2.5 break-inside-avoid">
                    <u className="text-[12px] font-bold text-slate-900">Lab Tests Advised</u>
                    <table className="w-full border-collapse text-[11px] text-slate-900 border border-slate-400 mt-2.5">
                      <thead>
                        <tr className="bg-slate-100/50">
                          <th className="border border-slate-400 px-2 py-1.5 text-left font-bold w-10">S.NO</th>
                          <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Test Name</th>
                          <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Criteria for Testing</th>
                          <th className="border border-slate-400 px-2 py-1.5 text-left font-bold">Additional Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.labTests.map((test, index) => (
                          <tr key={test.localId || `test-${index}`} className="break-inside-avoid">
                            <td className="border border-slate-400 px-2 py-1.5 align-top">{index + 1}</td>
                            <td className="border border-slate-400 px-2 py-1.5 align-top font-semibold">{test.testName || '-'}</td>
                            <td className="border border-slate-400 px-2 py-1.5 align-top">{test.criteria || '-'}</td>
                            <td className="border border-slate-400 px-2 py-1.5 align-top">{test.details || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {(model.followUp.instructions || model.followUp.when) ? (
                  <div className="mt-4 text-[12px] text-slate-900 break-inside-avoid">
                    <u className="font-bold">Follow Up</u>
                    <div className="mt-1 whitespace-pre-line leading-5">
                      {model.followUp.instructions ? `${model.followUp.instructions}\n` : ''}
                      {model.followUp.when ? `Next review: ${model.followUp.when}` : ''}
                    </div>
                  </div>
                ) : null}

                <div className="mt-12 mb-8 flex justify-end break-inside-avoid">
                  <div className="w-64 text-right">
                    {signatureImageUrl && model.signaturePreference !== 'TextOnly' ? (
                      <img src={signatureImageUrl} alt="Doctor signature" className="ml-auto mb-1 h-14 object-contain mix-blend-multiply" />
                    ) : null}
                    <div className="pt-1 text-[11px] text-slate-800 font-semibold leading-tight text-right">
                      <p className="text-[13px]">{model.signatureText || model.doctorName || 'Doctor'}</p>
                      {model.speciality ? <p className="font-normal mt-0.5">{model.speciality}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        {/* REPEATING FOOTER */}
        <tfoot className="display-table-footer-group">
          <tr>
            <td>
              <div className="mt-6 pt-3 border-t border-slate-400 text-[10px] text-slate-700 leading-snug grid grid-cols-2 gap-4">
                <div className="text-left">
                  <p className="font-bold text-slate-900">Max Super Speciality Hospital, Noida</p>
                  <p>(A Unit of Crosslay Remedies Limited)</p>
                  <p>Wish Town, Sector - 128, Noida - 201 304, U.P.</p>
                  <p className="mt-1">For medical service queries or appointments,</p>
                  <p>call: +91-120-4122 222</p>
                  <p className="text-blue-800">www.maxhealthcare.in</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">Crosslay Remedies Limited</p>
                  <p>Regd. Office: Max Hospital, Gurugram, Block B,</p>
                  <p>Sushant Lok Phase - 1, Gurugram - 122 001, Haryana</p>
                  <p>E: secretarial@maxhealthcare.com</p>
                  <p className="mt-2 text-[9px] text-slate-400">CIN: U85191HR2012PLC075989</p>
                </div>
              </div>
              <div className="mt-3 text-center text-[11px] font-bold bg-slate-100 py-1.5 border-t border-b border-slate-300 tracking-wide text-slate-900">
                For free home sample collection and medicine delivery, call 8744 888 888
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PrescriptionComposerModal({
  patient,
  appointmentId = null,
  prescriptionId = null,
  initialDiagnosis = '',
  initialNotes = '',
  initialValidUntil = '',
  onClose,
  onSaved,
}) {
  const patientId = resolvePatientId(patient);
  const patientName = resolvePatientName(patient);
  const doctorName = resolveDoctorName(patient);
  const defaultAppointmentId = resolveAppointmentId(patient, appointmentId);
  const existingPrescriptionId = resolvePrescriptionId(patient, prescriptionId);

  const [form, setForm] = useState(() => createInitialForm({
    patient,
    patientName,
    doctorName,
    initialDiagnosis,
    initialNotes,
    initialValidUntil,
  }));

  const [resolvedAppointmentId, setResolvedAppointmentId] = useState(defaultAppointmentId);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(existingPrescriptionId));
  const [savingAction, setSavingAction] = useState('');
  const [activePrescriptionId, setActivePrescriptionId] = useState(existingPrescriptionId || null);
  const [isCurrentFinalized, setIsCurrentFinalized] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [signatureSettings, setSignatureSettings] = useState({
    SignaturePreference: 'Stamp',
    SignatureText: '',
    SignatureImagePath: '',
  });
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('');
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [savingSignature, setSavingSignature] = useState(false);

  const signatureImageUrl = signaturePreviewUrl || buildAssetUrl(signatureSettings.SignatureImagePath);

  const [labSearchActive, setLabSearchActive] = useState(null);
  const [labResults, setLabResults] = useState([]);

  const handleLabTestSearch = async (index, term) => {
    setLabSearchActive(index);
    if (!term || term.length < 2) {
      setLabResults([]);
      return;
    }
    try {
      const response = await api.get(`/lab/search-tests?term=${encodeURIComponent(term)}`);
      if (response.success) {
        setLabResults(response.data);
      }
    } catch (err) {
      console.error('Error fetching lab tests:', err);
    }
  };

  useEffect(() => {
    if (!existingPrescriptionId) {
      setLoadingExisting(false);
      setActivePrescriptionId(null);
      setIsCurrentFinalized(false);
      setVersionHistory([]);
      setForm(createInitialForm({
        patient,
        patientName,
        doctorName,
        initialDiagnosis,
        initialNotes,
        initialValidUntil,
      }));
      setResolvedAppointmentId(defaultAppointmentId);
      return;
    }

    let active = true;

    const loadExistingPrescription = async () => {
      setLoadingExisting(true);
      try {
        const response = await api.get(`/prescriptions/${existingPrescriptionId}`);
        const payload = getPayload(response) || {};
        const data = payload?.data || payload;

        if (!active || !data) return;

        const parsedPayload = parseJson(data.PayloadJson || data.payloadJson || null, {});
        const payloadHeader = parsedPayload.header && typeof parsedPayload.header === 'object' ? parsedPayload.header : {};
        const payloadVitals = parsedPayload.vitals && typeof parsedPayload.vitals === 'object' ? parsedPayload.vitals : {};
        const payloadSections = parsedPayload.sections && typeof parsedPayload.sections === 'object' ? parsedPayload.sections : {};
        const payloadLabValues = parsedPayload.labValues && typeof parsedPayload.labValues === 'object' ? parsedPayload.labValues : {};
        const payloadFollowUp = parsedPayload.followUp && typeof parsedPayload.followUp === 'object' ? parsedPayload.followUp : {};

        const baseForm = createInitialForm({
          patient,
          patientName,
          doctorName,
          initialDiagnosis: data.Diagnosis || data.diagnosis || initialDiagnosis,
          initialNotes: data.Notes || data.notes || initialNotes,
          initialValidUntil: data.ValidUntil || data.validUntil || initialValidUntil,
        });

        const incomingItems = Array.isArray(parsedPayload.items) && parsedPayload.items.length
          ? parsedPayload.items
          : (Array.isArray(data.items) ? data.items : []);

        const mappedItems = incomingItems
          .map((item) => normalizeItemFromAny(item))
          .filter((item) => trimString(item.medicineName));

        const incomingLabTests = Array.isArray(parsedPayload.labTests) && parsedPayload.labTests.length
          ? parsedPayload.labTests
          : (Array.isArray(data.labTests) ? data.labTests : []);

        const mappedLabTests = incomingLabTests
          .map(t => ({
            localId: Math.random().toString(36).substr(2, 9),
            testName: t.testName || t.TestName || '',
            criteria: t.criteria || t.Criteria || '',
            details: t.details || t.Details || '',
          }))
          .filter(t => trimString(t.testName));

        console.log('[DEBUG] Loading Existing Prescription Data:', data);
        const nextForm = {
          ...baseForm,
          header: {
            ...baseForm.header,
            ...payloadHeader,
            patientName: trimString(payloadHeader.patientName) || data.PatientName || baseForm.header.patientName,
            doctorName: trimString(payloadHeader.doctorName) || data.DoctorName || baseForm.header.doctorName,
            pageLabel: trimString(payloadHeader.pageLabel) || baseForm.header.pageLabel,
          },
          vitals: {
            ...baseForm.vitals,
            ...payloadVitals,
          },
          sections: {
            ...baseForm.sections,
            ...payloadSections,
            diagnosis: trimString(payloadSections.diagnosis || payloadSections.diagnosisSidebar) ||
              trimString(data.Diagnosis) ||
              baseForm.sections.diagnosis,
            clinicalNotes: trimString(payloadSections.clinicalNotes) ||
              trimString(data.Notes) ||
              baseForm.sections.clinicalNotes,
            medicineAdvised: trimString(payloadSections.medicineAdvised || parsedPayload.medicineNotes) ||
              baseForm.sections.medicineAdvised,
          },
          labValues: {
            ...baseForm.labValues,
            ...payloadLabValues,
          },
          followUp: {
            ...baseForm.followUp,
            ...payloadFollowUp,
            when: toDateInput(payloadFollowUp.when || data.ValidUntil || baseForm.followUp.when),
          },
          medicineNotes: trimString(parsedPayload.medicineNotes) || baseForm.medicineNotes,
          amendReason: '',
          items: mappedItems.length ? mappedItems : [createInitialItem()],
          labTests: mappedLabTests.length ? mappedLabTests : [createLabTestItem()],
        };

        console.log('[DEBUG] Rehydrated Form State:', nextForm);
        setForm(nextForm);
        const loadedAppointmentId = toInt(data.AppointmentId || data.appointmentId || defaultAppointmentId);
        setResolvedAppointmentId(loadedAppointmentId);

        const loadedId = toInt(data.Id || data.id || existingPrescriptionId);
        setActivePrescriptionId(loadedId);
        setIsCurrentFinalized(Boolean(data.IsFinalized ?? data.isFinalized));
      } catch (error) {
        console.error('[DEBUG] Error loading prescription:', error);
        if (active) {
          toast.error(error?.message || 'Could not load the existing prescription');
        }
      } finally {
        if (active) {
          setLoadingExisting(false);
        }
      }
    };

    loadExistingPrescription();

    return () => {
      active = false;
    };
  }, [
    defaultAppointmentId,
    doctorName,
    existingPrescriptionId,
    initialDiagnosis,
    initialNotes,
    initialValidUntil,
    patient,
    patientName,
  ]);

  useEffect(() => {
    let active = true;

    const fetchSignatureSettings = async () => {
      setLoadingSignature(true);
      try {
        const response = await api.get('/prescriptions/signature-settings');
        const payload = getPayload(response) || {};
        const data = payload?.data || payload;
        if (!active) return;
        setSignatureSettings(normalizeSignatureSettings(data));
      } catch (error) {
        if (active) toast.error(error?.message || 'Could not load signature settings');
      } finally {
        if (active) setLoadingSignature(false);
      }
    };

    fetchSignatureSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activePrescriptionId) {
      setVersionHistory([]);
      return;
    }

    let active = true;

    const fetchVersions = async () => {
      setLoadingVersions(true);
      try {
        const response = await api.get(`/prescriptions/${activePrescriptionId}/versions`);
        const payload = getPayload(response) || {};
        const data = payload?.data || payload;
        if (!active) return;
        setVersionHistory(Array.isArray(data) ? data : []);
      } catch {
        if (active) setVersionHistory([]);
      } finally {
        if (active) setLoadingVersions(false);
      }
    };

    fetchVersions();

    return () => {
      active = false;
    };
  }, [activePrescriptionId]);

  useEffect(() => {
    return () => {
      if (signaturePreviewUrl) URL.revokeObjectURL(signaturePreviewUrl);
    };
  }, [signaturePreviewUrl]);

  // Prevent accidental page refresh/navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // LocalStorage Auto-save for unsaved drafts
  const draftKey = `rx-draft-backup-${patientId}-${resolvedAppointmentId || 'new'}`;

  useEffect(() => {
    if (loadingExisting || isCurrentFinalized) return;
    try {
      const backup = { form, signatureSettings };
      localStorage.setItem(draftKey, JSON.stringify(backup));
    } catch (e) {
      // Ignore quota errors
    }
  }, [form, signatureSettings, draftKey, loadingExisting, isCurrentFinalized]);

  useEffect(() => {
    if (!loadingExisting && !activePrescriptionId) {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.form) setForm(parsed.form);
          if (parsed.signatureSettings) setSignatureSettings(parsed.signatureSettings);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [loadingExisting, activePrescriptionId, draftKey]);

  const updateSection = (section, key, value) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const updateItem = (index, key, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, createInitialItem()] }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.length <= 1
        ? [createInitialItem()]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateLabTest = (index, key, value) => {
    setForm((current) => ({
      ...current,
      labTests: current.labTests.map((test, testIndex) => (
        testIndex === index ? { ...test, [key]: value } : test
      )),
    }));
  };

  const addLabTest = () => {
    setForm((current) => ({ ...current, labTests: [...current.labTests, createLabTestItem()] }));
  };

  const removeLabTest = (index) => {
    setForm((current) => ({
      ...current,
      labTests: current.labTests.length <= 1
        ? [createLabTestItem()]
        : current.labTests.filter((_, testIndex) => testIndex !== index),
    }));
  };

  const normalizedItemsForSubmit = useMemo(() => (
    form.items
      .filter((item) => trimString(item.medicineName))
      .map((item) => {
        const days = trimString(item.days);
        const schedule = trimString(item.schedule);
        const instruction = trimString(item.instruction);

        return {
          medicineName: trimString(item.medicineName),
          genericName: trimString(item.genericName),
          dosage: trimString(item.dosage),
          frequency: schedule,
          duration: days ? `${days} day(s)` : null,
          quantity: trimString(item.quantity) ? Number(item.quantity) : null,
          route: trimString(item.route) || 'Oral',
          instructions: instruction,
          schedule,
          instruction,
          days,
        };
      })
  ), [form.items]);

  const normalizedLabTestsForSubmit = useMemo(() => (
    form.labTests
      .filter((test) => trimString(test.testName))
      .map((test) => ({
        testName: trimString(test.testName),
        criteria: trimString(test.criteria),
        details: trimString(test.details),
      }))
  ), [form.labTests]);

  const requestPayload = useMemo(() => ({
    patientId,
    appointmentId: resolvedAppointmentId || null,
    diagnosis: trimString(form.sections.diagnosis),
    notes: trimString(form.sections.clinicalNotes),
    validUntil: trimString(form.followUp.when),
    header: normalizeTextObject(form.header),
    vitals: normalizeTextObject(form.vitals),
    sections: normalizeTextObject({
      ...form.sections,
      allergy: form.header.allergy,
    }),
    medicineNotes: trimString(form.medicineNotes),
    labValues: normalizeTextObject(form.labValues),
    followUp: normalizeTextObject(form.followUp),
    items: normalizedItemsForSubmit,
    labTests: normalizedLabTestsForSubmit,
  }), [form, normalizedItemsForSubmit, normalizedLabTestsForSubmit, patientId, resolvedAppointmentId]);

  const previewModel = useMemo(() => ({
    hospitalName: form.header.hospitalName,
    pageLabel: form.header.pageLabel || 'Page 1 of 1',
    dateLabel: form.header.date || new Date().toLocaleString('en-IN'),
    location: form.header.location,
    invoiceNo: form.header.invoiceNo,
    referredBy: form.header.referredBy,
    rxNumber: activePrescriptionId ? `RX-${activePrescriptionId}` : '',
    patientName: form.header.patientName || patientName,
    ageSex: form.header.ageSex,
    maxId: form.header.maxId,
    allergy: form.header.allergy,
    doctorName: form.header.doctorName || doctorName,
    department: form.header.department,
    speciality: form.header.speciality,
    vitals: {
      bp: form.vitals.bp,
      pulse: form.vitals.pulse,
      spo2: form.vitals.spo2,
      fallRisk: form.vitals.fallRisk,
    },
    sections: {
      chiefComplaints: form.sections.chiefComplaints,
      historyPresentIllness: form.sections.historyPresentIllness,
      pastHistory: form.sections.pastHistory,
      clinicalNotes: form.sections.clinicalNotes,
      procedure: form.sections.procedure,
      diagnosis: form.sections.diagnosis,
      medicineAdvised: form.sections.medicineAdvised || form.medicineNotes,
    },
    labValues: {
      inr: form.labValues.inr,
      salb: form.labValues.salb,
      albuminNote: form.labValues.albuminNote,
      other: form.labValues.other,
    },
    followUp: {
      instructions: form.followUp.instructions,
      when: form.followUp.when,
    },
    items: form.items
      .filter((item) => trimString(item.medicineName))
      .map((item) => ({
        localId: item.localId,
        medicineName: item.medicineName,
        genericName: item.genericName,
        dosage: item.dosage,
        schedule: item.schedule,
        instruction: item.instruction,
        route: item.route,
        days: item.days,
      })),
    labTests: form.labTests
      .filter((test) => trimString(test.testName))
      .map((test) => ({
        localId: test.localId,
        testName: test.testName,
        criteria: test.criteria,
        details: test.details,
      })),
    signatureText: signatureSettings.SignatureText || form.header.doctorName || doctorName,
    signaturePreference: signatureSettings.SignaturePreference || 'Stamp',
  }), [
    activePrescriptionId,
    doctorName,
    form,
    patientName,
    signatureSettings.SignaturePreference,
    signatureSettings.SignatureText,
  ]);

  const handleSignatureFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (signaturePreviewUrl) URL.revokeObjectURL(signaturePreviewUrl);
    setSignatureFile(file);
    setSignaturePreviewUrl(URL.createObjectURL(file));
  };

  const saveSignatureSettings = async () => {
    try {
      setSavingSignature(true);

      const formData = new FormData();
      formData.append('signaturePreference', signatureSettings.SignaturePreference || 'Stamp');
      formData.append('signatureText', signatureSettings.SignatureText || '');
      if (signatureFile) formData.append('signatureImage', signatureFile);

      const response = await api.post('/prescriptions/signature-settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const payload = getPayload(response) || {};
      const data = payload?.data || payload;
      setSignatureSettings(normalizeSignatureSettings(data));
      setSignatureFile(null);
      if (signaturePreviewUrl) {
        URL.revokeObjectURL(signaturePreviewUrl);
        setSignaturePreviewUrl('');
      }
      toast.success('Signature settings updated');
    } catch (error) {
      toast.error(error?.message || 'Could not save signature settings');
    } finally {
      setSavingSignature(false);
    }
  };

  const tryArchivePdf = async (prescriptionDocId) => {
    if (!prescriptionDocId) return;
    try {
      await api.post(`/prescriptions/${prescriptionDocId}/archive`);
    } catch {
      // non-blocking by design
    }
  };

  const submitPrescription = async ({ mode, amendmentMode = false, finalizeAmendment = false }) => {
    if (!patientId) {
      toast.error('Patient information is missing for this prescription');
      return;
    }



    if (amendmentMode && !activePrescriptionId) {
      toast.error('Cannot amend before a base prescription exists');
      return;
    }

    if (amendmentMode && !trimString(form.amendReason)) {
      toast.error('Please provide amendment reason');
      return;
    }

    setSavingAction(mode);

    try {
      console.log('[DEBUG] Submitting Prescription Payload:', JSON.stringify(requestPayload, null, 2));
      let savedId = null;
      let finalized = false;

      if (amendmentMode) {
        const amendResponse = await api.post(`/prescriptions/${activePrescriptionId}/amend`, {
          reason: trimString(form.amendReason),
          ...requestPayload,
        });

        const amendPayload = getPayload(amendResponse) || {};
        const amendData = amendPayload?.data || amendPayload;

        savedId = toInt(amendData.id || amendData.Id);
        finalized = false;

        if (finalizeAmendment && savedId) {
          await api.post(`/prescriptions/${savedId}/finalize`);
          await tryArchivePdf(savedId);
          finalized = true;
        }
      } else {
        const saveResponse = await api.post('/prescriptions', {
          ...requestPayload,
          mode,
        });

        const payload = getPayload(saveResponse) || {};
        const data = payload?.data || payload;

        savedId = toInt(data.id || data.Id);
        finalized = Boolean(data.isFinalized || data.IsFinalized || mode === 'finalize');

        if (finalized && savedId) {
          await tryArchivePdf(savedId);
        }
      }

      if (savedId) {
        setActivePrescriptionId(savedId);
      }

      setIsCurrentFinalized(finalized);

      if (amendmentMode) {
        toast.success(finalizeAmendment ? 'Amendment finalized successfully' : 'Amendment draft created');
      } else {
        toast.success(mode === 'draft' ? 'Prescription draft saved' : 'Prescription finalized');
      }

      onSaved?.({
        id: savedId,
        isFinalized: finalized,
        mode,
        amendmentMode,
      });
    } catch (error) {
      toast.error(error?.message || 'Could not save prescription');
    } finally {
      setSavingAction('');
    }
  };

  const downloadFinalPdf = async () => {
    if (!activePrescriptionId) {
      toast.error('No prescription available for download');
      return;
    }

    try {
      const fileBlob = await api.get(`/prescriptions/${activePrescriptionId}/pdf`, {
        responseType: 'blob',
      });

      const objectUrl = URL.createObjectURL(fileBlob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `prescription-${activePrescriptionId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error?.message || 'Could not download prescription PDF');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const showAmendmentActions = Boolean(activePrescriptionId && isCurrentFinalized);

  return (
    <div className="rx-composer-root fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 md:p-6">
      <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="rx-no-print flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <Pill size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Digital Prescription Composer</h3>
              <p className="text-sm text-slate-500">
                Patient: <strong>{patientName}</strong>
                {resolvedAppointmentId ? <span> · Appointment #{resolvedAppointmentId}</span> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loadingExisting ? (
          <div className="flex flex-1 items-center justify-center bg-slate-50">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
              <Loader size={14} className="animate-spin" />
              Loading prescription data...
            </div>
          </div>
        ) : (
          <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
            <div className="rx-no-print overflow-y-auto border-r border-slate-200 bg-white px-5 py-5">
              <div className="grid gap-5">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Header</h4>
                    <span className="text-xs text-slate-400">Replica metadata</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Hospital Name</span>
                      <input
                        value={form.header.hospitalName}
                        onChange={(event) => updateSection('header', 'hospitalName', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Location</span>
                      <input
                        value={form.header.location}
                        onChange={(event) => updateSection('header', 'location', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Patient Name</span>
                      <input
                        value={form.header.patientName}
                        onChange={(event) => updateSection('header', 'patientName', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Age / Sex</span>
                      <input
                        value={form.header.ageSex}
                        onChange={(event) => updateSection('header', 'ageSex', event.target.value)}
                        placeholder="e.g. 66 years / Female"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">UHID / MaxID</span>
                      <input
                        value={form.header.maxId}
                        onChange={(event) => updateSection('header', 'maxId', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Date Label</span>
                      <input
                        value={form.header.date}
                        onChange={(event) => updateSection('header', 'date', event.target.value)}
                        placeholder="Defaults to current timestamp"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Doctor Name</span>
                      <input
                        value={form.header.doctorName}
                        onChange={(event) => updateSection('header', 'doctorName', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Department</span>
                      <input
                        value={form.header.department}
                        onChange={(event) => updateSection('header', 'department', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Speciality</span>
                      <input
                        value={form.header.speciality}
                        onChange={(event) => updateSection('header', 'speciality', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Invoice Number</span>
                      <input
                        value={form.header.invoiceNo}
                        onChange={(event) => updateSection('header', 'invoiceNo', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Referred By</span>
                      <input
                        value={form.header.referredBy}
                        onChange={(event) => updateSection('header', 'referredBy', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Allergy</span>
                      <input
                        value={form.header.allergy}
                        onChange={(event) => updateSection('header', 'allergy', event.target.value)}
                        placeholder="No Known Allergy"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Vitals</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['bp', 'BP'],
                      ['pulse', 'Pulse'],
                      ['spo2', 'SPO2'],
                      ['fallRisk', 'Fall Risk'],
                      ['temperature', 'Temperature'],
                      ['weight', 'Weight'],
                    ].map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
                        <input
                          value={form.vitals[key]}
                          onChange={(event) => updateSection('vitals', key, event.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Clinical Sections</h4>
                  <div className="grid gap-3">
                    {[
                      ['chiefComplaints', 'Chief Complaints'],
                      ['historyPresentIllness', 'History of Present Illness'],
                      ['pastHistory', 'Past History'],
                      ['clinicalNotes', 'Clinical Notes / Old Reports'],
                      ['procedure', 'Procedure'],
                      ['diagnosis', 'Diagnosis'],
                      ['medicineAdvised', 'Medicine Advised'],
                    ].map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
                        <textarea
                          value={form.sections[key]}
                          onChange={(event) => updateSection('sections', key, event.target.value)}
                          rows={key === 'diagnosis' ? 3 : 2}
                          className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Medicine Table</h4>
                  <div className="space-y-3">
                    {form.items.map((item, index) => (
                      <div key={item.localId || `item-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Medicine {index + 1}</p>
                          {form.items.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-2.5 md:grid-cols-2">
                          <label className="block md:col-span-1">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Medicine Name</span>
                            <input
                              value={item.medicineName}
                              onChange={(event) => updateItem(index, 'medicineName', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>

                          <label className="block md:col-span-1">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Generic Name</span>
                            <input
                              value={item.genericName}
                              onChange={(event) => updateItem(index, 'genericName', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                              placeholder="(e.g. Paracetamol)"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Dosage</span>
                            <input
                              value={item.dosage}
                              onChange={(event) => updateItem(index, 'dosage', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Schedule</span>
                            <select
                              value={item.schedule}
                              onChange={(event) => updateItem(index, 'schedule', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            >
                              <option value="">Select schedule</option>
                              {FREQS.map((freq) => <option key={freq} value={freq}>{freq}</option>)}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Instruction</span>
                            <input
                              value={item.instruction}
                              onChange={(event) => updateItem(index, 'instruction', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                              placeholder="1-0-1 / after food"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Days</span>
                            <input
                              value={item.days}
                              onChange={(event) => updateItem(index, 'days', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Route</span>
                            <select
                              value={item.route}
                              onChange={(event) => updateItem(index, 'route', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            >
                              {ROUTES.map((route) => <option key={route} value={route}>{route}</option>)}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Quantity</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    <Plus size={14} />
                    Add medicine
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Lab Test Table</h4>
                  <div className="space-y-3">
                    {form.labTests.map((test, index) => (
                      <div key={test.localId || `lab-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Lab Test {index + 1}</p>
                          {form.labTests.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeLabTest(index)}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-2.5 md:grid-cols-2">
                          <div className="relative md:col-span-2">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-slate-500">Test Name</span>
                              <input
                                value={test.testName}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateLabTest(index, 'testName', value);
                                  handleLabTestSearch(index, value);
                                }}
                                onFocus={() => test.testName && handleLabTestSearch(index, test.testName)}
                                onBlur={() => setTimeout(() => setLabSearchActive(null), 200)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                placeholder="Search for a lab test..."
                              />
                            </label>

                            {labSearchActive === index && labResults.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                {labResults.map((result) => (
                                  <button
                                    key={result.Id}
                                    type="button"
                                    onClick={() => {
                                      updateLabTest(index, 'testName', result.Name);
                                      setLabSearchActive(null);
                                    }}
                                    className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-indigo-50"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium text-slate-700">{result.Name}</span>
                                      {result.Category && (
                                        <span className="text-[10px] text-slate-400">{result.Category}</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Criteria for Testing</span>
                            <input
                              value={test.criteria}
                              onChange={(event) => updateLabTest(index, 'criteria', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Additional Details</span>
                            <input
                              value={test.details}
                              onChange={(event) => updateLabTest(index, 'details', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addLabTest}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    <Plus size={14} />
                    Add lab test
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Follow-Up</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Follow-Up Instructions</span>
                      <textarea
                        value={form.followUp.instructions}
                        onChange={(event) => updateSection('followUp', 'instructions', event.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Follow-Up Date</span>
                      <input
                        type="date"
                        value={form.followUp.when}
                        onChange={(event) => updateSection('followUp', 'when', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Medicine Notes</span>
                      <input
                        value={form.medicineNotes}
                        onChange={(event) => setForm((current) => ({ ...current, medicineNotes: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Doctor Signature</h4>
                    <button
                      type="button"
                      onClick={() => setShowSignatureEditor((value) => !value)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      {showSignatureEditor ? 'Hide Settings' : 'Edit Settings'}
                    </button>
                  </div>

                  {loadingSignature ? (
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader size={13} className="animate-spin" />
                      Loading signature settings...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Current preference: <strong>{signatureSettings.SignaturePreference || 'Stamp'}</strong>
                      </p>
                      <p className="text-sm text-slate-600">
                        Signature text: <strong>{signatureSettings.SignatureText || form.header.doctorName || 'Not set'}</strong>
                      </p>
                      {signatureImageUrl ? (
                        <img
                          src={signatureImageUrl}
                          alt="Signature preview"
                          className="h-16 max-w-[220px] rounded border border-slate-200 bg-white object-contain p-1"
                        />
                      ) : (
                        <p className="text-xs text-amber-600">No signature image uploaded yet.</p>
                      )}
                    </div>
                  )}

                  {showSignatureEditor ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Signature Text</span>
                          <input
                            value={signatureSettings.SignatureText}
                            onChange={(event) => setSignatureSettings((current) => ({ ...current, SignatureText: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                            placeholder="Doctor name/designation"
                          />
                        </label>

                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Placement</span>
                          <select
                            value={signatureSettings.SignaturePreference}
                            onChange={(event) => setSignatureSettings((current) => ({ ...current, SignaturePreference: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            {SIGNATURE_PREFS.map((pref) => (
                              <option key={pref.id} value={pref.id}>{pref.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Upload Signature Image</span>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={handleSignatureFile}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            />
                            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                              <Upload size={13} />
                              Choose Image
                            </div>
                          </div>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={saveSignatureSettings}
                        disabled={savingSignature}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {savingSignature ? <Loader size={13} className="animate-spin" /> : <PenLine size={13} />}
                        Save Signature Settings
                      </button>
                    </div>
                  ) : null}
                </section>

                {showAmendmentActions ? (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Finalized prescription detected</p>
                        <p className="text-xs text-amber-700">Edits are saved as a new amendment version. Existing finalized versions remain immutable.</p>
                      </div>
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-semibold text-amber-800">Amendment reason</span>
                      <textarea
                        value={form.amendReason}
                        onChange={(event) => setForm((current) => ({ ...current, amendReason: event.target.value }))}
                        rows={2}
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
                        placeholder="Reason for updating treatment plan"
                      />
                    </label>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Version History</h4>
                  {loadingVersions ? (
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader size={13} className="animate-spin" /> Loading versions...
                    </div>
                  ) : versionHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">No saved versions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {versionHistory.map((version) => (
                        <div key={version.Id || version.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-sm font-semibold text-slate-700">
                            V{version.VersionNo || version.versionNo || 1} · {version.RxNumber || version.rxNumber || 'RX'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {Boolean(version.IsFinalized ?? version.isFinalized) ? 'Finalized' : 'Draft'}
                            {' · '}
                            {new Date(version.CreatedAt || version.createdAt || Date.now()).toLocaleString('en-IN')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="overflow-auto bg-slate-100 px-3 py-4">
              <PrescriptionPrintSheet model={previewModel} signatureImageUrl={signatureImageUrl} />
            </div>
          </div>
        )}

        <div className="rx-no-print flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={13} />
            {activePrescriptionId ? `Prescription #${activePrescriptionId}` : 'Unsaved prescription'}
            {isCurrentFinalized ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Finalized</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">Draft</span>}
          </div>

          <div className="flex items-center gap-2">
            {activePrescriptionId && isCurrentFinalized ? (
              <button
                type="button"
                onClick={downloadFinalPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                Download Final PDF
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>

            {showAmendmentActions ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => submitPrescription({ mode: 'draft', amendmentMode: true, finalizeAmendment: false })}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                >
                  {savingAction === 'draft' ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                  Create Amendment Draft
                </button>

                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => submitPrescription({ mode: 'finalize', amendmentMode: true, finalizeAmendment: true })}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingAction === 'finalize' ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  Finalize Amendment
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => submitPrescription({ mode: 'draft' })}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {savingAction === 'draft' ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => submitPrescription({ mode: 'finalize' })}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {savingAction === 'finalize' ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  Finalize Prescription
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
