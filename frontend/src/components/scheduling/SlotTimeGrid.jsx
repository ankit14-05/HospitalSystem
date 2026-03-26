import React from 'react';

export default function SlotTimeGrid({ slots = [], selectedTimes = [], onToggle }) {
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
      {slots.map((slot) => {
        const active = selectedTimes.includes(slot);
        return (
          <button
            type="button"
            key={slot}
            onClick={() => onToggle(slot)}
            className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
              active
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}
