---
name: vault-sync
description: MoonRover-Vault bilgi arÅŸivine yazmak veya oradan geÃ§miÅŸ kararlarÄ± okumak iÃ§in kullan. Bir bug bulunduÄŸunda, tasarÄ±m kararÄ± verildiÄŸinde, kalibrasyon Ã¶lÃ§Ã¼ldÃ¼ÄŸÃ¼nde ya da "bunu daha Ã¶nce konuÅŸmuÅŸ muyduk", "neden bÃ¶yle yapmÄ±ÅŸtÄ±k" sorularÄ±nda devreye gir.
---

# Vault â€” Ä°ki YÃ¶nlÃ¼ Bilgi AkÄ±ÅŸÄ±

Vault yolu: `C:\Users\ACER\Desktop\MoonRover-Vault`
Vault'un kendi anayasasÄ±: `MoonRover-Vault/CLAUDE.md` â€” **Ã§eliÅŸki olursa o dosya kazanÄ±r.**

Kod deposu (`final/`) ile vault ayrÄ± yerlerdedir ve otomatik senkronize olmazlar.
Bu skill o kÃ¶prÃ¼yÃ¼ kurar.

Vault dizini proje dÄ±ÅŸÄ±nda olduÄŸu iÃ§in Claude Code ilk eriÅŸimde izin isteyecektir.
"Her zaman izin ver" seÃ§ilirse sonraki oturumlarda sormaz.

---

## A. OKUMA â€” plan yapmadan Ã¶nce

Yeni bir iÅŸe baÅŸlarken, o konuda daha Ã¶nce alÄ±nmÄ±ÅŸ bir karar olup olmadÄ±ÄŸÄ±na bak.
AynÄ± tartÄ±ÅŸmayÄ± ikinci kez yapmak, vault'un var olma sebebini boÅŸa Ã§Ä±karÄ±r.

**Ne zaman bak:**
- Bir modÃ¼lÃ¼ deÄŸiÅŸtirmeden Ã¶nce (`decisions/` ve `bugs/` iÃ§inde o modÃ¼l geÃ§iyor mu?)
- "Neden bÃ¶yle yapÄ±lmÄ±ÅŸ" sorusunda
- Bir yaklaÅŸÄ±mÄ± reddetmeden Ã¶nce â€” belki daha Ã¶nce denenmiÅŸ ve elenmiÅŸ olabilir
- Bir bug'Ä± dÃ¼zeltmeden Ã¶nce â€” daha Ã¶nce gÃ¶rÃ¼lmÃ¼ÅŸ ve bilinÃ§li olarak bÄ±rakÄ±lmÄ±ÅŸ olabilir

**NasÄ±l:** `bugs/`, `decisions/`, `syntheses/` ve `index.md` iÃ§inde ilgili terimleri ara.
BulduÄŸun kararÄ± **tarihiyle birlikte** aktar; eski bir karar hÃ¢lÃ¢ geÃ§erli olmayabilir,
ama gÃ¶rmezden gelinmemeli.

Bir kararla Ã§eliÅŸen bir ÅŸey yapacaksan: bunu aÃ§Ä±kÃ§a sÃ¶yle ve gerekÃ§elendir.
Sessizce eski kararÄ±n Ã¼zerinden geÃ§me.

---

## B. YAZMA â€” iÅŸ bitiminde

### Ne gider, ne gitmez

**Gider:** niyet, karar gerekÃ§esi, elenen alternatifler, kalibrasyon sayÄ±larÄ±,
tespit edilen tutarsÄ±zlÄ±klar, "ilk Ã§Ã¶zÃ¼m neden yanlÄ±ÅŸtÄ±" dersleri, aÃ§Ä±k kalan sorular.

**Gitmez:** kodun kendisi (git'te zaten var), rutin refactor'lar, Ã¶nemsiz dÃ¼zeltmeler.

Ã–lÃ§Ã¼t: **koddan tÃ¼retilemeyen bilgi mi?** Cevap hayÄ±rsa yazma.

### KlasÃ¶r eÅŸlemesi

| KlasÃ¶r | Ä°Ã§erik |
|---|---|
| `raw/` | Ham kaynaklar â€” **DEÄÄ°ÅTÄ°RÄ°LMEZ** |
| `sources/` | Ham kaynaklarÄ±n Ã¶zet sayfalarÄ± |
| `entities/` | Somut ÅŸeyler (uygulama, monorepo) |
| `concepts/` | Kavramlar (rota modlarÄ±, terrain Ã¼retimi) |
| `features/` | Ã–zellikler (pathfinder, heatmap, Ã¶ÄŸrenme modeli) |
| `bugs/` | Tespit edilen sorunlar â€” Ã§Ã¶zÃ¼lmÃ¼ÅŸ veya aÃ§Ä±k |
| `decisions/` | TasarÄ±m kararlarÄ±, `YYYY-MM-DD-konu.md` |
| `syntheses/` | Birden Ã§ok kaynaÄŸÄ± birleÅŸtiren analizler |
| `archive/` | Silinmeyen, emekliye ayrÄ±lan sayfalar |

### Hard rules (vault CLAUDE.md'den)

1. `raw/` dokunulmazdÄ±r. Ä°Ã§indeki bir dosyada bug varsa onu dÃ¼zeltme â€”
   `bugs/` altÄ±na ayrÄ± kayÄ±t aÃ§, `sources/` sayfasÄ±na Ã§eliÅŸki notu dÃ¼ÅŸ.
2. Her iddia kaynaklÄ±dÄ±r (hangi dosya, hangi Ã¶lÃ§Ã¼m, hangi commit).
3. Ã‡eliÅŸki silinmez, iÅŸaretlenir.
4. Sayfa silinmez, arÅŸivlenir.
5. Ã‡ift yÃ¶nlÃ¼ link: yeni sayfa aÃ§Ä±ldÄ±ÄŸÄ±nda ilgili sayfalardan da ona link verilir.
6. Her iÅŸlem sonrasÄ± `index.md` ve `log.md` gÃ¼ncellenir.

### Bug kaydÄ± formatÄ±

```markdown
---
title: <kÄ±sa baÅŸlÄ±k>
tags: [bug, <modÃ¼l>]
date: YYYY-MM-DD
status: resolved | open
---

## Belirti
KullanÄ±cÄ±nÄ±n/testin gÃ¶rdÃ¼ÄŸÃ¼ ÅŸey.

## KÃ¶k neden
GerÃ§ek sebep â€” semptom deÄŸil.

## KanÄ±t
Ã–lÃ§Ã¼m, test Ã§Ä±ktÄ±sÄ±, git bulgusu.

## Ã‡Ã¶zÃ¼m
Ne deÄŸiÅŸti, hangi dosyada, hangi commit.

## Test
NasÄ±l doÄŸrulandÄ±, nasÄ±l tekrar doÄŸrulanÄ±r.

## Ders
GenelleÅŸtirilebilir Ã§Ä±karÄ±m varsa.

## Ä°lgili
- [[features/...]]
```

### Karar kaydÄ± formatÄ±

```markdown
---
title: <karar>
tags: [decision, <alan>]
date: YYYY-MM-DD
---

## Karar
Tek cÃ¼mle, emir kipinde.

## BaÄŸlam
Hangi problem bu kararÄ± gerektirdi.

## SeÃ§enekler
Neler deÄŸerlendirildi, hangileri neden elendi.

## SonuÃ§lar
Bu kararÄ±n getirdiÄŸi kÄ±sÄ±tlar ve maliyetler.

## GeÃ§erlilik
Hangi koÅŸullar deÄŸiÅŸirse bu karar gÃ¶zden geÃ§irilmeli.
```

---

## Kapsam ayrÄ±mÄ± â€” burasÄ± kritik

| Nereye | Ne | BiÃ§im |
|---|---|---|
| `.claude/` (kod deposu) | **Kural** â€” bundan sonra hep geÃ§erli | Genel, emir kipinde, tarihsiz |
| Vault | **Olay** â€” ne oldu, ne Ã¶ÄŸrenildi | Tarihli, gerekÃ§eli, kaynaklÄ± |

AynÄ± bilgi ikisine de gidebilir ama farklÄ± biÃ§imde.
Ã–rnek: vault'a "8 AÄŸustos'ta ÅŸu Ã¶lÃ§Ã¼mlerle ÅŸu karar verildi" yazÄ±lÄ±r;
`.claude/skills/`'e "X'e dokunuyorsan Y prosedÃ¼rÃ¼nÃ¼ Ã§alÄ±ÅŸtÄ±r" yazÄ±lÄ±r.

Kural deÄŸiÅŸikliÄŸi gerekiyorsa `retro` skill'ine geÃ§ â€” bu skill sadece vault'u yÃ¶netir.

## Bitirirken

Commit atmadan önce `git status` ile vault'un çalışma ağacını kontrol et. Bu oturumun kapsamındaki dosyaların dışında commit edilmemiş değişiklik/dosya varsa (önceki bir oturumdan kalmış olabilir), onları da commit'e dahil et — sessizce atlama. Commit mesajında hangi kısmın bu oturuma, hangisinin backlog'a ait olduğunu ayır.

Vault'ta commit at. Vault'un kendi git deposu var, kod deposundan baÄŸÄ±msÄ±z.
`.obsidian/workspace.json` gibi editÃ¶r durum dosyalarÄ±nÄ± commit'e katma.
