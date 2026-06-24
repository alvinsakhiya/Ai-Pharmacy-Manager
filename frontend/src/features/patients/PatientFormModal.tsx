import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import {
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "../../components/ui/forms";
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
    <ul className="mt-1.5 space-y-1 text-xs font-medium text-danger-ink">
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
  const { success } = useToast();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const [pharmacy, setPharmacy] = useState("");
  const [patientReference, setPatientReference] = useState("");
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
    setTitle(patient?.title ?? "");
    setFirstName(patient?.first_name ?? "");
    setLastName(patient?.last_name ?? "");
    setDateOfBirth(patient?.date_of_birth ?? "");
    setGender(patient?.gender ?? "");
    setAddress(patient?.address ?? "");
    setPostcode(patient?.postcode ?? "");
    setPhone(patient?.phone ?? "");
    setEmail(patient?.email ?? "");
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
      title: title.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth,
      gender: gender.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
    };

    try {
      if (patient) {
        await updatePatient.mutateAsync({ id: patient.id, body });
        success("Patient updated");
      } else {
        const createBody: PatientWriteBody = {
          pharmacy: Number(pharmacy),
          ...body,
        };
        await createPatient.mutateAsync(createBody);
        success("Patient created");
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

        <label className={labelClass}>
          Pharmacy
          {patient || pharmacies.length === 1 ? (
            <input
              className={inputClass}
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
              className={selectClass}
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
          <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-ink">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            No pharmacies are available for patient creation in your current
            scope.
          </p>
        ) : null}

        <label className={labelClass}>
          Patient reference
          <input
            className={inputClass}
            onChange={(event) => setPatientReference(event.target.value)}
            required
            type="text"
            value={patientReference}
          />
          <FieldErrorList
            messages={errorMessages(errors, "patient_reference")}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-[140px_1fr_1fr]">
          <label className={labelClass}>
            Title
            <select
              className={selectClass}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            >
              <option value="">—</option>
              {["Mr", "Mrs", "Miss", "Ms", "Dr", "Mx"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "title")} />
          </label>

          <label className={labelClass}>
            First name
            <input
              className={inputClass}
              onChange={(event) => setFirstName(event.target.value)}
              required
              type="text"
              value={firstName}
            />
            <FieldErrorList messages={errorMessages(errors, "first_name")} />
          </label>

          <label className={labelClass}>
            Last name
            <input
              className={inputClass}
              onChange={(event) => setLastName(event.target.value)}
              required
              type="text"
              value={lastName}
            />
            <FieldErrorList messages={errorMessages(errors, "last_name")} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Date of birth
            <input
              className={`${inputClass} tnum`}
              onChange={(event) => setDateOfBirth(event.target.value)}
              required
              type="date"
              value={dateOfBirth}
            />
            <FieldErrorList messages={errorMessages(errors, "date_of_birth")} />
          </label>

          <label className={labelClass}>
            Gender
            <select
              className={selectClass}
              onChange={(event) => setGender(event.target.value)}
              value={gender}
            >
              <option value="">Prefer not to say</option>
              {["Female", "Male", "Other"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "gender")} />
          </label>
        </div>

        <label className={labelClass}>
          Address
          <input
            className={inputClass}
            onChange={(event) => setAddress(event.target.value)}
            type="text"
            value={address}
          />
          <FieldErrorList messages={errorMessages(errors, "address")} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Postcode
            <input
              className={inputClass}
              onChange={(event) => setPostcode(event.target.value)}
              type="text"
              value={postcode}
            />
            <FieldErrorList messages={errorMessages(errors, "postcode")} />
          </label>

          <label className={labelClass}>
            Phone
            <input
              className={`${inputClass} tnum`}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              value={phone}
            />
            <FieldErrorList messages={errorMessages(errors, "phone")} />
          </label>
        </div>

        <label className={labelClass}>
          Email
          <input
            className={inputClass}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <FieldErrorList messages={errorMessages(errors, "email")} />
        </label>

        <label className={labelClass}>
          Notes
          <textarea
            className={textareaClass}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSaving || !hasPharmacyScope}
          >
            {isSaving ? "Saving..." : "Save patient"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
