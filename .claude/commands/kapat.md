---
description: Oturumu kapat â€” Ã¶ÄŸrenilenleri vault'a yaz, kural gÃ¼ncellemesi gerekiyorsa Ã¶ner
---

Bu oturumu kapat. SÄ±rayla:

## 1. Oturum Ã¶zeti

Bu oturumda ne yapÄ±ldÄ±ÄŸÄ±nÄ± Ã§Ä±kar:
- Hangi dosyalar deÄŸiÅŸti (`git status` / `git log` bu oturumdaki commit'ler)
- Hangi sorunlar bulundu, hangileri Ã§Ã¶zÃ¼ldÃ¼, hangileri aÃ§Ä±k kaldÄ±
- Hangi kararlar verildi ve neden
- Hangi Ã¶lÃ§Ã¼mler/kalibrasyonlar yapÄ±ldÄ±

## 2. Vault'a yaz

`vault-sync` skill'ini kullan. `C:\Users\ACER\Desktop\MoonRover-Vault` altÄ±na:

- Bulunan her sorun â†’ `bugs/` (Ã§Ã¶zÃ¼lmemiÅŸ olsa bile, `status: open` ile)
- Verilen her tasarÄ±m kararÄ± â†’ `decisions/YYYY-MM-DD-konu.md`
- Etkilenen `features/`, `concepts/`, `sources/` sayfalarÄ±nÄ± gÃ¼ncelle
- Ã‡ift yÃ¶nlÃ¼ linkleri kur
- `index.md` ve `log.md` gÃ¼ncelle
- Vault'ta commit at

**Ã–lÃ§Ã¼t:** koddan tÃ¼retilemeyen bilgi yazÄ±lÄ±r. Rutin refactor, Ã¶nemsiz dÃ¼zeltme yazÄ±lmaz.

## 3. Kural gÃ¼ncellemesi gerekiyor mu

`retro` skill'ini uygula. Bu oturumda:
- Yeni bir invariant/kural doÄŸdu mu?
- Mevcut bir kural yanlÄ±ÅŸlandÄ± mÄ±?
- Bir agent beklenmedik davrandÄ± mÄ± (talimatÄ± yetersiz demektir)?

Ã–neri varsa **sun, uygulama** â€” onay bekle.

## 4. KapanÄ±ÅŸ raporu

KÄ±sa tut:
- Vault'a hangi sayfalar yazÄ±ldÄ±/gÃ¼ncellendi
- AÃ§Ä±k kalan iÅŸler neler
- Bir sonraki oturumda nereden devam edilmeli
