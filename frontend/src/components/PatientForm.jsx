import { useEffect, useState } from "react";
import api from "../api/client";
import { Button, Field, Input, Modal, Select, Spinner, useToast } from "./ui";

const BLANK = {
  patient_id: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  address_line: "",
  postcode: "",
  gp_practice: "",
  gp_name: "",
  allergies: "",
  special_instructions: "",
  status: "active",
  is_dosette: false,
};

function FieldError({ errors, name }) {
  if (!errors[name]) return null;
  return (
    <span className="mt-1 block text-caption text-danger-fg">
      {Array.isArray(errors[name]) ? errors[name][0] : String(errors[name])}
    </span>
  );
}

/** Create or edit a patient. Pass `patient` to edit, omit to create. */
export function PatientForm({ open, patient, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const editing = !!patient?.id;

  useEffect(() => {
    if (open) {
      setForm(patient ? { ...BLANK, ...patient } : BLANK);
      setErrors({});
    }
  }, [open, patient]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const payload = { ...form };
    try {
      if (editing) await api.patch(`/patients/${patient.id}/`, payload);
      else await api.post("/patients/", payload);
      toast.success(editing ? "Patient updated" : "Patient created");
      onSaved?.();
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setErrors(data);
      toast.error("Could not save patient — check the highlighted fields.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? `Edit ${patient.full_name || "patient"}` : "New patient"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="patient-form" type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : editing ? "Save changes" : "Create patient"}
          </Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Patient ID *">
          <Input value={form.patient_id} onChange={set("patient_id")} placeholder="PT-10500" required />
          <FieldError errors={errors} name="patient_id" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="First name *">
          <Input value={form.first_name} onChange={set("first_name")} required />
          <FieldError errors={errors} name="first_name" />
        </Field>
        <Field label="Last name *">
          <Input value={form.last_name} onChange={set("last_name")} required />
          <FieldError errors={errors} name="last_name" />
        </Field>
        <Field label="Date of birth *">
          <Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} required />
          <FieldError errors={errors} name="date_of_birth" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Address">
          <Input value={form.address_line} onChange={set("address_line")} />
        </Field>
        <Field label="Postcode">
          <Input value={form.postcode} onChange={set("postcode")} />
        </Field>
        <Field label="GP practice (simulated)">
          <Input value={form.gp_practice} onChange={set("gp_practice")} />
        </Field>
        <Field label="Prescriber (simulated)">
          <Input value={form.gp_name} onChange={set("gp_name")} />
        </Field>
        <div className="col-span-2">
          <Field label="Allergies">
            <Input value={form.allergies} onChange={set("allergies")} placeholder="e.g. Penicillin" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Special instructions">
            <Input value={form.special_instructions} onChange={set("special_instructions")} />
          </Field>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-body text-text-secondary">
          <input type="checkbox" checked={form.is_dosette} onChange={set("is_dosette")} className="h-4 w-4 accent-[#4F46E5]" />
          Enrolled on a compliance (dosette) pack
        </label>
      </form>
    </Modal>
  );
}
