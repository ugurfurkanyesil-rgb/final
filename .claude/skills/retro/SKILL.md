---
name: retro
description: Bir iÅŸ bitiminde veya oturum sonunda, Ã¶ÄŸrenilenlerin agent/skill dosyalarÄ±na yansÄ±tÄ±lmasÄ± gerekip gerekmediÄŸini deÄŸerlendirmek iÃ§in kullan. "Retro yap", "oturumu kapat", "bunu kalÄ±cÄ± hale getir" dendiÄŸinde ya da yeni bir invariant/kural ortaya Ã§Ä±ktÄ±ÄŸÄ±nda devreye gir.
---

# Retrospektif â€” KurallarÄ± GÃ¼ncel Tutma

`.claude/agents/` ve `.claude/skills/` dosyalarÄ± projenin **kurumsal hafÄ±zasÄ±dÄ±r**.
Proje deÄŸiÅŸir, kurallar eskir. Bu skill o eskimeyi yakalar.

Otomatik deÄŸildir â€” bilinÃ§li olarak tetiklenir.

## Ne zaman Ã§alÄ±ÅŸtÄ±rÄ±lÄ±r

- AnlamlÄ± bir iÅŸ bittiÄŸinde (PR Ã¶ncesi iyi bir an)
- Yeni bir invariant ortaya Ã§Ä±ktÄ±ÄŸÄ±nda ("ÅŸuraya asla girilmemeli" gibi)
- Bir bug'Ä±n kÃ¶k nedeni "kimse bilmiyordu" Ã§Ä±ktÄ±ÄŸÄ±nda
- Bir agent yanlÄ±ÅŸ ÅŸey yaptÄ±ÄŸÄ±nda â€” talimatÄ± yetersiz demektir
- Proje sabitleri/mimarisi deÄŸiÅŸtiÄŸinde

## Sorular

SÄ±rayla cevapla, hepsine "hayÄ±r" Ã§Ä±kabilir â€” o da geÃ§erli bir sonuÃ§tur.

### 1. Yeni bir kural mÄ± doÄŸdu?
Bu oturumda "bundan sonra hep bÃ¶yle yapalÄ±m" denen bir ÅŸey oldu mu?
Varsa hangi dosyaya ait: proje konvansiyonlarÄ± mÄ±, bir agent'Ä±n davranÄ±ÅŸÄ± mÄ±, bir prosedÃ¼r mÃ¼?

### 2. Mevcut bir kural yanlÄ±ÅŸlandÄ± mÄ±?
Dosyalarda yazan bir ÅŸey artÄ±k doÄŸru deÄŸil mi? (Bir sabit deÄŸiÅŸti, bir dosya taÅŸÄ±ndÄ±,
bir yaklaÅŸÄ±m terk edildi.) YanlÄ±ÅŸ kural, kural olmamasÄ±ndan kÃ¶tÃ¼dÃ¼r â€” silme, **dÃ¼zelt**.

### 3. Bir agent beklendiÄŸi gibi davranmadÄ± mÄ±?
Agent yanlÄ±ÅŸ ÅŸey yaptÄ±ysa suÃ§ genelde talimattadÄ±r:
- YapmamasÄ± gereken ÅŸeyi yaptÄ± â†’ sÄ±nÄ±r eksik
- YapmasÄ± gerekeni atladÄ± â†’ adÄ±m eksik
- HiÃ§ Ã§aÄŸrÄ±lmadÄ± â†’ `description` alanÄ± yetersiz
- YanlÄ±ÅŸ yerde Ã§aÄŸrÄ±ldÄ± â†’ `description` fazla geniÅŸ

`description` en sÄ±k gÃ¶zden kaÃ§an alandÄ±r; tetiklenmeyi o belirler.

### 4. Bir skill fazla ÅŸiÅŸti mi?
Bir `SKILL.md` uzayÄ±p okunmaz hale geldiyse, referans materyali yanÄ±na ayrÄ± `.md` dosyalarÄ±na
bÃ¶l â€” ana dosya kÄ±sa kalsÄ±n, detay gerektiÄŸinde yÃ¼klensin.

### 5. Tekrar eden bir iÅŸ var mÄ±?
AynÄ± prosedÃ¼rÃ¼ Ã¼Ã§Ã¼ncÃ¼ kez elle anlatÄ±yorsan, o bir skill olmalÄ±.

## DeÄŸiÅŸikliÄŸi uygularken

- **Somut yaz.** "Dikkatli ol" kural deÄŸildir. "X'e dokunuyorsan Y prosedÃ¼rÃ¼nÃ¼ Ã§alÄ±ÅŸtÄ±r" kuraldÄ±r.
- **Neden'i koru.** Bir kuralÄ±n gerekÃ§esi yazÄ±lÄ± deÄŸilse, birileri onu ilerde haklÄ± olarak siler.
- **Ã–rnek ver ama olay anlatma.** "Bir kez ÅŸÃ¶yle oldu" yerine kuralÄ± genel biÃ§imde yaz;
  olayÄ±n detayÄ± vault'a ait, kural dosyasÄ±na deÄŸil.
- **Sil ve arÅŸivleme yapma.** Bunlar kod, wiki deÄŸil â€” eskiyen kural dÃ¼zeltilir veya silinir.

## Ã‡Ä±ktÄ±

Ã–nerdiÄŸin her deÄŸiÅŸiklik iÃ§in:
- Hangi dosya, hangi bÃ¶lÃ¼m
- Ne eklenecek/deÄŸiÅŸecek
- Neden (hangi olay/ihtiyaÃ§ tetikledi)

KullanÄ±cÄ± onaylamadan dosyalarÄ± deÄŸiÅŸtirme. Onaydan sonra commit'e dahil et â€”
kural deÄŸiÅŸikliÄŸi de takÄ±mÄ±n gÃ¶rmesi gereken bir deÄŸiÅŸikliktir.

## Kapsam ayrÄ±mÄ±

| Nereye | Ne |
|---|---|
| `.claude/` dosyalarÄ± | **Kural** â€” bundan sonra hep geÃ§erli olan |
| Vault (`MoonRover-Vault`) | **Olay** â€” ne oldu, ne Ã¶ÄŸrenildi, hangi karar verildi |

AynÄ± bilgi ikisine de gidebilir, ama farklÄ± biÃ§imde: kural genel ve emir kipinde,
vault kaydÄ± tarihli ve gerekÃ§eli.
