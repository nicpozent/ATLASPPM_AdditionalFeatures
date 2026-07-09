# Atlas PPM API — .NET 8 multi-stage build.
# The server folder holds two projects (Atlas.Api + Atlas.Tests) and a solution,
# so restore/publish must name the API project explicitly. The test project is
# never built here — it isn't needed in the runtime image.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Atlas.Api.csproj ./
RUN dotnet restore Atlas.Api.csproj
COPY . .
RUN dotnet publish Atlas.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
# Drop to the non-root `app` user the .NET 8 base image ships (UID 1654) — a
# literal UID so static scanners can confirm it's non-root. The app binds the
# unprivileged port 8080 and needs no write access to its own files.
USER 1654
# Migrations + seed run on startup (see Program.cs).
ENTRYPOINT ["dotnet", "Atlas.Api.dll"]
