# Vault entegrasyonu kurulum - final klasorunun ICINDE calistir
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path ".claude\skills\vault-sync" | Out-Null
$content = @'
---
name: vault-sync
description: MoonRover-Vault bilgi arşivine yazmak veya oradan geçmiş kararları okumak için kullan. Bir bug bulunduğunda, tasarım kararı verildiğinde, kalibrasyon ölçüldüğünde ya da "bunu daha önce konuşmuş muyduk", "neden böyle yapmıştık" sorularında devreye gir.
---

# Vault — İki Yönlü Bilgi Akışı

Vault yolu: `C:\Users\ACER\Desktop\MoonRover-Vault`
Vault'un kendi anayasası: `MoonRover-Vault/CLAUDE.md` — **çelişki olursa o dosya kazanır.**

Kod deposu (`final/`) ile vault ayrı yerlerdedir ve otomatik senkronize olmazlar.
Bu skill o köprüyü kurar.

Vault dizini proje dışında olduğu için Claude Code ilk erişimde izin isteyecektir.
"Her zaman izin ver" seçilirse sonraki oturumlarda sormaz.

---

## A. OKUMA — plan yapmadan önce

Yeni bir işe başlarken, o konuda daha önce alınmış bir karar olup olmadığına bak.
Aynı tartışmayı ikinci kez yapmak, vault'un var olma sebebini boşa çıkarır.

**Ne zaman bak:**
- Bir modülü değiştirmeden önce (`decisions/` ve `bugs/` içinde o modül geçiyor mu?)
- "Neden böyle yapılmış" sorusunda
- Bir yaklaşımı reddetmeden önce — belki daha önce denenmiş ve elenmiş olabilir
- Bir bug'ı düzeltmeden önce — daha önce görülmüş ve bilinçli olarak bırakılmış olabilir

**Nasıl:** `bugs/`, `decisions/`, `syntheses/` ve `index.md` içinde ilgili terimleri ara.
Bulduğun kararı **tarihiyle birlikte** aktar; eski bir karar hâlâ geçerli olmayabilir,
ama görmezden gelinmemeli.

Bir kararla çelişen bir şey yapacaksan: bunu açıkça söyle ve gerekçelendir.
Sessizce eski kararın üzerinden geçme.

---

## B. YAZMA — iş bitiminde

### Ne gider, ne gitmez

**Gider:** niyet, karar gerekçesi, elenen alternatifler, kalibrasyon sayıları,
tespit edilen tutarsızlıklar, "ilk çözüm neden yanlıştı" dersleri, açık kalan sorular.

**Gitmez:** kodun kendisi (git'te zaten var), rutin refactor'lar, önemsiz düzeltmeler.

Ölçüt: **koddan türetilemeyen bilgi mi?** Cevap hayırsa yazma.

### Klasör eşlemesi

| Klasör | İçerik |
|---|---|
| `raw/` | Ham kaynaklar — **DEĞİŞTİRİLMEZ** |
| `sources/` | Ham kaynakların özet sayfaları |
| `entities/` | Somut şeyler (uygulama, monorepo) |
| `concepts/` | Kavramlar (rota modları, terrain üretimi) |
| `features/` | Özellikler (pathfinder, heatmap, öğrenme modeli) |
| `bugs/` | Tespit edilen sorunlar — çözülmüş veya açık |
| `decisions/` | Tasarım kararları, `YYYY-MM-DD-konu.md` |
| `syntheses/` | Birden çok kaynağı birleştiren analizler |
| `archive/` | Silinmeyen, emekliye ayrılan sayfalar |

### Hard rules (vault CLAUDE.md'den)

1. `raw/` dokunulmazdır. İçindeki bir dosyada bug varsa onu düzeltme —
   `bugs/` altına ayrı kayıt aç, `sources/` sayfasına çelişki notu düş.
2. Her iddia kaynaklıdır (hangi dosya, hangi ölçüm, hangi commit).
3. Çelişki silinmez, işaretlenir.
4. Sayfa silinmez, arşivlenir.
5. Çift yönlü link: yeni sayfa açıldığında ilgili sayfalardan da ona link verilir.
6. Her işlem sonrası `index.md` ve `log.md` güncellenir.

### Bug kaydı formatı

```markdown
---
title: <kısa başlık>
tags: [bug, <modül>]
date: YYYY-MM-DD
status: resolved | open
---

## Belirti
Kullanıcının/testin gördüğü şey.

## Kök neden
Gerçek sebep — semptom değil.

## Kanıt
Ölçüm, test çıktısı, git bulgusu.

## Çözüm
Ne değişti, hangi dosyada, hangi commit.

## Test
Nasıl doğrulandı, nasıl tekrar doğrulanır.

## Ders
Genelleştirilebilir çıkarım varsa.

## İlgili
- [[features/...]]
```

### Karar kaydı formatı

```markdown
---
title: <karar>
tags: [decision, <alan>]
date: YYYY-MM-DD
---

## Karar
Tek cümle, emir kipinde.

## Bağlam
Hangi problem bu kararı gerektirdi.

## Seçenekler
Neler değerlendirildi, hangileri neden elendi.

## Sonuçlar
Bu kararın getirdiği kısıtlar ve maliyetler.

## Geçerlilik
Hangi koşullar değişirse bu karar gözden geçirilmeli.
```

---

## Kapsam ayrımı — burası kritik

| Nereye | Ne | Biçim |
|---|---|---|
| `.claude/` (kod deposu) | **Kural** — bundan sonra hep geçerli | Genel, emir kipinde, tarihsiz |
| Vault | **Olay** — ne oldu, ne öğrenildi | Tarihli, gerekçeli, kaynaklı |

Aynı bilgi ikisine de gidebilir ama farklı biçimde.
Örnek: vault'a "8 Ağustos'ta şu ölçümlerle şu karar verildi" yazılır;
`.claude/skills/`'e "X'e dokunuyorsan Y prosedürünü çalıştır" yazılır.

Kural değişikliği gerekiyorsa `retro` skill'ine geç — bu skill sadece vault'u yönetir.

## Bitirirken

Vault'ta commit at. Vault'un kendi git deposu var, kod deposundan bağımsız.
`.obsidian/workspace.json` gibi editör durum dosyalarını commit'e katma.
'@
Set-Content -Path ".claude\skills\vault-sync\SKILL.md" -Value $content -Encoding UTF8
Write-Host "OK: .claude\skills\vault-sync\SKILL.md" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path ".claude\commands" | Out-Null
$content = @'
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
'@
Set-Content -Path ".claude\commands\kapat.md" -Value $content -Encoding UTF8
Write-Host "OK: .claude\commands\kapat.md" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path ".claude\commands" | Out-Null
$content = @'
---
description: Vault'ta geçmiş karar/bulgu ara — bir işe başlamadan önce
---

`C:\Users\ACER\Desktop\MoonRover-Vault` içinde şu konuyu ara: **$ARGUMENTS**

`vault-sync` skill'inin OKUMA bölümünü uygula.

Aranacak yerler: `decisions/`, `bugs/`, `syntheses/`, `features/`, `concepts/`, `index.md`.

## Rapor

Bulduklarını şöyle sun:

- **İlgili kararlar** — tarih + karar + hâlâ geçerli görünüyor mu
- **İlgili bulgular** — bug/tutarsızlık, çözülmüş mü açık mı
- **Elenen alternatifler** — daha önce denenip vazgeçilen bir yaklaşım varsa, neden vazgeçildiği
- **Açık sorular** — bu konuda vault'ta cevaplanmamış bir şey kalmış mı

Hiçbir şey bulamazsan bunu açıkça söyle — "kayıt yok" da bir bilgidir,
uydurma bağlantı kurmaktan iyidir.

Bulduğun bir kararla çelişen bir şey yapılacaksa, bunu belirt ve gerekçe iste.
'@
Set-Content -Path ".claude\commands\vault.md" -Value $content -Encoding UTF8
Write-Host "OK: .claude\commands\vault.md" -ForegroundColor Green

Write-Host ""
Write-Host "Kuruldu. Kullanim:" -ForegroundColor Cyan
Write-Host "  /vault <konu>   -> ise baslamadan once gecmisi ara"
Write-Host "  /kapat          -> oturum sonu, vault a yaz + retro"
