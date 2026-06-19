import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import type { Patient, PatientUpdateBody, PatientWriteBody } from "./patientApi";
import { useCreatePatient, useUpdatePatient } from "./usePatients";
import { usePharmacyNames } from "./usePharmacyNames";

interface PatientFormModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
}

function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1 text-sm text-red-700">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function PatientFormModal({
  patient,
  isOpen,
  onClose,
}: PatientFormModalProps) {
  const { user } = useAuth();
  const pharmacies = useMemo(() => user?.pharmacies ?? [], [user?.pharmacies]);
  const { pharmacyName } = usePharmacyNames();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const [pharmacy, setPharmacy] = useState("");
  const [patientReference, setPatientReference] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPharmacy(
      patient
        ? String(patient.pharmacy)
        : pharmacies.length === 1
          ? String(pharmacies[0].id)
          : "",
    );
    setPatientReference(patient?.patient_reference ?? "");
    setFirstName(patient?.first_name ?? "");
    setLastName(patient?.last_name ?? "");
    setDateOfBirth(patient?.date_of_birth ?? "");
    setAddress(patient?.address ?? "");
    setPostcode(patient?.postcode ?? "");
    setPhone(patient?.phone ?? "");
    setNotes(patient?.notes ?? "");
    setErrors({});
  }, [isOpen, patient, pharmacies]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!patient && !pharmacy) {
      nextErrors.pharmacy = ["Pharmacy is required."];
    }
    if (!patientReference.trim()) {
      nextErrors.patient_reference = ["Patient reference is required."];
    }
    if (!firstName.trim()) {
      nextErrors.first_name = ["First name is required."];
    }
    if (!lastName.trim()) {
      nextErrors.last_name = ["Last name is required."];
    }
    if (!dateOfBirth) {
      nextErrors.date_of_birth = ["Date of birth is required."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body: PatientUpdateBody = {
      patient_reference: patientReference.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth,
      address: address.trim(),
      postcode: postcode.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
    };

    try {
      if (patient) {
        await updatePatient.mutateAsync({ id: patient.id, body });
      } else {
        const createBody: PatientWriteBody = {
          pharmacy: Number(pharmacy),
          ...body,
        };
        await createPatient.mutateAsync(createBody);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createPatient.isPending || updatePatient.isPending;
  const hasPharmacyScope = patient !== null || pharmacies.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={patient ? "Edit patient" : "Create patient"}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Pharmacy
          {patient || pharmacies.length === 1 ? (
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 shadow-sm"
              disabled
              readOnly
              type="text"
              value={
                patient
                  ? pharmacyName(patient.pharmacy)
                  : pharmacies[0]?.name ?? ""
              }
            />
          ) : (
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setPharmacy(event.target.value)}
              required
              value={pharmacy}
            >
              <option value="">Select a pharmacy</option>
              {pharmacies.map((pharmacyOption) => (
                <option key={pharmacyOption.id} value={pharmacyOption.id}>
                  {pharmacyOption.name}
                </option>
              ))}
            </select>
          )}
          <FieldErrorList messages={errorMessages(errors, "pharmacy")} />
        </label>

        {!hasPharmacyScope ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No pharmacies are available for patient creation in your current
            scope.
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Patient reference
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setPatientReference(event.target.value)}
            required
            type="text"
            value={patientReference}
          />
          <FieldErrorList
            messages={errorMessages(errors, "patient_reference")}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            First name
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setFirstName(event.target.value)}
              required
              type="text"
              value={firstName}
            />
            <FieldErrorList messages={errorMessages(errors, "first_name")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Last name
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setLastName(event.target.value)}
              required
              type="text"
              value={lastName}
            />
            <FieldErrorList messages={errorMessages(errors, "last_name")} />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Date of birth
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setDateOfBirth(event.target.value)}
            required
            type="date"
            value={dateOfBirth}
          />
          <FieldErrorList messages={errorMessages(errors, "date_of_birth")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Address
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setAddress(event.target.value)}
            type="text"
            value={address}
          />
          <FieldErrorList messages={errorMessages(errors, "address")} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Postcode
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setPostcode(event.target.value)}
              type="text"
              value={postcode}
            />
            <FieldErrorList messages={errorMessages(errors, "postcode")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              value={phone}
            />
            <FieldErrorList messages={errorMessages(errors, "phone")} />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Notes
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || !hasPharmacyScope}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
