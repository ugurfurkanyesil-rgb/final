---
description: Oturumu kapat — öğrenilenleri vault'a yaz, kural güncellemesi gerekiyorsa öner
---

Bu oturumu kapat. Sırayla:

## 1. Oturum özeti

Bu oturumda ne yapıldığını çıkar:
- Hangi dosyalar değişti (`git status` / `git log` bu oturumdaki commit'ler)
- Hangi sorunlar bulundu, hangileri çözüldü, hangileri açık kaldı
- Hangi kararlar verildi ve neden
- Hangi ölçümler/kalibrasyonlar yapıldı

## 2. Vault'a yaz

`vault-sync` skill'ini kullan. `C:\Users\ACER\Desktop\MoonRover-Vault` altına:

- Bulunan her sorun → `bugs/` (çözülmemiş olsa bile, `status: open` ile)
- Verilen her tasarım kararı → `decisions/YYYY-MM-DD-konu.md`
- Etkilenen `features/`, `concepts/`, `sources/` sayfalarını güncelle
- Çift yönlü linkleri kur
- `index.md` ve `log.md` güncelle
- Vault'ta commit at

**Ölçüt:** koddan türetilemeyen bilgi yazılır. Rutin refactor, önemsiz düzeltme yazılmaz.

## 3. Kural güncellemesi gerekiyor mu

`retro` skill'ini uygula. Bu oturumda:
- Yeni bir invariant/kural doğdu mu?
- Mevcut bir kural yanlışlandı mı?
- Bir agent beklenmedik davrandı mı (talimatı yetersiz demektir)?

Öneri varsa **sun, uygulama** — onay bekle.

## 4. Kapanış raporu

Kısa tut:
- Vault'a hangi sayfalar yazıldı/güncellendi
- Açık kalan işler neler
- Bir sonraki oturumda nereden devam edilmeli