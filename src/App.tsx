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
import { CatalogsPage } from './pages/CatalogsPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { AlertProvider } from './components/AlertProvider';
import { ArchitectureDashboardPage } from './pages/ArchitectureDashboardPage';
import { StudentRecordListPage } from './pages/StudentRecordListPage';
import { StudentRecordFormPage } from './pages/StudentRecordFormPage';
import { ImportacionesLaraListPage } from './pages/ImportacionesLaraListPage';
import { ImportacionesLaraFormPage } from './pages/ImportacionesLaraFormPage';

function AppShell() {
  return <AppLayout><Outlet /></AppLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertProvider><AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/ficha-publica" element={<StudentRecordFormPage publicMode />} />
          <Route path="/fichas/nueva" element={<StudentRecordFormPage publicMode />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/listado" element={<ProjectListPage />} />
                <Route path="/registro" element={<ProjectRegistrationPage />} />
                <Route path="/editar/:id" element={<ProjectEditPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['admin', 'importaciones_lara']} />}>
                <Route path="/importaciones-lara" element={<ImportacionesLaraListPage />} />
                <Route path="/importaciones-lara/nuevo" element={<ImportacionesLaraFormPage />} />
                <Route path="/importaciones-lara/editar/:id" element={<ImportacionesLaraFormPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['admin', 'fichas']} />}>
                <Route path="/fichas" element={<StudentRecordListPage />} />
                <Route path="/fichas/nueva-interna" element={<StudentRecordFormPage />} />
                <Route path="/fichas/editar/:id" element={<StudentRecordFormPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['admin', 'arquitectura']} />}>
                <Route path="/arquitectura/resumen" element={<ArchitectureDashboardPage />} />
                <Route path="/arquitectura" element={<ArchitecturalProjectListPage />} />
                <Route path="/arquitectura/nuevo" element={<ArchitecturalProjectFormPage />} />
                <Route path="/arquitectura/editar/:id" element={<ArchitecturalProjectFormPage />} />
                <Route path="/catalogos" element={<CatalogsPage />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={['cliente']} />}>
                <Route path="/cliente" element={<ClientPortalPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider></AlertProvider>
    </BrowserRouter>
  );
}
