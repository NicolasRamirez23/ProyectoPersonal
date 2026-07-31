/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectListPage } from './pages/ProjectListPage';
import { ProjectRegistrationPage } from './pages/ProjectRegistrationPage';
import { ProjectEditPage } from './pages/ProjectEditPage';
import { ArchitecturalProjectListPage } from './pages/ArchitecturalProjectListPage';
import { ArchitecturalProjectFormPage } from './pages/ArchitecturalProjectFormPage';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';

function AppShell() {
  return <AppLayout><Outlet /></AppLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/listado" element={<ProjectListPage />} />
                <Route path="/registro" element={<ProjectRegistrationPage />} />
                <Route path="/editar/:id" element={<ProjectEditPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['admin', 'arquitectura']} />}>
                <Route path="/arquitectura" element={<ArchitecturalProjectListPage />} />
                <Route path="/arquitectura/nuevo" element={<ArchitecturalProjectFormPage />} />
                <Route path="/arquitectura/editar/:id" element={<ArchitecturalProjectFormPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
