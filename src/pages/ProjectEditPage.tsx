import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectForm } from '../components/ProjectsForm';
import { mockApi } from '../services/api';
import { Clock } from 'lucide-react';

export function ProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proyecto, setProyecto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      if (!id) return;
      try {
        setError(null);
        const data = await mockApi.getProjectById(id);
        if (data) {
          setProyecto(data);
        } else {
          setError("No se encontró el proyecto solicitado.");
        }
      } catch (err: any) {
        console.error("Error al cargar:", err);
        setError("Error al cargar la información del proyecto.");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [id]);

  const handleUpdateProject = async (finalPayload: any) => {
    if (!id) return;
    try {
      setError(null);

      // 🚀 Enviamos el payload limpio que armó el formulario usando 
      // los nombres exactos de tus columnas en PostgreSQL
      await mockApi.updateProject(id, {
        cliente: Number(finalPayload.cliente),
        pago: Number(finalPayload.pago),
        pago_inicial: Number(finalPayload.pago_inicial),
        tipo_pago: finalPayload.tipo_pago,
        fecha_firma_contrato: finalPayload.fecha_firma_contrato,
        fecha_inicio: finalPayload.fecha_inicio
      });

      // Redireccionamos tras guardar con éxito
      navigate('/listado');
    } catch (err: any) {
      console.error("Error al actualizar:", err);
      setError(err.message || "Error al actualizar la base de datos.");
      throw err;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Clock className="h-8 w-8 animate-spin mb-2" />
      <p>Cargando información del proyecto...</p>
    </div>
  );

  return (
    <div className="space-y-6 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-slate-900">Editar proyecto de programación</h1>
        {proyecto && (
          <p className="text-sm text-slate-500 mt-1">
            Modificando Contrato del Proyecto #{proyecto.id}
          </p>
        )}
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        </div>
      )}

      <div className="px-4">
        {proyecto && (
          <ProjectForm 
            initialData={proyecto} 
            onSubmit={handleUpdateProject} 
          />
        )}
      </div>
    </div>
  );
}
