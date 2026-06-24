import { AppRouter } from "./app/AppRouter";
import { AuthProvider } from "./auth/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ToastProvider } from "./components/ui/Toast";
import { PreferencesProvider } from "./app/PreferencesContext";

function App() {
  return (
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </PreferencesProvider>
  );
}

export default App;
