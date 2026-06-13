import { useEffect, useState } from "react";
import api from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Button, Field, Input, Modal, Select, Spinner, useToast } from "./ui";

const FORMS = ["tablet", "capsule", "liquid", "inhaler", "sachet", "other"];

const MED_BLANK = {
  name: "", strength: "", form: "tablet", pack_size: 28, unit: "tablet",
  reorder_level: 200, reorder_quantity: 400, unit_cost: "0.00", is_active: true,
};

/** Create or edit a medicine. Pass `medicine` to edit. */
export function MedicineForm({ open, medicine, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(MED_BLANK);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const editing = !!medicine?.id;

  useEffect(() => {
    if (open) {
      setForm(medicine ? { ...MED_BLANK, ...medicine } : MED_BLANK);
      setErrors({});
    }
  }, [open, medicine]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (editing) await api.patch(`/medicines/${medicine.id}/`, form);
      else await api.post("/medicines/", form);
      toast.success(editing ? "Medicine updated" : "Medicine created");
      onSaved?.();
      onClose();
    } catch (err) {
      if (err.response?.data && typeof err.response.data === "object") setErrors(err.response.data);
      toast.error("Could not save medicine.");
    } finally {
      setBusy(false);
    }
  }

  const Err = ({ name }) =>
    errors[name] ? <span className="mt-1 block text-caption text-danger-fg">{Array.isArray(errors[name]) ? errors[name][0] : String(errors[name])}</span> : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${medicine.label || "medicine"}` : "New medicine"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="medicine-form" type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : editing ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <form id="medicine-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Name *"><Input value={form.name} onChange={set("name")} required /><Err name="name" /></Field>
        </div>
        <Field label="Strength"><Input value={form.strength} onChange={set("strength")} placeholder="5mg" /></Field>
        <Field label="Form">
          <Select value={form.form} onChange={set("form")}>
            {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Pack size"><Input type="number" min="1" value={form.pack_size} onChange={set("pack_size")} /></Field>
        <Field label="Unit"><Input value={form.unit} onChange={set("unit")} /></Field>
        <Field label="Reorder level"><Input type="number" min="0" value={form.reorder_level} onChange={set("reorder_level")} /></Field>
        <Field label="Reorder quantity"><Input type="number" min="0" value={form.reorder_quantity} onChange={set("reorder_quantity")} /></Field>
        <Field label="Unit cost (£)"><Input type="number" step="0.0001" min="0" value={form.unit_cost} onChange={set("unit_cost")} /></Field>
        <label className="flex items-end gap-2 pb-2 text-body text-text-secondary">
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="h-4 w-4 accent-[#4F46E5]" />
          Active
        </label>
        <Err name="non_field_errors" />
      </form>
    </Modal>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Goods-in: add a new stock batch for a given medicine. */
export function BatchForm({ open, medicine, onClose, onSaved }) {
  const toast = useToast();
  const suppliers = useFetch("/suppliers/", { params: { page_size: 100 }, skip: !open });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && medicine) {
      setForm({
        batch_number: "", expiry_date: "", quantity_received: 0,
        location: "", unit_cost: medicine.unit_cost ?? "0.00", supplier: "",
      });
      setErrors({});
    }
  }, [open, medicine]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post("/batches/", {
        medicine: medicine.id,
        batch_number: form.batch_number,
        expiry_date: form.expiry_date,
        quantity_received: Number(form.quantity_received),
        quantity_on_hand: Number(form.quantity_received),
        location: form.location,
        unit_cost: form.unit_cost,
        supplier: form.supplier || null,
        received_date: today(),
      });
      toast.success("Stock received");
      onSaved?.();
      onClose();
    } catch (err) {
      if (err.response?.data && typeof err.response.data === "object") setErrors(err.response.data);
      toast.error("Could not record goods-in.");
    } finally {
      setBusy(false);
    }
  }

  if (!form) return null;
  const Err = ({ name }) =>
    errors[name] ? <span className="mt-1 block text-caption text-danger-fg">{Array.isArray(errors[name]) ? errors[name][0] : String(errors[name])}</span> : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Goods in · ${medicine?.label || ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="batch-form" type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : "Receive stock"}
          </Button>
        </>
      }
    >
      <form id="batch-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Batch number *"><Input value={form.batch_number} onChange={set("batch_number")} required /><Err name="batch_number" /></Field>
        <Field label="Expiry date *"><Input type="date" value={form.expiry_date} onChange={set("expiry_date")} required /><Err name="expiry_date" /></Field>
        <Field label="Quantity received *"><Input type="number" min="1" value={form.quantity_received} onChange={set("quantity_received")} required /><Err name="quantity_received" /></Field>
        <Field label="Location"><Input value={form.location} onChange={set("location")} placeholder="A3" /></Field>
        <Field label="Unit cost (£)"><Input type="number" step="0.0001" min="0" value={form.unit_cost} onChange={set("unit_cost")} /></Field>
        <Field label="Supplier">
          <Select value={form.supplier} onChange={set("supplier")}>
            <option value="">—</option>
            {(suppliers.data?.results || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
