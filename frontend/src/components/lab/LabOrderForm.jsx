import React from 'react';

const LabOrderForm = () => {
  return (
    <form className="space-y-4 bg-white p-6 rounded-xl shadow-sm border">
      <h2 className="text-xl font-semibold">New Lab Order</h2>
      {/* Form fields for patient, tests, and priority */}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">
        Submit Order
      </button>
    </form>
  );
};

export default LabOrderForm;
