import React from 'react';
import { Bed, Plus, Edit2, Trash2 } from 'lucide-react';
import { Card, SectionHeader, Empty } from '../../components/ui';

export default function AdminDepartments() {
  const MOCK_DEPARTMENTS = [
    { id: 1, name: 'Cardiology', head: 'Dr. Rahul Sharma', beds: 45, occupied: 38 },
    { id: 2, name: 'Neurology', head: 'Dr. Priya Patel', beds: 30, occupied: 25 },
    { id: 3, name: 'Orthopedics', head: 'Dr. Vikram Singh', beds: 40, occupied: 35 },
    { id: 4, name: 'Pediatrics', head: 'Dr. Anjali Mehta', beds: 25, occupied: 15 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage hospital departments and bed capacity.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
          <Plus size={14} /> Add Department
        </button>
      </div>

      <Card>
        <SectionHeader title="Active Departments" icon={Bed} />
        {MOCK_DEPARTMENTS.length === 0 ? (
          <Empty icon={Bed} text="No departments found" action="Create Department" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Head of Department</th>
                  <th className="px-6 py-4">Total Beds</th>
                  <th className="px-6 py-4">Occupancy Rate</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MOCK_DEPARTMENTS.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{dept.name}</td>
                    <td className="px-6 py-4">{dept.head}</td>
                    <td className="px-6 py-4">{dept.beds}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(dept.occupied / dept.beds) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold">{Math.round((dept.occupied / dept.beds) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-500 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
