import React from 'react';
import { Lock } from 'lucide-react';

const renderInput = ({ field, value, canEdit, onChange }) => {
  const baseClassName = `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors ${
    canEdit
      ? 'border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300'
      : 'border-slate-100 bg-slate-50 text-slate-500'
  }`;

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        value={value || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        disabled={!canEdit}
        className={`${baseClassName} resize-none`}
        placeholder={field.placeholder || ''}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        disabled={!canEdit}
        className={baseClassName}
      >
        <option value="">{field.placeholder || 'Select'}</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${canEdit ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
        <span className="text-sm text-slate-600">{field.checkboxLabel || field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(field.key, event.target.checked)}
          disabled={!canEdit}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600"
        />
      </label>
    );
  }

  return (
    <input
      type={field.type || 'text'}
      value={value || ''}
      onChange={(event) => onChange(field.key, event.target.value)}
      disabled={!canEdit}
      className={baseClassName}
      placeholder={field.placeholder || ''}
    />
  );
};

export default function ProfileFieldGroup({
  title,
  description,
  fields = [],
  form,
  editableSet,
  onChange,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
      </div>
      <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => {
          const canEdit = editableSet.has(field.key) && !field.readOnly;

          return (
            <div key={field.key} className={field.type === 'textarea' || field.fullWidth ? 'md:col-span-2' : ''}>
              {field.type !== 'checkbox' && (
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {field.label}
                  </label>
                  {!canEdit && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Lock size={11} />
                      Read only
                    </span>
                  )}
                </div>
              )}
              {renderInput({
                field,
                value: form[field.key],
                canEdit,
                onChange,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
