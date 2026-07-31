import { create } from 'zustand';
import { Project, PaymentInstallment } from '../types';
import { mockApi } from '../services/api';

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (w: Omit<Project, 'id' | 'createdAt' | 'folio'>) => Promise<void>;
  updateProject: (id: string, w: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await mockApi.getProject();
      set({ projects: response.data, loading: false });
    } catch (err) {
      set({ error: 'Error al cargar departamentos', loading: false });
    }
  },

  addProject: async (w) => {
    set({ loading: true });
    try {
      await mockApi.createProject(w);
      const response = await mockApi.getProject();
      set({ projects: response.data, loading: false });
    } catch (err) {
      set({ error: 'Error al crear departamento', loading: false });
    }
  },

  updateProject: async (id, w) => {
    set({ loading: true });
    try {
      await mockApi.updateProject(id, w);
      const response = await mockApi.getProject();
      set({ projects: response.data, loading: false });
    } catch (err) {
      set({ error: 'Error al actualizar departamento', loading: false });
    }
  }
}));
