import { FormEvent, ReactNode, useEffect, useState } from "react";
import { FilePlus2, Search, Trash2, UsersRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "../components/Input";
import { useAlerts } from "../components/AlertProvider";
import { notaryProcessesApi } from "../services/notaryProcesses";
import { notarySuccessionsApi } from "../services/notarySuccessions";
import type {
  NotarySuccession,
  SuccessionPerson,
  SuccessionRoute,
} from "../types/notaryProcess";

const today = new Date().toISOString().slice(0, 10);
const field =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500";
const emptyClient = () => ({
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
  birthPlace: "",
  birthDate: "",
  nationality: "MEXICANA",
  maritalStatus: "",
  occupation: "",
});
const emptyPerson = (principal = false): SuccessionPerson => ({
  client: emptyClient(),
  role: principal ? "solicitante" : "heredero",
  relationship: "",
  principal,
});
const emptyDeceased: NotarySuccession["deceased"] = {
  name: "",
  gender: "M",
  birthDate: "",
  birthPlace: "",
  nationality: "MEXICANA",
  maritalStatus: "",
  occupation: "",
  curp: "",
  rfc: "",
  address: "",
  deathDate: "",
  deathPlace: "",
  deathCertificate: "",
};
const emptyWill: NotarySuccession["will"] = {
  instrument: "",
  volume: "",
  date: "",
  notary: "",
  notaryNumber: "",
  place: "La Paz, Baja California Sur",
  mainDisposition: "",
};
const routeRequirements = {
  testamentaria: [
    "Acta certificada de defunción",
    "Testamento",
    "Identificación oficial",
    "Constancia de situación fiscal vigente",
  ],
  intestamentaria: [
    "Acta certificada de defunción",
    "Acta certificada de matrimonio, si aplica",
    "Actas de nacimiento de hijos",
    "Dos testigos",
  ],
};

export function NotarySuccessionsPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(searchParams.get("crear") === "1");
  const [route, setRoute] = useState<SuccessionRoute>("testamentaria");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState("");
  const [cost, setCost] = useState(0);
  const [deceased, setDeceased] = useState(emptyDeceased);
  const [will, setWill] = useState(emptyWill);
  const [people, setPeople] = useState<SuccessionPerson[]>([emptyPerson(true)]);
  const [saving, setSaving] = useState(false);
  const { notify } = useAlerts();
  const navigate = useNavigate();
  const load = async () => {
    try {
      setItems(await notarySuccessionsApi.list());
    } catch (error) {
      notify(
        "error",
        "No se pudieron cargar las sucesiones",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const updatePerson = (index: number, patch: Partial<SuccessionPerson>) =>
    setPeople((current) =>
      current.map((person, position) =>
        position === index ? { ...person, ...patch } : person,
      ),
    );
  const updateClient = (index: number, key: string, value: string) =>
    setPeople((current) =>
      current.map((person, position) =>
        position === index
          ? { ...person, client: { ...person.client, [key]: value } }
          : person,
      ),
    );
  const findPerson = async (index: number) => {
    const curp = people[index].client.curp;
    if (curp.length !== 18)
      return notify("warning", "CURP incompleta", "Captura los 18 caracteres.");
    try {
      const found = await notaryProcessesApi.findClientByCurp(curp);
      if (!found)
        return notify("info", "Persona nueva", "Completa sus datos generales.");
      updatePerson(index, { client: found });
      notify("success", "Persona localizada", "Se recuperaron sus generales.");
    } catch (error) {
      notify(
        "error",
        "No se pudo buscar",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !people.length ||
      people.some((person) => !person.client.curp || !person.client.nombres)
    )
      return notify(
        "warning",
        "Generales incompletas",
        "Todas las personas requieren nombre y CURP.",
      );
    if (
      route === "intestamentaria" &&
      people.filter((person) => person.role === "testigo").length < 2
    )
      return notify(
        "warning",
        "Faltan testigos",
        "La vía intestamentaria requiere dos testigos.",
      );
    setSaving(true);
    try {
      const result = await notarySuccessionsApi.create({
        route,
        title,
        startDate,
        targetDate,
        generalCost: cost,
        deceased,
        will,
        people,
      });
      notify(
        "success",
        "Sucesión creada",
        "Se generó el expediente y su ruta de trabajo.",
      );
      navigate(`/notaria/sucesiones/${result.id}`);
    } catch (error) {
      notify(
        "error",
        "No se pudo crear la sucesión",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (!creating)
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Notaría 2
            </p>
            <h1 className="mt-1 text-3xl font-bold">Sucesiones</h1>
            <p className="mt-2 text-sm text-slate-500">
              Expedientes testamentarios e intestamentarios con requisitos y
              búsquedas controladas.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white"
          >
            <FilePlus2 className="h-4 w-4" />
            Nueva sucesión
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {items.length === 0 ? (
            <div className="p-12 text-center">
              <UsersRound className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-bold">No hay sucesiones registradas</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => {
                const caseData = item.notaria_expedientes;
                const client = caseData?.notaria_clientes;
                return (
                  <Link
                    key={item.id}
                    to={`/notaria/sucesiones/${item.id}`}
                    className="grid gap-3 p-5 hover:bg-slate-50 md:grid-cols-[1fr_180px_150px]"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {caseData?.folio}
                      </span>
                      <h2 className="mt-1 font-bold">{item.autor_nombre}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Solicitante:{" "}
                        {[
                          client?.nombres,
                          client?.apellido_paterno,
                          client?.apellido_materno,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Vía</p>
                      <p className="mt-1 text-sm font-bold capitalize">
                        {item.via}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Etapa</p>
                      <p className="mt-1 text-sm font-bold capitalize">
                        {item.estatus}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="text-sm font-bold text-blue-600"
        >
          ← Volver a sucesiones
        </button>
        <h1 className="mt-3 text-3xl font-bold">Nueva sucesión</h1>
      </div>
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
          Plantilla activa
        </p>
        <h2 className="mt-1 text-lg font-bold text-blue-950">
          Búsqueda de sucesión
        </h2>
        <p className="mt-1 text-sm text-blue-800">
          Al crear el expediente quedarán preparados estos controles bajo un
          solo folio.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["1", "Documento base", "Testamento o acta, según la vía"],
            ["2", "Registro Público", "Generar o subir solicitud y respuesta"],
            [
              "3",
              "Archivo de Notarías",
              "Generar o subir solicitud y respuesta",
            ],
          ].map(([number, title, detail]) => (
            <div
              key={number}
              className="rounded-xl border border-blue-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Section title="1. Vía y expediente">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Vía sucesoria
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value as SuccessionRoute)}
              className={`${field} mt-1.5`}
            >
              <option value="testamentaria">Existe testamento</option>
              <option value="intestamentaria">No existe testamento</option>
            </select>
          </label>
          <Input
            required
            label="Nombre del expediente"
            placeholder="Sucesión de..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            required
            type="date"
            label="Fecha de inicio"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="Fecha objetivo"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            label="Costo general"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-600">
              Requisitos de esta vía
            </p>
            {routeRequirements[route].map((value) => (
              <p key={value} className="mt-1 text-xs text-blue-900">
                • {value}
              </p>
            ))}
          </div>
        </div>
      </Section>
      <Section title="2. Autor de la sucesión">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            required
            label="Nombre completo"
            value={deceased.name}
            onChange={(e) =>
              setDeceased({ ...deceased, name: e.target.value.toUpperCase() })
            }
          />
          <label className="text-sm font-medium">
            Género
            <select
              value={deceased.gender}
              onChange={(e) =>
                setDeceased({
                  ...deceased,
                  gender: e.target.value as "M" | "F",
                })
              }
              className={`${field} mt-1.5`}
            >
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </label>
          <Input
            label="CURP"
            maxLength={18}
            value={deceased.curp}
            onChange={(e) =>
              setDeceased({ ...deceased, curp: e.target.value.toUpperCase() })
            }
          />
          <Input
            label="RFC"
            value={deceased.rfc}
            onChange={(e) =>
              setDeceased({ ...deceased, rfc: e.target.value.toUpperCase() })
            }
          />
          <Input
            type="date"
            label="Fecha de nacimiento"
            value={deceased.birthDate}
            onChange={(e) =>
              setDeceased({ ...deceased, birthDate: e.target.value })
            }
          />
          <Input
            label="Lugar de nacimiento"
            value={deceased.birthPlace}
            onChange={(e) =>
              setDeceased({ ...deceased, birthPlace: e.target.value })
            }
          />
          <Input
            required
            type="date"
            label="Fecha de defunción"
            value={deceased.deathDate}
            onChange={(e) =>
              setDeceased({ ...deceased, deathDate: e.target.value })
            }
          />
          <Input
            required
            label="Lugar de defunción"
            value={deceased.deathPlace}
            onChange={(e) =>
              setDeceased({ ...deceased, deathPlace: e.target.value })
            }
          />
          <Input
            label="Datos del acta de defunción"
            value={deceased.deathCertificate}
            onChange={(e) =>
              setDeceased({ ...deceased, deathCertificate: e.target.value })
            }
          />
          <Input
            label="Estado civil"
            value={deceased.maritalStatus}
            onChange={(e) =>
              setDeceased({ ...deceased, maritalStatus: e.target.value })
            }
          />
          <Input
            label="Ocupación"
            value={deceased.occupation}
            onChange={(e) =>
              setDeceased({ ...deceased, occupation: e.target.value })
            }
          />
          <Input
            label="Domicilio"
            value={deceased.address}
            onChange={(e) =>
              setDeceased({ ...deceased, address: e.target.value })
            }
          />
        </div>
      </Section>
      {route === "testamentaria" && (
        <Section title="3. Testamento">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              required
              label="Instrumento"
              value={will.instrument}
              onChange={(e) => setWill({ ...will, instrument: e.target.value })}
            />
            <Input
              required
              label="Volumen"
              value={will.volume}
              onChange={(e) => setWill({ ...will, volume: e.target.value })}
            />
            <Input
              required
              type="date"
              label="Fecha"
              value={will.date}
              onChange={(e) => setWill({ ...will, date: e.target.value })}
            />
            <Input
              required
              label="Notario"
              value={will.notary}
              onChange={(e) =>
                setWill({ ...will, notary: e.target.value.toUpperCase() })
              }
            />
            <Input
              required
              label="Número de notaría"
              value={will.notaryNumber}
              onChange={(e) =>
                setWill({ ...will, notaryNumber: e.target.value })
              }
            />
            <Input
              required
              label="Lugar"
              value={will.place}
              onChange={(e) => setWill({ ...will, place: e.target.value })}
            />
            <label className="text-sm font-medium md:col-span-3">
              Disposición principal
              <textarea
                rows={3}
                value={will.mainDisposition}
                onChange={(e) =>
                  setWill({ ...will, mainDisposition: e.target.value })
                }
                className={`${field} mt-1.5 h-auto py-2`}
              />
            </label>
          </div>
        </Section>
      )}
      <Section
        title={`${route === "testamentaria" ? "4" : "3"}. Generales de interesados`}
      >
        <div className="space-y-4">
          {people.map((person, index) => (
            <div key={index} className="rounded-xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Persona {index + 1}</h3>
                <button
                  type="button"
                  disabled={people.length === 1}
                  onClick={() =>
                    setPeople((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                  className="text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="flex items-end gap-2 md:col-span-2">
                  <Input
                    required
                    maxLength={18}
                    label="CURP"
                    value={person.client.curp}
                    onChange={(e) =>
                      updateClient(index, "curp", e.target.value.toUpperCase())
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void findPerson(index)}
                    className="inline-flex h-10 items-center gap-1 rounded-lg border bg-white px-3 text-sm font-bold"
                  >
                    <Search className="h-4 w-4" />
                    Buscar
                  </button>
                </div>
                <label className="text-sm font-medium">
                  Rol
                  <select
                    value={person.role}
                    onChange={(e) =>
                      updatePerson(index, {
                        role: e.target.value as SuccessionPerson["role"],
                      })
                    }
                    className={`${field} mt-1.5`}
                  >
                    <option value="solicitante">Solicitante</option>
                    <option value="heredero">Heredero</option>
                    <option value="albacea">Albacea</option>
                    <option value="testigo">Testigo</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <Input
                  required
                  label="Nombre(s)"
                  value={person.client.nombres}
                  onChange={(e) =>
                    updateClient(index, "nombres", e.target.value.toUpperCase())
                  }
                />
                <Input
                  required
                  label="Apellido paterno"
                  value={person.client.apellidoPaterno}
                  onChange={(e) =>
                    updateClient(
                      index,
                      "apellidoPaterno",
                      e.target.value.toUpperCase(),
                    )
                  }
                />
                <Input
                  label="Apellido materno"
                  value={person.client.apellidoMaterno}
                  onChange={(e) =>
                    updateClient(
                      index,
                      "apellidoMaterno",
                      e.target.value.toUpperCase(),
                    )
                  }
                />
                <Input
                  label="Parentesco"
                  value={person.relationship}
                  onChange={(e) =>
                    updatePerson(index, { relationship: e.target.value })
                  }
                />
                <Input
                  label="RFC"
                  value={person.client.rfc}
                  onChange={(e) =>
                    updateClient(index, "rfc", e.target.value.toUpperCase())
                  }
                />
                <Input
                  type="date"
                  label="Fecha de nacimiento"
                  value={person.client.birthDate}
                  onChange={(e) =>
                    updateClient(index, "birthDate", e.target.value)
                  }
                />
                <Input
                  label="Lugar de nacimiento"
                  value={person.client.birthPlace}
                  onChange={(e) =>
                    updateClient(index, "birthPlace", e.target.value)
                  }
                />
                <Input
                  label="Nacionalidad"
                  value={person.client.nationality}
                  onChange={(e) =>
                    updateClient(index, "nationality", e.target.value)
                  }
                />
                <Input
                  label="Estado civil"
                  value={person.client.maritalStatus}
                  onChange={(e) =>
                    updateClient(index, "maritalStatus", e.target.value)
                  }
                />
                <Input
                  label="Ocupación"
                  value={person.client.occupation}
                  onChange={(e) =>
                    updateClient(index, "occupation", e.target.value)
                  }
                />
                <Input
                  label="Teléfono"
                  value={person.client.telefono}
                  onChange={(e) =>
                    updateClient(index, "telefono", e.target.value)
                  }
                />
                <Input
                  type="email"
                  label="Correo"
                  value={person.client.email}
                  onChange={(e) => updateClient(index, "email", e.target.value)}
                />
                <Input
                  containerClassName="md:col-span-2"
                  label="Domicilio"
                  value={person.client.domicilio}
                  onChange={(e) =>
                    updateClient(index, "domicilio", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPeople((current) => [...current, emptyPerson()])}
            className="rounded-xl border border-dashed border-blue-300 px-4 py-3 text-sm font-bold text-blue-600"
          >
            + Agregar persona
          </button>
        </div>
      </Section>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="rounded-xl border px-5 py-3 text-sm font-bold"
        >
          Cancelar
        </button>
        <button
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear expediente sucesorio"}
        </button>
      </div>
    </form>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
