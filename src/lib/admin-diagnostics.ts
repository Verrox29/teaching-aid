// Central gate for admin-only diagnostics surfaces.
// Keep this false until authenticated admin access is wired through the app.
export function shouldShowAdminDiagnostics() {
  return false;
}
