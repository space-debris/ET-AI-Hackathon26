import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts';
import {
  DashboardPage,
  UploadPage,
  PortfolioPage,
  FIREPlannerPage,
  PathPlannerPage,
  LifeEventAdvisorPage,
  CoupleMoneyPlannerPage,
  TaxOptimizerPage,
  HealthScorePage,
  RecommendationsPage,
  SettingsPage,
  HelpPage,
} from './pages';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/fire-planner" element={<FIREPlannerPage />} />
          <Route path="/path-planner" element={<PathPlannerPage />} />
          <Route path="/life-events" element={<LifeEventAdvisorPage />} />
          <Route path="/couple-planner" element={<CoupleMoneyPlannerPage />} />
          <Route path="/tax-optimizer" element={<TaxOptimizerPage />} />
          <Route path="/health-score" element={<HealthScorePage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
