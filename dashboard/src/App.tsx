import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { DevicesPage } from "./pages/DevicesPage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

function protectedRoute(element: React.ReactNode) {
  return <RequireAuth>{element}</RequireAuth>;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: protectedRoute(<OverviewPage />) },
  { path: "/devices", element: protectedRoute(<DevicesPage />) },
  { path: "/devices/:id", element: protectedRoute(<DeviceDetailPage />) },
  { path: "/settings", element: protectedRoute(<SettingsPage />) },
]);

export function App() {
  return <RouterProvider router={router} />;
}
