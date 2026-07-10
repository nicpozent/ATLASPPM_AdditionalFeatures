import { lazy, type ComponentType } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { SCREENS } from "@/nav";

// Lazy import with stale-chunk recovery. After a new deploy the chunk hashes
// change, so a tab that's been open across the deploy fails to fetch a screen's
// chunk on the next client-side navigation — the dynamic import rejects and the
// screen's ErrorBoundary shows a crash card (which "fixes itself" on a manual
// refresh, because that pulls the fresh index + chunks). Here we do that refresh
// automatically, ONCE, guarded by a sessionStorage flag so a genuinely broken
// chunk can't loop. A successful load clears the flag so a later deploy can
// recover again.
const RELOAD_KEY = "atlas.chunkReload";
function lazyScreen(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  return lazy(() =>
    factory()
      .then((m) => { sessionStorage.removeItem(RELOAD_KEY); return m; })
      .catch((err) => {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<never>(() => {}); // never resolves; the page is reloading
        }
        throw err; // already retried once → surface the real error
      }),
  );
}

// Screens are lazy-loaded so each becomes its own chunk: the initial download is
// just the shell + vendor, and a screen's code arrives only when its route is
// first visited. The shell wraps <Outlet/> in a Suspense boundary (see
// AppShell) that shows a lightweight loader while a chunk streams in.
const Dashboard = lazyScreen(() => import("@/screens/Dashboard"));
const Portfolio = lazyScreen(() => import("@/screens/Portfolio"));
const Programs = lazyScreen(() => import("@/screens/Programs"));
const Products = lazyScreen(() => import("@/screens/Products"));
const Okrs = lazyScreen(() => import("@/screens/Okrs"));
const Roadmap = lazyScreen(() => import("@/screens/Roadmap"));
const Demands = lazyScreen(() => import("@/screens/Demands"));
const Gantt = lazyScreen(() => import("@/screens/Gantt"));
const Pip = lazyScreen(() => import("@/screens/Pip"));
const Project = lazyScreen(() => import("@/screens/Project"));
const Resources = lazyScreen(() => import("@/screens/Resources"));
const Financials = lazyScreen(() => import("@/screens/Financials"));
const Delivery = lazyScreen(() => import("@/screens/Delivery"));
const Releases = lazyScreen(() => import("@/screens/Releases"));
const Ops = lazyScreen(() => import("@/screens/Ops"));
const News = lazyScreen(() => import("@/screens/News"));
const Teams = lazyScreen(() => import("@/screens/Teams"));
const Methodologies = lazyScreen(() => import("@/screens/Methodologies"));
const Integrations = lazyScreen(() => import("@/screens/Integrations"));
const Reports = lazyScreen(() => import("@/screens/Reports"));
const Admin = lazyScreen(() => import("@/screens/Admin"));
const Help = lazyScreen(() => import("@/screens/Help"));
const MyProjects = lazyScreen(() => import("@/screens/MyProjects"));
const MyDemands = lazyScreen(() => import("@/screens/MyDemands"));

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
