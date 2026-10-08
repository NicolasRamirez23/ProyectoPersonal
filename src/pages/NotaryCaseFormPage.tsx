import { FormEvent, ReactNode, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../components/Input";
import { useAlerts } from "../components/AlertProvider";
import { notaryProcessesApi } from "../services/notaryProcesses";
import type { NotaryClient, NotaryStageDraft } from "../types/notaryProcess";

const today = new Date().toISOString().slice(0, 10);
const emptyClient = {
  id: "",
  curp: "",
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  rfc: "",
  email: "",
  telefono: "",
  domicilio: "",
  notas: "",
};
const starter: NotaryStageDraft[] = [
  {
    concept: "Elaboración y firma de poder notarial",
    description:
      "Preparación del instrumento para representación del propietario.",
    deadline: "",
    cost: 0,
    responsible: "",
  },
  {
    concept: "Integración y revisión de compraventa",
    description:
      "Revisión documental, certificados, proyecto y firma de compraventa.",
    deadline: "",
    cost: 0,
    responsible: "",
  },
];
const field =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
export function NotaryCaseFormPage() {
  const [client, setClient] = useState<
    Omit<NotaryClient, "id"> & { id?: string }
  >(emptyClient);
  const [title, setTitle] = useState("");
  const [operationType, setOperationType] = useState("Compraventa");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState("");
  const [generalCost, setGeneralCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [stages, setStages] = useState(starter);
  const [saving, setSaving] = useState(false);
  const { notify } = useAlerts();
  const navigate = useNavigate();
  const setClientField = (key: keyof typeof client, value: string) =>
    setClient((current) => ({ ...current, [key]: value }));
  const searchClient = async () => {
    if (client.curp.trim().length < 18)
      return notify(
        "warning",
        "CURP incompleta",
        "Captura los 18 caracteres para buscar.",
      );
    try {
      const found = await notaryProcessesApi.findClientByCurp(client.curp);
      if (!found)
        return notify(
          "info",
          "Cliente nuevo",
          "No existe una persona con esa CURP. Completa sus datos.",
        );
      setClient(found);
      notify(
        "success",
        "Cliente localizado",
        "La información existente se cargó automáticamente.",
      );
    } catch (error) {
      notify(
        "error",
        "No se pudo buscar",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    }
  };
  const updateStage = (index: number, patch: Partial<NotaryStageDraft>) =>
    setStages((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  const move = (index: number, offset: number) =>
    setStages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stages.length || stages.some((stage) => !stage.concept.trim()))
      return notify(
        "warning",
        "Revisa las etapas",
        "Agrega al menos una etapa y asigna un concepto a cada una.",
      );
    setSaving(true);
    try {
      const savedClient = await notaryProcessesApi.saveClient(client);
      const result = await notaryProcessesApi.createCase({
        clientId: savedClient.id,
        title,
        operationType,
        description,
        startDate,
        targetDate,
        generalCost,
        discount,
        notes,
        stages,
      });
      notify(
        "success",
        "Expediente creado",
        `Se asignó el folio ${result.folio}.`,
      );
      navigate(`/notaria/expedientes/${result.id}`);
    } catch (error) {
      notify(
        "error",
        "No se pudo crear el expediente",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Link
          to="/notaria/expedientes"
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Expedientes
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Nuevo expediente notarial</h1>
        <p className="mt-2 text-sm text-slate-500">
          Primero identifica al cliente y después organiza el proceso en el
          orden jurídico y operativo correcto.
        </p>
      </div>
      <Section
        title="1. Cliente"
        subtitle="La CURP evita duplicados y permite reutilizar su expediente documental."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-end gap-2 md:col-span-2">
            <Input
              required
              maxLength={18}
              label="CURP"
              value={client.curp}
              onChange={(e) =>
                setClientField("curp", e.target.value.toUpperCase())
              }
            />
            <button
              type="button"
              onClick={() => void searchClient()}
              className="mb-0 inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </div>
          <Input
            label="RFC"
            value={client.rfc}
            onChange={(e) =>
              setClientField("rfc", e.target.value.toUpperCase())
            }
          />
          <Input
            required
            label="Nombre(s)"
            value={client.nombres}
            onChange={(e) =>
              setClientField("nombres", e.target.value.toUpperCase())
            }
          />
          <Input
            required
            label="Apellido paterno"
            value={client.apellidoPaterno}
            onChange={(e) =>
              setClientField("apellidoPaterno", e.target.value.toUpperCase())
            }
          />
          <Input
            label="Apellido materno"
            value={client.apellidoMaterno}
            onChange={(e) =>
              setClientField("apellidoMaterno", e.target.value.toUpperCase())
            }
          />
          <Input
            type="email"
            label="Correo"
            value={client.email}
            onChange={(e) => setClientField("email", e.target.value)}
          />
          <Input
            label="Teléfono"
            value={client.telefono}
            onChange={(e) => setClientField("telefono", e.target.value)}
          />
          <Input
            containerClassName="md:col-span-3"
            label="Domicilio"
            value={client.domicilio}
            onChange={(e) => setClientField("domicilio", e.target.value)}
          />
        </div>
      </Section>
      <Section title="2. Datos del expediente">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            required
            label="Nombre del expediente"
            placeholder="Ej. Venta casa Col. Centro"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-sm font-medium text-slate-700">
            Tipo de operación
            <select
              className={`${field} mt-1.5`}
              value={operationType}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "Búsqueda de sucesión") {
                  navigate("/notaria/sucesiones?crear=1");
                  return;
                }
                setOperationType(value);
              }}
            >
              <option>Compraventa</option>
              <option>Poder notarial</option>
              <option>Donación</option>
              <option>Búsqueda de sucesión</option>
              <option>Constitución de sociedad</option>
              <option>Protocolización</option>
              <option>Otro</option>
            </select>
          </label>
          <Input
            required
            type="date"
            label="Fecha de inicio"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="Fecha objetivo general"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Descripción
            <textarea
              rows={3}
              className={`${field} mt-1.5 h-auto py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </Section>
      <Section
        title="3. Procesos y orden"
        subtitle="Las etapas se ejecutan de arriba hacia abajo. Puedes moverlas para reflejar la secuencia real."
      >
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={index} className="rounded-xl border bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-slate-700">
                  {index + 1}. {stage.concept || "Nueva etapa"}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    className="rounded-lg border bg-white p-2"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    className="rounded-lg border bg-white p-2"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={stages.length === 1}
                    onClick={() =>
                      setStages((items) => items.filter((_, i) => i !== index))
                    }
                    className="rounded-lg border bg-white p-2 text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Input
                  required
                  label="Concepto"
                  value={stage.concept}
                  onChange={(e) =>
                    updateStage(index, { concept: e.target.value })
                  }
                />
                <Input
                  type="date"
                  label="Fecha límite"
                  value={stage.deadline}
                  onChange={(e) =>
                    updateStage(index, { deadline: e.target.value })
                  }
                />
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  label="Costo"
                  value={stage.cost}
                  onChange={(e) =>
                    updateStage(index, { cost: Number(e.target.value) })
                  }
                />
                <Input
                  label="Responsable"
                  value={stage.responsible}
                  onChange={(e) =>
                    updateStage(index, { responsible: e.target.value })
                  }
                />
                <label className="text-sm font-medium text-slate-700 md:col-span-2 lg:col-span-4">
                  Descripción
                  <textarea
                    rows={2}
                    className={`${field} mt-1.5 h-auto py-2`}
                    value={stage.description}
                    onChange={(e) =>
                      updateStage(index, { description: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setStages((items) => [
                ...items,
                {
                  concept: "",
                  description: "",
                  deadline: "",
                  cost: 0,
                  responsible: "",
                },
              ])
            }
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-300 px-4 py-3 text-sm font-bold text-blue-600"
          >
            <Plus className="h-4 w-4" />
            Agregar etapa
          </button>
        </div>
      </Section>
      <Section title="4. Cotización">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            min="0"
            step="0.01"
            type="number"
            label="Costo general (opcional)"
            value={generalCost}
            onChange={(e) => setGeneralCost(Number(e.target.value))}
          />
          <Input
            min="0"
            step="0.01"
            type="number"
            label="Descuento"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs text-blue-600">Total estimado</p>
            <p className="mt-1 text-xl font-bold text-blue-900">
              {Math.max(
                0,
                (generalCost ||
                  stages.reduce((sum, item) => sum + item.cost, 0)) - discount,
              ).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
            </p>
          </div>
          <label className="text-sm font-medium text-slate-700 md:col-span-3">
            Notas internas
            <textarea
              rows={3}
              className={`${field} mt-1.5 h-auto py-2`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </Section>
      <div className="flex justify-end gap-3">
        <Link
          to="/notaria/expedientes"
          className="rounded-xl border px-5 py-3 text-sm font-bold"
        >
          Cancelar
        </Link>
        <button
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Crear expediente"}
        </button>
      </div>
    </form>
  );
}
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
