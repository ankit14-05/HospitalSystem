const crypto = require('crypto');
const { getPool, sql, withTransaction } = require('../config/database');
const AppError = require('../utils/AppError');
const notificationService = require('./notificationService');

const RELATIONSHIP_VALUES = new Set([
  'Self',
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Grandparent',
  'Grandchild',
  'InLaw',
  'Other',
]);

const ACCESS_ROLE_VALUES = new Set(['owner', 'guardian', 'delegate']);
const PAYMENT_METHOD_MAP = {
  card: 'Card',
  upi: 'UPI',
  net: 'NetBanking',
  cash: 'Cash',
};

const DEFAULT_REGISTRATION_FEE = Number.parseFloat(process.env.PATIENT_REGISTRATION_FEE || '200');

let registrationSchemaCache = null;
let registrationSchemaCacheAt = 0;
const REGISTRATION_SCHEMA_CACHE_MS = 5 * 60 * 1000;

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const sanitizePhone = (rawValue, { fieldName = 'phone', required = false } = {}) => {
  const raw = cleanText(rawValue);
  if (!raw) {
    if (required) throw new AppError(`${fieldName} is required`, 422);
    return null;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    if (required) throw new AppError(`${fieldName} is required`, 422);
    return null;
  }

  if (digits.startsWith('0')) {
    throw new AppError(`${fieldName} cannot start with 0`, 422);
  }

  return digits;
};

const parseDateOnly = (value, fieldName, { required = false, mustBePast = false } = {}) => {
  const raw = cleanText(value);
  if (!raw) {
    if (required) throw new AppError(`${fieldName} is required`, 422);
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 422);
  }

  if (mustBePast && parsed >= new Date()) {
    throw new AppError(`${fieldName} must be in the past`, 422);
  }

  return parsed;
};

const parseOptionalNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`Invalid ${fieldName}`, 422);
  }
  return parsed;
};

const parseOptionalInt = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new AppError(`Invalid ${fieldName}`, 422);
  }
  return parsed;
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
};

const maskCardNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
};

const maskUpiId = (value) => {
  const raw = cleanText(value);
  if (!raw) return null;
  const [left, right] = raw.split('@');
  if (!right) return raw;
  const visible = left.length <= 2 ? left : `${left.slice(0, 2)}${'*'.repeat(Math.max(1, left.length - 2))}`;
  return `${visible}@${right}`;
};

const maskAccountNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return `****${digits.slice(-4)}`;
};

const normalizeIdDocument = ({ idType, idNumber, aadhaar, pan, passportNo, voterId, abhaNumber }) => {
  let nextAadhaar = cleanText(aadhaar);
  let nextPan = cleanText(pan);
  let nextPassportNo = cleanText(passportNo);
  let nextVoterId = cleanText(voterId);

  const rawType = cleanText(idType);
  const rawNumber = cleanText(idNumber);

  if (rawType && rawNumber) {
    const normalizedNumber = rawNumber.toUpperCase();
    if (rawType === 'Aadhar Card') nextAadhaar = normalizedNumber.replace(/\D/g, '').slice(0, 12);
    else if (rawType === 'PAN Card') nextPan = normalizedNumber.replace(/[^A-Z0-9]/g, '').slice(0, 10);
    else if (rawType === 'Passport') nextPassportNo = normalizedNumber.replace(/[^A-Z0-9]/g, '').slice(0, 30);
    else if (rawType === 'Voter ID') nextVoterId = normalizedNumber.replace(/[^A-Z0-9]/g, '').slice(0, 30);
  }

  return {
    aadhaar: nextAadhaar,
    pan: nextPan,
    passportNo: nextPassportNo,
    voterId: nextVoterId,
    abhaNumber: cleanText(abhaNumber),
  };
};

const inferAccessRole = (relationshipToUser, accessRole) => {
  const normalizedRole = cleanText(accessRole);
  if (normalizedRole && ACCESS_ROLE_VALUES.has(normalizedRole)) return normalizedRole;
  return relationshipToUser === 'Self' ? 'owner' : 'guardian';
};

const getRegistrationSchemaState = async (poolArg = null, { force = false } = {}) => {
  const now = Date.now();
  if (!force && registrationSchemaCache && now - registrationSchemaCacheAt < REGISTRATION_SCHEMA_CACHE_MS) {
    return registrationSchemaCache;
  }

  const pool = poolArg || await getPool();
  const result = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.PatientProfileRegistrations', N'U') IS NOT NULL THEN 1 ELSE 0 END AS HasRegistrationTable
  `);

  registrationSchemaCache = {
    hasRegistrationTable: Boolean(result.recordset[0]?.HasRegistrationTable),
  };
  registrationSchemaCacheAt = now;
  return registrationSchemaCache;
};

const CHARSET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

const randSegment = (charset, len) =>
  Array.from(crypto.randomBytes(len))
    .map((byte) => charset[byte % charset.length])
    .join('');

const generatePatientId = () => {
  const seg1 = randSegment(CHARSET_UPPER, 4);
  const seg2 = randSegment(CHARSET_LOWER, 4);
  const seg3 = randSegment(CHARSET_UPPER, 4);
  const seg4 = randSegment(CHARSET_LOWER, 4);
  return `PT-${seg1}/${seg2}-${seg3}/${seg4}`;
};

const generateUniquePatientId = async (transaction) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const patientId = generatePatientId();
    const result = await new sql.Request(transaction)
      .input('UHID', sql.NVarChar(30), patientId)
      .query(`
        SELECT TOP 1 Id
        FROM dbo.PatientProfiles
        WHERE UHID = @UHID
      `);

    if (!result.recordset.length) {
      return patientId;
    }
  }

  throw new AppError('Failed to generate a unique patient ID. Please try again.', 500);
};

const getAdminRecipientIds = async (transaction, hospitalId) => {
  const result = await new sql.Request(transaction)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT Id
      FROM dbo.Users
      WHERE DeletedAt IS NULL
        AND IsActive = 1
        AND HospitalId = @HospitalId
        AND Role IN ('superadmin', 'admin', 'auditor')
    `);

  return result.recordset.map((row) => row.Id);
};

const buildPaymentSnapshot = (payload) => {
  const payLater = toBoolean(payload.payLater);
  const rawMethod = (cleanText(payload.payMethod || payload.paymentMethod) || '').toLowerCase();
  const paymentMethod = payLater ? 'PayLater' : PAYMENT_METHOD_MAP[rawMethod];
  const registrationFee = parseOptionalNumber(
    payload.registrationFee ?? payload.paymentAmount ?? DEFAULT_REGISTRATION_FEE,
    'registrationFee'
  );

  if (!payLater && !paymentMethod) {
    throw new AppError('Payment method is required', 422);
  }

  const card = payload.card || {};
  const bank = payload.bank || {};
  const paymentPayload = {
    payLater,
    uiMethod: rawMethod || null,
    currencyCode: cleanText(payload.currencyCode) || 'INR',
  };

  if (!payLater && paymentMethod === 'Card') {
    if (!cleanText(card.number) || !cleanText(card.expiry) || !cleanText(card.name)) {
      throw new AppError('Complete card details are required', 422);
    }
    paymentPayload.card = {
      maskedNumber: maskCardNumber(card.number),
      expiry: cleanText(card.expiry),
      name: cleanText(card.name),
    };
  }

  if (!payLater && paymentMethod === 'UPI') {
    if (!cleanText(payload.upiId)) {
      throw new AppError('UPI ID is required', 422);
    }
    paymentPayload.upi = {
      id: maskUpiId(payload.upiId),
    };
  }

  if (!payLater && paymentMethod === 'NetBanking') {
    if (!cleanText(bank.name) || !cleanText(bank.account) || !cleanText(bank.ifsc)) {
      throw new AppError('Complete bank details are required', 422);
    }
    paymentPayload.bank = {
      name: cleanText(bank.name),
      account: maskAccountNumber(bank.account),
      ifsc: cleanText(bank.ifsc)?.toUpperCase() || null,
    };
  }

  return {
    payLater,
    paymentMethod,
    paymentStatus: payLater ? 'Pending' : 'Paid',
    paymentReference: cleanText(payload.paymentReference) || null,
    registrationFee: registrationFee ?? DEFAULT_REGISTRATION_FEE,
    currencyCode: cleanText(payload.currencyCode) || 'INR',
    paidAt: payLater ? null : new Date(),
    paymentPayload,
  };
};

const normalizeLinkedPatientPayload = (payload = {}) => {
  const firstName = cleanText(payload.firstName);
  const lastName = cleanText(payload.lastName);
  const gender = cleanText(payload.gender);
  const dateOfBirth = parseDateOnly(payload.dateOfBirth || payload.dob, 'dateOfBirth', {
    required: true,
    mustBePast: true,
  });
  const relationshipToUser = cleanText(payload.relationshipToUser) || 'Other';
  const accessRole = inferAccessRole(relationshipToUser, payload.accessRole);

  if (!firstName || !lastName || !gender) {
    throw new AppError('firstName, lastName, and gender are required', 422);
  }

  if (!RELATIONSHIP_VALUES.has(relationshipToUser)) {
    throw new AppError('Invalid relationshipToUser', 422);
  }

  if (!ACCESS_ROLE_VALUES.has(accessRole)) {
    throw new AppError('Invalid accessRole', 422);
  }

  const emergencyName = cleanText(payload.emergencyName) ||
    [cleanText(payload.emFirstName), cleanText(payload.emLastName)].filter(Boolean).join(' ') ||
    null;

  const currentMedications = cleanText(payload.currentMedications);
  const knownAllergies = cleanText(payload.knownAllergies || payload.allergies);
  const chronicConditions = cleanText(payload.chronicConditions || payload.diseases);
  const pastSurgery = cleanText(payload.pastSurgery) || 'no';
  const pastSurgeryDetails = cleanText(payload.pastSurgeryDetails);
  const additionalNotes = cleanText(payload.additionalNotes);

  const payment = buildPaymentSnapshot(payload);
  const idDoc = normalizeIdDocument(payload);

  return {
    relationshipToUser,
    accessRole,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    ageYears: parseOptionalInt(payload.ageYears, 'ageYears') ||
      (dateOfBirth ? Math.max(0, new Date().getFullYear() - dateOfBirth.getFullYear()) : null),
    bloodGroup: cleanText(payload.bloodGroup),
    nationality: cleanText(payload.nationality),
    maritalStatus: cleanText(payload.maritalStatus),
    occupation: cleanText(payload.occupation),
    religion: cleanText(payload.religion),
    motherTongue: cleanText(payload.motherTongue),
    phone: sanitizePhone(payload.phone, { fieldName: 'phone', required: false }),
    phoneCountryCode: cleanText(payload.phoneCountryCode || payload.mobileCode) || '+91',
    email: cleanText(payload.email),
    altPhone: sanitizePhone(payload.altPhone, { fieldName: 'altPhone', required: false }),
    street1: cleanText(payload.street1),
    street2: cleanText(payload.street2),
    city: cleanText(payload.city),
    pincodeText: cleanText(payload.pincodeText || payload.pincode),
    districtId: parseOptionalInt(payload.districtId, 'districtId'),
    stateId: parseOptionalInt(payload.stateId, 'stateId'),
    countryId: parseOptionalInt(payload.countryId, 'countryId'),
    pincodeId: parseOptionalInt(payload.pincodeId, 'pincodeId'),
    emergencyName,
    emergencyRelation: cleanText(payload.emergencyRelation || payload.emRelation),
    emergencyPhone: sanitizePhone(payload.emergencyPhone || payload.emPhone, { fieldName: 'emergencyPhone', required: false }),
    insuranceProvider: cleanText(payload.insuranceProvider || payload.insurance),
    insurancePolicyNo: cleanText(payload.insurancePolicyNo || payload.policyNo),
    insuranceValidUntil: parseDateOnly(payload.insuranceValidUntil || payload.policyExpiry, 'insuranceValidUntil'),
    knownAllergies,
    chronicConditions: [
      chronicConditions,
      pastSurgery === 'yes' && pastSurgeryDetails ? `Past Surgery: ${pastSurgeryDetails}` : null,
      additionalNotes ? `Additional Notes: ${additionalNotes}` : null,
    ].filter(Boolean).join('\n\n') || null,
    currentMedications,
    fatherName: cleanText(payload.fatherName),
    husbandName: cleanText(payload.husbandName),
    dateOfArrival: parseDateOnly(payload.dateOfArrival, 'dateOfArrival'),
    additionalNotes,
    pastSurgery,
    pastSurgeryDetails,
    countryCode: cleanText(payload.countryCode),
    countryName: cleanText(payload.countryName),
    stateName: cleanText(payload.stateName),
    idType: cleanText(payload.idType),
    ...idDoc,
    payment,
  };
};

const registerLinkedPatientProfile = async ({ authUser, payload = {} }) => {
  const hospitalId = authUser.hospitalId;
  const ownerUserId = authUser.id || authUser.userId;

  if (!hospitalId || !ownerUserId) {
    throw new AppError('Authenticated patient context is required', 401);
  }

  const pool = await getPool();
  const schemaState = await getRegistrationSchemaState(pool);
  if (!schemaState.hasRegistrationTable) {
    throw new AppError('Patient profile registration payment setup is not enabled yet. Run the linked profile SQL update first.', 409);
  }

  const normalized = normalizeLinkedPatientPayload(payload);

  const created = await withTransaction(async (transaction) => {
    const patientUhid = await generateUniquePatientId(transaction);

    const existingProfilesResult = await new sql.Request(transaction)
      .input('OwnerUserId', sql.BigInt, ownerUserId)
      .query(`
        SELECT COUNT(*) AS TotalProfiles
        FROM dbo.PatientProfileAccess
        WHERE UserId = @OwnerUserId
          AND Status = 'Active'
      `);

    const isPrimaryProfile = (existingProfilesResult.recordset[0]?.TotalProfiles || 0) === 0 ? 1 : 0;

    const patientResult = await new sql.Request(transaction)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('UHID', sql.NVarChar(30), patientUhid)
      .input('FirstName', sql.NVarChar(100), normalized.firstName)
      .input('LastName', sql.NVarChar(100), normalized.lastName)
      .input('Gender', sql.NVarChar(20), normalized.gender)
      .input('DateOfBirth', sql.Date, normalized.dateOfBirth)
      .input('AgeYears', sql.SmallInt, normalized.ageYears)
      .input('BloodGroup', sql.NVarChar(5), normalized.bloodGroup)
      .input('Nationality', sql.NVarChar(80), normalized.nationality)
      .input('MaritalStatus', sql.NVarChar(20), normalized.maritalStatus)
      .input('Occupation', sql.NVarChar(150), normalized.occupation)
      .input('Religion', sql.NVarChar(80), normalized.religion)
      .input('MotherTongue', sql.NVarChar(80), normalized.motherTongue)
      .input('Phone', sql.NVarChar(20), normalized.phone)
      .input('PhoneCountryCode', sql.NVarChar(10), normalized.phoneCountryCode)
      .input('AltPhone', sql.NVarChar(20), normalized.altPhone)
      .input('Email', sql.NVarChar(255), normalized.email)
      .input('Aadhaar', sql.NVarChar(12), normalized.aadhaar)
      .input('PAN', sql.NVarChar(10), normalized.pan)
      .input('PassportNo', sql.NVarChar(30), normalized.passportNo)
      .input('VoterId', sql.NVarChar(30), normalized.voterId)
      .input('AbhaNumber', sql.NVarChar(30), normalized.abhaNumber)
      .input('Street1', sql.NVarChar(255), normalized.street1)
      .input('Street2', sql.NVarChar(255), normalized.street2)
      .input('City', sql.NVarChar(100), normalized.city)
      .input('DistrictId', sql.Int, normalized.districtId)
      .input('StateId', sql.Int, normalized.stateId)
      .input('CountryId', sql.Int, normalized.countryId)
      .input('PincodeId', sql.Int, normalized.pincodeId)
      .input('PincodeText', sql.NVarChar(20), normalized.pincodeText)
      .input('EmergencyName', sql.NVarChar(200), normalized.emergencyName)
      .input('EmergencyRelation', sql.NVarChar(80), normalized.emergencyRelation)
      .input('EmergencyPhone', sql.NVarChar(20), normalized.emergencyPhone)
      .input('InsuranceProvider', sql.NVarChar(200), normalized.insuranceProvider)
      .input('InsurancePolicyNo', sql.NVarChar(100), normalized.insurancePolicyNo)
      .input('InsuranceValidUntil', sql.Date, normalized.insuranceValidUntil)
      .input('KnownAllergies', sql.NVarChar(sql.MAX), normalized.knownAllergies)
      .input('ChronicConditions', sql.NVarChar(sql.MAX), normalized.chronicConditions)
      .input('CurrentMedications', sql.NVarChar(sql.MAX), normalized.currentMedications)
      .input('CreatedBy', sql.BigInt, ownerUserId)
      .query(`
        INSERT INTO dbo.PatientProfiles (
          UserId, HospitalId, UHID,
          FirstName, LastName, Gender, DateOfBirth, AgeYears,
          BloodGroup, Nationality, MaritalStatus, Occupation, Religion, MotherTongue,
          Phone, PhoneCountryCode, AltPhone, Email,
          Aadhaar, PAN, PassportNo, VoterId, AbhaNumber,
          Street1, Street2, City, DistrictId, StateId, CountryId, PincodeId, PincodeText,
          EmergencyName, EmergencyRelation, EmergencyPhone,
          InsuranceProvider, InsurancePolicyNo, InsuranceValidUntil,
          KnownAllergies, ChronicConditions, CurrentMedications,
          CreatedBy, UpdatedBy
        )
        OUTPUT INSERTED.Id, INSERTED.UHID
        VALUES (
          NULL, @HospitalId, @UHID,
          @FirstName, @LastName, @Gender, @DateOfBirth, @AgeYears,
          @BloodGroup, @Nationality, @MaritalStatus, @Occupation, @Religion, @MotherTongue,
          @Phone, @PhoneCountryCode, @AltPhone, @Email,
          @Aadhaar, @PAN, @PassportNo, @VoterId, @AbhaNumber,
          @Street1, @Street2, @City, @DistrictId, @StateId, @CountryId, @PincodeId, @PincodeText,
          @EmergencyName, @EmergencyRelation, @EmergencyPhone,
          @InsuranceProvider, @InsurancePolicyNo, @InsuranceValidUntil,
          @KnownAllergies, @ChronicConditions, @CurrentMedications,
          @CreatedBy, @CreatedBy
        )
      `);

    const createdPatient = patientResult.recordset[0];
    if (!createdPatient?.Id) {
      throw new AppError('Failed to create linked patient profile', 500);
    }

    const accessResult = await new sql.Request(transaction)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('UserId', sql.BigInt, ownerUserId)
      .input('PatientId', sql.BigInt, createdPatient.Id)
      .input('AccessRole', sql.NVarChar(20), normalized.accessRole)
      .input('RelationshipToUser', sql.NVarChar(30), normalized.relationshipToUser)
      .input('IsPrimaryProfile', sql.Bit, isPrimaryProfile)
      .input('CreatedBy', sql.BigInt, ownerUserId)
      .query(`
        INSERT INTO dbo.PatientProfileAccess (
          HospitalId, UserId, PatientId, AccessRole, RelationshipToUser,
          IsPrimaryProfile, CanBookAppointments, CanViewReports,
          CanViewPrescriptions, CanManageBilling, CanUpdateProfile,
          Status, CreatedBy, UpdatedBy
        )
        OUTPUT INSERTED.Id
        VALUES (
          @HospitalId, @UserId, @PatientId, @AccessRole, @RelationshipToUser,
          @IsPrimaryProfile, 1, 1,
          1, 1, 1,
          'Active', @CreatedBy, @CreatedBy
        )
      `);

    const registrationPayloadJson = JSON.stringify({
      fatherName: normalized.fatherName,
      husbandName: normalized.husbandName,
      dateOfArrival: normalized.dateOfArrival ? normalized.dateOfArrival.toISOString().slice(0, 10) : null,
      additionalNotes: normalized.additionalNotes,
      pastSurgery: normalized.pastSurgery,
      pastSurgeryDetails: normalized.pastSurgeryDetails,
      countryCode: normalized.countryCode,
      countryName: normalized.countryName,
      stateName: normalized.stateName,
      idType: normalized.idType,
      relationshipToUser: normalized.relationshipToUser,
    });

    const registrationRecordResult = await new sql.Request(transaction)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('OwnerUserId', sql.BigInt, ownerUserId)
      .input('PatientId', sql.BigInt, createdPatient.Id)
      .input('RegistrationMode', sql.NVarChar(20), 'family_profile')
      .input('RelationshipToUser', sql.NVarChar(30), normalized.relationshipToUser)
      .input('RegistrationStatus', sql.NVarChar(20), 'Completed')
      .input('RegistrationFee', sql.Decimal(10, 2), normalized.payment.registrationFee)
      .input('CurrencyCode', sql.NVarChar(10), normalized.payment.currencyCode)
      .input('PaymentMethod', sql.NVarChar(20), normalized.payment.paymentMethod)
      .input('PaymentStatus', sql.NVarChar(20), normalized.payment.paymentStatus)
      .input('PaymentReference', sql.NVarChar(120), normalized.payment.paymentReference)
      .input('PaymentPayloadJson', sql.NVarChar(sql.MAX), JSON.stringify(normalized.payment.paymentPayload))
      .input('RegistrationPayloadJson', sql.NVarChar(sql.MAX), registrationPayloadJson)
      .input('PaidAt', sql.DateTime2, normalized.payment.paidAt)
      .input('CreatedBy', sql.BigInt, ownerUserId)
      .query(`
        INSERT INTO dbo.PatientProfileRegistrations (
          HospitalId, OwnerUserId, PatientId,
          RegistrationMode, RelationshipToUser, RegistrationStatus,
          RegistrationFee, CurrencyCode,
          PaymentMethod, PaymentStatus, PaymentReference,
          PaymentPayloadJson, RegistrationPayloadJson,
          PaidAt, CreatedBy, UpdatedBy
        )
        OUTPUT INSERTED.Id
        VALUES (
          @HospitalId, @OwnerUserId, @PatientId,
          @RegistrationMode, @RelationshipToUser, @RegistrationStatus,
          @RegistrationFee, @CurrencyCode,
          @PaymentMethod, @PaymentStatus, @PaymentReference,
          @PaymentPayloadJson, @RegistrationPayloadJson,
          @PaidAt, @CreatedBy, @CreatedBy
        )
      `);

    const adminRecipients = await getAdminRecipientIds(transaction, hospitalId);

    return {
      patientProfileId: createdPatient.Id,
      uhid: createdPatient.UHID,
      accessId: accessResult.recordset[0]?.Id || null,
      registrationId: registrationRecordResult.recordset[0]?.Id || null,
      adminRecipients,
      paymentStatus: normalized.payment.paymentStatus,
      paymentMethod: normalized.payment.paymentMethod,
      registrationFee: normalized.payment.registrationFee,
      relationshipToUser: normalized.relationshipToUser,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
    };
  });

  const ownerNotificationBody = `${created.firstName} ${created.lastName} has been added under your family login with payment status ${created.paymentStatus.toLowerCase()}.`;

  await Promise.allSettled([
    notificationService.createNotification({
      hospitalId,
      userId: ownerUserId,
      notifType: 'system',
      title: 'New patient profile added',
      body: ownerNotificationBody,
      link: '/patient/profiles',
      dataJson: {
        patientId: created.patientProfileId,
        uhid: created.uhid,
        registrationId: created.registrationId,
      },
    }),
    created.adminRecipients.length
      ? notificationService.createBulkNotifications(
          created.adminRecipients.map((userId) => ({
            hospitalId,
            userId,
            notifType: 'system',
            title: 'Family patient profile registered',
            body: `${created.firstName} ${created.lastName} was added under an existing patient login.`,
            link: '/admin/people',
            dataJson: {
              patientId: created.patientProfileId,
              uhid: created.uhid,
              relationshipToUser: created.relationshipToUser,
              paymentStatus: created.paymentStatus,
              paymentMethod: created.paymentMethod,
            },
          }))
        )
      : Promise.resolve(),
  ]);

  return created;
};

module.exports = {
  getRegistrationSchemaState,
  normalizeLinkedPatientPayload,
  registerLinkedPatientProfile,
};
