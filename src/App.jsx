import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import StudentQuiz from "./pages/StudentQuiz";
import RecommendationsPage from "./pages/RecommendationsPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/quiz" element={<StudentQuiz />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route element={<Layout><Routes>{/* Future routes inside Layout */}</Routes></Layout>}>
        </Route>
        {/* Future routes with Layout will be added here */}
        {/* <Route path="/login" element={<Layout><LoginPage /></Layout>} /> */}
        {/* <Route path="/student-profile" element={<Layout><StudentProfilePage /></Layout>} /> */}
      </Routes>
    </BrowserRouter>
  );
}

