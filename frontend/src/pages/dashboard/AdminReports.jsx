import React from 'react';
import { BarChart2, Download, Filter } from 'lucide-react';
import { Card, SectionHeader, Empty } from '../../components/ui';

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hospital Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Generate and view analytics, financial, and clinical reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Filter size={14} /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
            <Download size={14} /> Export All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <BarChart2 size={20} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Financial Reports</h3>
          <p className="text-slate-500 text-sm mt-1 mb-4">Revenue, billing summaries, and expense tracking over time.</p>
          <button className="text-sm font-bold text-blue-600 hover:underline">View Details →</button>
        </Card>
        
        <Card className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <BarChart2 size={20} className="text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Clinical Analytics</h3>
          <p className="text-slate-500 text-sm mt-1 mb-4">Patient outcomes, department performance, and treatment metrics.</p>
          <button className="text-sm font-bold text-emerald-600 hover:underline">View Details →</button>
        </Card>

        <Card className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <BarChart2 size={20} className="text-orange-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Staff Utilization</h3>
          <p className="text-slate-500 text-sm mt-1 mb-4">Doctor availability, staff hours, and payroll summaries.</p>
          <button className="text-sm font-bold text-orange-600 hover:underline">View Details →</button>
        </Card>
      </div>
      
      <Card>
        <SectionHeader title="Recent Generated Reports" icon={BarChart2} />
        <Empty icon={BarChart2} text="No recent reports generated." action="Generate Report" />
      </Card>
    </div>
  );
}
