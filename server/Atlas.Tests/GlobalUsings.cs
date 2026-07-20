// Domain modules live in per-domain namespaces (Atlas.Api.<Domain>). These
// global usings let the composition root and cross-module references resolve
// without per-file using churn. Module boundaries are ENFORCED at the IL level
// by the NetArchTest suite (Atlas.Tests/ArchitectureTests.cs), not by usings —
// so importing a module here does not weaken the boundary check.
global using Atlas.Api.Comms;
global using Atlas.Api.Delivery;
global using Atlas.Api.Finance;
global using Atlas.Api.Governance;
global using Atlas.Api.Integrations;
global using Atlas.Api.Operations;
global using Atlas.Api.People;
global using Atlas.Api.Platform;
global using Atlas.Api.Portfolio;
