import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  LockKeyhole,
  Send,
  Upload,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAlerts } from "../components/AlertProvider";
import {
  createSuccessionSearchRequestPdf,
  downloadRadicationDraft,
} from "../lib/notarySuccessionDocuments";
import { downloadBlob } from "../lib/notaryDocuments";
import { notaryProcessesApi } from "../services/notaryProcesses";
import { notaryInboxApi } from "../services/notaryInbox";
import { notarySuccessionsApi } from "../services/notarySuccessions";
import type {
  NotaryExtractedData,
  NotarySuccession,
  SuccessionSearch,
} from "../types/notaryProcess";

const today = new Date().toISOString().slice(0, 10);
const field =
  "h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-blue-500";
export function NotarySuccessionDetailPage() {
  const { id = "" } = useParams();
  const [item, setItem] = useState<NotarySuccession | null>(null);
  const [saving, setSaving] = useState("");
  const [evidenceDrafts, setEvidenceDrafts] = useState<
    Record<string, NotaryExtractedData>
  >({});
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, string>>(
    {},
  );
  const [requestFiles, setRequestFiles] = useState<Record<string, string>>({});
  const { notify } = useAlerts();
  const load = async () => {
    try {
      setItem(await notarySuccessionsApi.get(id));
    } catch (error) {
      notify(
        "error",
        "No se pudo cargar la sucesión",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const ready = useMemo(
    () =>
      !!item &&
      item.requirements.every(
        (requirement) =>
          (!requirement.required ||
            ["validado", "no_aplica"].includes(requirement.status)) &&
          (requirement.code !== "CSF" ||
            (!!requirement.expiresAt && requirement.expiresAt >= today)),
      ) &&
      item.searches.every((search) => search.status === "respondida"),
    [item],
  );
  const updateRequirement = async (
    requirementId: string,
    status: string,
    file?: File,
    expiresAt?: string,
  ) => {
    setSaving(requirementId);
    try {
      await notarySuccessionsApi.updateRequirement(
        requirementId,
        status,
        file,
        expiresAt,
      );
      await load();
      notify("success", "Requisito actualizado");
    } catch (error) {
      notify(
        "error",
        "No se pudo actualizar",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const uploadRequirementEvidence = async (
    requirementId: string,
    file: File,
    expiresAt?: string,
  ) => {
    setSaving(requirementId);
    try {
      await notarySuccessionsApi.updateRequirement(
        requirementId,
        "recibido",
        file,
        expiresAt,
      );
      const result =
        await notaryInboxApi.analyzeRequirementWithAi(requirementId);
      setEvidenceDrafts((current) => ({
        ...current,
        [requirementId]: result.extractedData,
      }));
      setEvidenceFiles((current) => ({
        ...current,
        [requirementId]: file.name,
      }));
      await load();
      notify(
        "success",
        "Documento analizado",
        "La IA propuso datos. Coteja el documento antes de aplicarlos.",
      );
    } catch (error) {
      await load();
      notify(
        "warning",
        "Documento guardado",
        error instanceof Error
          ? error.message
          : "No se pudo preparar la propuesta automática.",
      );
    } finally {
      setSaving("");
    }
  };
  const applyRequirementEvidence = async (
    requirementId: string,
    code: string,
  ) => {
    const data = evidenceDrafts[requirementId];
    if (!data || !item) return;
    setSaving(requirementId);
    try {
      await notarySuccessionsApi.applyRequirementEvidence(
        item.id,
        item.people.find((person) => person.principal)?.client.id ||
          item.case.client.id,
        code,
        data,
      );
      await notarySuccessionsApi.updateRequirement(requirementId, "validado");
      setEvidenceDrafts((current) => {
        const next = { ...current };
        delete next[requirementId];
        return next;
      });
      await load();
      notify("success", "Datos cotejados y aplicados");
    } catch (error) {
      notify(
        "error",
        "No se pudieron aplicar los datos",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const uploadSearchEvidence = async (search: SuccessionSearch, file: File) => {
    if (!item) return;
    setSaving(search.id);
    try {
      const expectedType =
        search.authority === "registro_publico"
          ? "Oficio de búsqueda registral"
          : "Oficio de búsqueda notarial";
      const document = await notaryInboxApi.upload(
        { id: item.caseId, clientId: item.case.client.id },
        file,
        expectedType,
      );
      const result = await notaryInboxApi.analyzeWithAi(document.id);
      const found = result.extractedData || {};
      patchSearch(search.id, {
        status: "respondida",
        responseDate: found.fechaOficio || search.responseDate,
        responseFolio: found.folioOficio || search.responseFolio,
        result: found.resultadoBusqueda || search.result,
      });
      setEvidenceFiles((current) => ({ ...current, [search.id]: file.name }));
      notify(
        "success",
        "Respuesta analizada",
        "Los datos quedaron como propuesta. Coteja el oficio y después guarda el seguimiento.",
      );
    } catch (error) {
      notify(
        "error",
        "No se pudo analizar la respuesta",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const generateSearchRequest = async (search: SuccessionSearch) => {
    if (!item) return;
    setSaving(search.id);
    try {
      const blob = createSuccessionSearchRequestPdf(item, search.authority);
      const fileName = `oficio-${search.authority}-${item.case.folio}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      await notaryInboxApi.upload(
        { id: item.caseId, clientId: item.case.client.id },
        file,
        search.authority === "registro_publico"
          ? "Solicitud de búsqueda registral"
          : "Solicitud de búsqueda notarial",
      );
      await notarySuccessionsApi.updateSearch(search.id, {
        status: "enviada",
        requestDate: search.requestDate || today,
        requestFolio: search.requestFolio,
        responseDate: search.responseDate || "",
        responseFolio: search.responseFolio,
        result: search.result,
      });
      downloadBlob(blob, fileName);
      await load();
      notify(
        "success",
        "Solicitud generada y guardada",
        "El PDF quedó archivado en el expediente y comenzó su descarga.",
      );
    } catch (error) {
      notify(
        "error",
        "No se pudo generar la solicitud",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const uploadPreparedSearchRequest = async (
    search: SuccessionSearch,
    file: File,
  ) => {
    if (!item) return;
    setSaving(search.id);
    try {
      await notaryInboxApi.upload(
        { id: item.caseId, clientId: item.case.client.id },
        file,
        search.authority === "registro_publico"
          ? "Solicitud de búsqueda registral"
          : "Solicitud de búsqueda notarial",
      );
      await notarySuccessionsApi.updateSearch(search.id, {
        status: "enviada",
        requestDate: search.requestDate || today,
        requestFolio: search.requestFolio,
        responseDate: search.responseDate || "",
        responseFolio: search.responseFolio,
        result: search.result,
      });
      setRequestFiles((current) => ({
        ...current,
        [search.id]: file.name,
      }));
      await load();
      notify(
        "success",
        "Solicitud guardada",
        "El formato preparado quedó asociado al expediente.",
      );
    } catch (error) {
      notify(
        "error",
        "No se pudo guardar la solicitud",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const saveSearch = async (search: SuccessionSearch) => {
    setSaving(search.id);
    try {
      await notarySuccessionsApi.updateSearch(search.id, {
        status: search.status,
        requestDate: search.requestDate || "",
        requestFolio: search.requestFolio,
        responseDate: search.responseDate || "",
        responseFolio: search.responseFolio,
        result: search.result,
      });
      await load();
      notify("success", "Búsqueda actualizada");
    } catch (error) {
      notify(
        "error",
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setSaving("");
    }
  };
  const patchSearch = (id: string, patch: Partial<SuccessionSearch>) =>
    setItem((current) =>
      current
        ? {
            ...current,
            searches: current.searches.map((search) =>
              search.id === id ? { ...search, ...patch } : search,
            ),
          }
        : current,
    );
  const patchRequirement = (id: string, expiresAt: string) =>
    setItem((current) =>
      current
        ? {
            ...current,
            requirements: current.requirements.map((requirement) =>
              requirement.id === id
                ? { ...requirement, expiresAt }
                : requirement,
            ),
          }
        : current,
    );
  if (!item)
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Cargando sucesión...
      </p>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            to="/notaria/sucesiones"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Sucesiones
          </Link>
          <h1 className="mt-3 text-3xl font-bold">
            Sucesión de {item.deceased.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-mono font-bold text-blue-600">
              {item.case.folio}
            </span>{" "}
            · Vía {item.route}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/notaria/expedientes/${item.caseId}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"
          >
            <FileText className="h-4 w-4" />
            Proceso y pagos
          </Link>
          {item.route === "testamentaria" && (
            <button
              disabled={!ready}
              onClick={() => void downloadRadicationDraft(item)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Proyecto de radicación
            </button>
          )}
        </div>
      </div>
      {!ready && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <LockKeyhole className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Radicación bloqueada</p>
            <p className="mt-1">
              Valida todos los requisitos obligatorios y registra la respuesta
              de ambas búsquedas.
            </p>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Ruta base del expediente
            </p>
            <h2 className="mt-1 text-lg font-bold text-blue-950">
              Tres pasos para la búsqueda de sucesión
            </h2>
          </div>
          <p className="text-xs text-blue-700">
            Todo se genera, analiza y conserva bajo el folio {item.case.folio}.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              number: 1,
              title:
                item.route === "testamentaria"
                  ? "Testamento"
                  : "Acta de defunción",
              status:
                item.requirements.find((value) =>
                  item.route === "testamentaria"
                    ? value.code === "TESTAMENTO"
                    : value.code === "ACTA_DEFUNCION",
                )?.status || "pendiente",
            },
            {
              number: 2,
              title: "Registro Público",
              status:
                item.searches.find(
                  (value) => value.authority === "registro_publico",
                )?.status || "pendiente",
            },
            {
              number: 3,
              title: "Archivo de Notarías",
              status:
                item.searches.find(
                  (value) => value.authority === "archivo_notarias",
                )?.status || "pendiente",
            },
          ].map((step) => {
            const complete = ["validado", "respondida"].includes(step.status);
            return (
              <div
                key={step.number}
                className={`rounded-xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-white"}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}
                  >
                    {complete ? "✓" : step.number}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{step.title}</p>
                    <p className="text-xs capitalize text-slate-500">
                      {step.status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">
          Documentos que respaldan la sucesión
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sube cada documento. La IA propone sus datos, pero una persona debe
          cotejarlos antes de validarlos.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {item.requirements.map((requirement) => (
            <div key={requirement.id} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`rounded-lg p-2 ${requirement.status === "validado" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}
                >
                  <FileCheck2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{requirement.name}</p>
                  {requirement.fileName && (
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {requirement.fileName}
                    </p>
                  )}
                </div>
                <select
                  disabled={saving === requirement.id}
                  value={requirement.status}
                  onChange={(e) =>
                    void updateRequirement(
                      requirement.id,
                      e.target.value,
                      undefined,
                      requirement.expiresAt,
                    )
                  }
                  className="rounded-lg border px-2 py-1 text-xs font-bold"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="recibido">Recibido</option>
                  <option value="validado">Validado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="no_aplica">No aplica</option>
                </select>
              </div>
              {requirement.code === "CSF" && (
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Vigente hasta
                  <input
                    type="date"
                    value={requirement.expiresAt || ""}
                    onChange={(e) =>
                      patchRequirement(requirement.id, e.target.value)
                    }
                    onBlur={() =>
                      void updateRequirement(
                        requirement.id,
                        requirement.status,
                        undefined,
                        requirement.expiresAt,
                      )
                    }
                    className={`${field} mt-1`}
                  />
                  {requirement.expiresAt && requirement.expiresAt < today && (
                    <span className="mt-1 block font-bold text-red-600">
                      Constancia vencida
                    </span>
                  )}
                </label>
              )}
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-xs font-bold text-blue-600">
                <Upload className="h-3.5 w-3.5" />
                {saving === requirement.id
                  ? "Analizando…"
                  : "Subir, analizar y cotejar"}
                <input
                  type="file"
                  accept=".pdf,.docx,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void uploadRequirementEvidence(
                        requirement.id,
                        file,
                        requirement.expiresAt,
                      );
                  }}
                />
              </label>
              {evidenceDrafts[requirement.id] && (
                <EvidenceProposal
                  data={evidenceDrafts[requirement.id]}
                  fileName={evidenceFiles[requirement.id]}
                  onApply={() =>
                    void applyRequirementEvidence(
                      requirement.id,
                      requirement.code,
                    )
                  }
                  disabled={saving === requirement.id}
                />
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">
          Búsquedas testamentarias obligatorias
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Genera cada solicitud y, al recibir la respuesta, sube el oficio para
          proponer folio, fecha y resultado.
        </p>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {item.searches.map((search) => (
            <div key={search.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-600">
                    {search.authority === "registro_publico"
                      ? "Registro Público de la Propiedad"
                      : "Archivo General de Notarías"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Solicitud, respuesta y cotejo
                  </p>
                </div>
                <button
                  disabled={saving === search.id}
                  onClick={() => void generateSearchRequest(search)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"
                >
                  <Download className="h-3.5 w-3.5" />
                  {saving === search.id
                    ? "Guardando…"
                    : "Generar, guardar y descargar"}
                </button>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Puedes generar la solicitud con la plantilla de la notaría o
                  subir un formato que ya tengas preparado.
                </p>
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-white p-2 text-xs font-bold text-blue-600">
                  <Upload className="h-3.5 w-3.5" />
                  {saving === search.id
                    ? "Guardando solicitud…"
                    : "Subir solicitud ya elaborada"}
                  <input
                    type="file"
                    accept=".pdf,.docx,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadPreparedSearchRequest(search, file);
                    }}
                  />
                </label>
                {requestFiles[search.id] ? (
                  <p className="mt-2 truncate text-xs font-medium text-emerald-700">
                    Solicitud archivada: {requestFiles[search.id]}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Estatus
                  <select
                    value={search.status}
                    onChange={(e) =>
                      patchSearch(search.id, {
                        status: e.target.value as SuccessionSearch["status"],
                      })
                    }
                    className={`${field} mt-1`}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="enviada">Enviada</option>
                    <option value="respondida">Respondida</option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Fecha solicitud
                  <input
                    type="date"
                    value={search.requestDate || ""}
                    onChange={(e) =>
                      patchSearch(search.id, { requestDate: e.target.value })
                    }
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="text-xs font-medium">
                  Folio solicitud
                  <input
                    value={search.requestFolio}
                    onChange={(e) =>
                      patchSearch(search.id, { requestFolio: e.target.value })
                    }
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="text-xs font-medium">
                  Fecha respuesta
                  <input
                    type="date"
                    value={search.responseDate || ""}
                    onChange={(e) =>
                      patchSearch(search.id, { responseDate: e.target.value })
                    }
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="text-xs font-medium">
                  Folio respuesta
                  <input
                    value={search.responseFolio}
                    onChange={(e) =>
                      patchSearch(search.id, { responseFolio: e.target.value })
                    }
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  Resultado
                  <textarea
                    rows={2}
                    value={search.result}
                    onChange={(e) =>
                      patchSearch(search.id, { result: e.target.value })
                    }
                    className={`${field} mt-1 h-auto py-2`}
                  />
                </label>
              </div>
              {evidenceFiles[search.id] && (
                <p className="mt-3 truncate text-xs font-medium text-emerald-700">
                  Propuesta obtenida de {evidenceFiles[search.id]}
                </p>
              )}
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-xs font-bold text-blue-600">
                <Upload className="h-3.5 w-3.5" />
                {saving === search.id
                  ? "Analizando respuesta…"
                  : "Subir oficio de respuesta"}
                <input
                  type="file"
                  accept=".pdf,.docx,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadSearchEvidence(search, file);
                  }}
                />
              </label>
              <button
                disabled={saving === search.id}
                onClick={() => void saveSearch(search)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Send className="h-4 w-4" />
                Cotejado: guardar respuesta
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Comparecientes y generales</h2>
        <div className="mt-4 divide-y">
          {item.people.map((person, index) => (
            <div
              key={`${person.client.curp}-${index}`}
              className="grid gap-2 py-4 md:grid-cols-[1fr_170px_170px]"
            >
              <div>
                <p className="font-bold">
                  {notaryProcessesApi.clientName(person.client as any)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  CURP {person.client.curp} · RFC {person.client.rfc || "—"} ·{" "}
                  {person.client.domicilio || "Sin domicilio"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Carácter</p>
                <p className="text-sm font-bold capitalize">{person.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Parentesco</p>
                <p className="text-sm font-bold">
                  {person.relationship || "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {ready && (
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <p>
            <strong>Integración completa.</strong> Ya puede prepararse la
            radicación y continuar con la firma.
          </p>
        </div>
      )}
    </div>
  );
}

const fieldLabels: Record<string, string> = {
  nombre: "Nombre",
  curp: "CURP",
  rfc: "RFC",
  domicilio: "Domicilio",
  fechaNacimiento: "Fecha de nacimiento",
  fechaDefuncion: "Fecha de defunción",
  lugarDefuncion: "Lugar de defunción",
  numeroActa: "Número de acta",
  libro: "Libro",
  oficialia: "Oficialía",
  numeroInstrumento: "Instrumento",
  volumen: "Volumen",
  fechaInstrumento: "Fecha del testamento",
  notario: "Notario",
  numeroNotaria: "Número de notaría",
  lugarOtorgamiento: "Lugar de otorgamiento",
  albacea: "Albacea",
  herederos: "Herederos",
  regimenFiscal: "Régimen fiscal",
  idCif: "ID CIF",
};
function EvidenceProposal({
  data,
  fileName,
  onApply,
  disabled,
}: {
  data: NotaryExtractedData;
  fileName?: string;
  onApply: () => void;
  disabled: boolean;
}) {
  const entries = Object.entries(data)
    .filter(
      ([key, value]) =>
        fieldLabels[key] &&
        (typeof value === "string"
          ? value.trim()
          : Array.isArray(value) && value.length),
    )
    .slice(0, 12);
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <p className="text-xs font-bold text-blue-900">
        Propuesta para cotejo{fileName ? ` · ${fileName}` : ""}
      </p>
      <dl className="mt-2 space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
            <dt className="font-semibold text-slate-500">{fieldLabels[key]}</dt>
            <dd className="break-words text-slate-800">
              {Array.isArray(value) ? value.join(", ") : value}
            </dd>
          </div>
        ))}
      </dl>
      <button
        disabled={disabled}
        onClick={onApply}
        className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        Cotejado: aplicar datos y validar
      </button>
    </div>
  );
}
