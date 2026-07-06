import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { SCREENS } from "@/nav";

import Dashboard from "@/screens/Dashboard";
import Portfolio from "@/screens/Portfolio";
import Programs from "@/screens/Programs";
import Products from "@/screens/Products";
import Okrs from "@/screens/Okrs";
import Demands from "@/screens/Demands";
import Gantt from "@/screens/Gantt";
import Pip from "@/screens/Pip";
import Project from "@/screens/Project";
import Resources from "@/screens/Resources";
import Financials from "@/screens/Financials";
import Delivery from "@/screens/Delivery";
import Releases from "@/screens/Releases";
import Ops from "@/screens/Ops";
import News from "@/screens/News";
import Teams from "@/screens/Teams";
import Methodologies from "@/screens/Methodologies";
import Integrations from "@/screens/Integrations";
import Reports from "@/screens/Reports";
import Admin from "@/screens/Admin";
import Help from "@/screens/Help";
import MyProjects from "@/screens/MyProjects";
import MyDemands from "@/screens/MyDemands";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: SCREENS.portfolio.path.slice(1), element: <Portfolio /> },
      { path: SCREENS.programs.path.slice(1), element: <Programs /> },
      { path: SCREENS.products.path.slice(1), element: <Products /> },
      { path: SCREENS.okrs.path.slice(1), element: <Okrs /> },
      { path: SCREENS.demands.path.slice(1), element: <Demands /> },
      { path: SCREENS.gantt.path.slice(1), element: <Gantt /> },
      { path: SCREENS.pip.path.slice(1), element: <Pip /> },
      { path: SCREENS.project.path.slice(1), element: <Project /> },
      { path: SCREENS.resources.path.slice(1), element: <Resources /> },
      { path: SCREENS.financials.path.slice(1), element: <Financials /> },
      { path: SCREENS.delivery.path.slice(1), element: <Delivery /> },
      { path: SCREENS.releases.path.slice(1), element: <Releases /> },
      { path: SCREENS.ops.path.slice(1), element: <Ops /> },
      { path: SCREENS.news.path.slice(1), element: <News /> },
      { path: SCREENS.teams.path.slice(1), element: <Teams /> },
      { path: SCREENS.methodologies.path.slice(1), element: <Methodologies /> },
      { path: SCREENS.integrations.path.slice(1), element: <Integrations /> },
      { path: SCREENS.reports.path.slice(1), element: <Reports /> },
      { path: SCREENS.admin.path.slice(1), element: <Admin /> },
      { path: SCREENS.help.path.slice(1), element: <Help /> },
      { path: SCREENS.myprojects.path.slice(1), element: <MyProjects /> },
      { path: SCREENS.mydemands.path.slice(1), element: <MyDemands /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
