import { ProjectForm } from '../components/ProjectsForm';
import { mockApi } from '../services/api';
import { useState } from 'react';

export function ProjectRegistrationPage() {
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async (finalPayload: any) => {
    try {
      setError(null);
      
      // 🚀 ¡Listo! El formulario ya nos manda el objeto perfectamente estructurado
      // con su cliente_id (sea nuevo o existente), pago, pago_inicial, etc.
      await mockApi.createProject(finalPayload);

    } catch (err: any) {
      console.error("Error al registrar el proyecto:", err);
      setError(err.message || "No se pudo guardar el proyecto en la base de datos.");
      throw err; 
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-slate-900">Registrar proyecto de programación</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ingresa la información básica para dar de alta el proyecto y estructurar su plan de pagos.
        </p>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        </div>
      )}

      <div className="px-4">
        {/* Le pasamos la función que espera el payload procesado */}
        <ProjectForm onSubmit={handleCreateProject} />
      </div>
    </div>
  );
}
