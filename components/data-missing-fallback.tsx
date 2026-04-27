export function DataMissingFallback() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl items-center justify-center px-6 py-12">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold">Dati non disponibili</h1>
        <p className="text-sm text-muted-foreground">
          L’app legge i file <code className="rounded bg-muted px-1 py-0.5">data/standings.json</code> e{" "}
          <code className="rounded bg-muted px-1 py-0.5">data/events.json</code> nella root del progetto.
        </p>
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">In locale</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Apri il terminale nella cartella del progetto ed esegui:{" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run fetch-data</code>
            </li>
            <li>
              Se compare <strong>403 Forbidden</strong>: dal browser apri DevTools → Network, ricarica la pagina
              torneo, seleziona una richiesta a <code className="rounded bg-muted px-1 py-0.5">api/v1</code>, copia
              l’header <strong>Cookie</strong> e in terminale esporta{" "}
              <code className="rounded bg-muted px-1 py-0.5">SOFASCORE_COOKIE=&apos;...&apos;</code> poi rilancia{" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run fetch-data</code>. In alternativa usa{" "}
              <code className="rounded bg-muted px-1 py-0.5">HTTPS_PROXY</code>.
            </li>
            <li>Riavvia il dev server: <code className="rounded bg-muted px-1 py-0.5">npm run dev</code></li>
          </ol>
          <p className="pt-2 font-medium text-foreground">Online (deploy)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Quei due file devono essere presenti nel repository (o generati in CI prima del build) così il server
              può leggerli a runtime.
            </li>
            <li>
              Su Vercel, l’endpoint <code className="rounded bg-muted px-1 py-0.5">POST /api/aggiorna</code> in
              produzione non esegue il fetch: usa il workflow di aggiornamento dati / commit dei JSON, come da
              messaggio dell’API.
            </li>
          </ul>
          <p className="pt-2 text-xs text-muted-foreground">
            Nel calendario, se i tab Playoff/Playout sono vuoti ma i gironi sono pieni, aggiorna i JSON con l’ultimo{" "}
            <code className="rounded bg-muted px-1 py-0.5">fetch-data</code> oppure apri il tab Girone A/B.
          </p>
        </div>
      </div>
    </div>
  )
}
