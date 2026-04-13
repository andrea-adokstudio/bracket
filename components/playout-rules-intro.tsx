/** Testi regolamento playout (senza date): usati nel tabellone e nella simulazione. */
export function PlayoutRulesIntro() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-3 text-center text-pretty">
      <h2 className="text-lg font-semibold">Playout</h2>
      <div className="mx-auto max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Alla fine della regular season la 9ª e la 10ª classificata in ogni girone si salvano e terminano
          anticipatamente la stagione. Le squadre classificate dall’11º al 14º posto disputano i playout su due
          turni, al meglio delle tre partite per serie: al primo turno si incrociano con le squadre dell’altro girone
          della stessa conference (girone A e girone B), con gli abbinamenti 11ª contro 14ª e 12ª contro 13ª.
        </p>
        <p>
          Le vincenti del primo turno ottengono la salvezza e restano in Serie B interregionale anche per la stagione
          successiva. Le perdenti del primo turno nello stesso tabellone hanno una seconda possibilità: disputano una
          nuova serie tra loro, sempre al meglio delle tre. Chi vince quella serie si salva; chi la perde retrocede in
          Serie C. Il numero complessivo di retrocessioni dal percorso playout dipende da quanti tabelloni sono previsti
          dal regolamento (una retrocessione dal secondo turno per ciascun tabellone così strutturato). Le squadre
          classificate al 15º posto retrocedono direttamente, senza disputare il playout.
        </p>
      </div>
    </section>
  )
}
