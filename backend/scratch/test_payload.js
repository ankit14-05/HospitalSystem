const buildPayloadObject = ({
  body,
  normalizedItems = [],
  fallbackDiagnosis = null,
  fallbackNotes = null,
  fallbackValidUntil = null,
}) => {
  const header = body?.header && typeof body.header === 'object' ? body.header : {};
  const vitals = body?.vitals && typeof body.vitals === 'object' ? body.vitals : {};
  const sections = body?.sections && typeof body.sections === 'object' ? body.sections : {};
  const labValues = body?.labValues && typeof body.labValues === 'object' ? body.labValues : {};
  const followUp = body?.followUp && typeof body.followUp === 'object' ? body.followUp : {};

  return {
    header,
    vitals,
    sections,
    medicineNotes: (body?.medicineNotes),
    labValues,
    followUp,
    items: normalizedItems.map((item) => ({
      medicineName: item.medicineName,
      genericName: item.genericName,
      dosage: item.dosage,
      schedule: item.schedule || item.frequency,
      instruction: item.instruction || item.instructions,
      route: item.route,
      days: item.days,
      quantity: item.quantity,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions,
    })),
    legacy: {
      diagnosis: (fallbackDiagnosis),
      notes: (fallbackNotes),
      validUntil: (fallbackValidUntil),
    },
    meta: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
    },
  };
};

const sampleBody = {
  header: { patientName: 'John Doe' },
  sections: { diagnosis: 'Flu' },
  items: [{ medicineName: 'Paracetamol', frequency: 'TID' }]
};

const payload = buildPayloadObject({
  body: sampleBody,
  normalizedItems: sampleBody.items,
  fallbackDiagnosis: 'Flu',
  fallbackNotes: 'Take rest',
  fallbackValidUntil: '2026-05-01'
});

console.log(JSON.stringify(payload, null, 2));
