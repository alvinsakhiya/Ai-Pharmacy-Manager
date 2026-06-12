import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Inventory from "./pages/Inventory";
import Dosette from "./pages/Dosette";
import PickingLists from "./pages/PickingLists";
import Alerts from "./pages/Alerts";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/dosette" element={<Dosette />} />
        <Route path="/picking-lists" element={<PickingLists />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;