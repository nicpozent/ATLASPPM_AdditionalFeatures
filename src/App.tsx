import { lazy } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { SCREENS } from "@/nav";

// Screens are lazy-loaded so each becomes its own chunk: the initial download is
// just the shell + vendor, and a screen's code arrives only when its route is
// first visited. The shell wraps <Outlet/> in a Suspense boundary (see
// AppShell) that shows a lightweight loader while a chunk streams in.
const Dashboard = lazy(() => import("@/screens/Dashboard"));
const Portfolio = lazy(() => import("@/screens/Portfolio"));
const Programs = lazy(() => import("@/screens/Programs"));
const Products = lazy(() => import("@/screens/Products"));
const Okrs = lazy(() => import("@/screens/Okrs"));
const Roadmap = lazy(() => import("@/screens/Roadmap"));
const Demands = lazy(() => import("@/screens/Demands"));
const Gantt = lazy(() => import("@/screens/Gantt"));
const Pip = lazy(() => import("@/screens/Pip"));
const Project = lazy(() => import("@/screens/Project"));
const Resources = lazy(() => import("@/screens/Resources"));
const Financials = lazy(() => import("@/screens/Financials"));
const Delivery = lazy(() => import("@/screens/Delivery"));
const Releases = lazy(() => import("@/screens/Releases"));
const Ops = lazy(() => import("@/screens/Ops"));
const News = lazy(() => import("@/screens/News"));
const Teams = lazy(() => import("@/screens/Teams"));
const Methodologies = lazy(() => import("@/screens/Methodologies"));
const Integrations = lazy(() => import("@/screens/Integrations"));
const Reports = lazy(() => import("@/screens/Reports"));
const Admin = lazy(() => import("@/screens/Admin"));
const Help = lazy(() => import("@/screens/Help"));
const MyProjects = lazy(() => import("@/screens/MyProjects"));
const MyDemands = lazy(() => import("@/screens/MyDemands"));

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
      { path: SCREENS.roadmap.path.slice(1), element: <Roadmap /> },
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
