// Full-page navigation escapes React entirely, which is the point: these are
// used when client-side state can no longer be trusted (fatal render error,
// expired session) and the app must restart from a clean document.

export function reloadPage(): void {
  window.location.reload();
}

export function redirectToLogin(): void {
  window.location.assign("/login");
}
