---
name: retro
description: Bir iş bitiminde veya oturum sonunda, öğrenilenlerin agent/skill dosyalarına yansıtılması gerekip gerekmediğini değerlendirmek için kullan. "Retro yap", "oturumu kapat", "bunu kalıcı hale getir" dendiğinde ya da yeni bir invariant/kural ortaya çıktığında devreye gir.
---

# Retrospektif — Kuralları Güncel Tutma

`.claude/agents/` ve `.claude/skills/` dosyaları projenin **kurumsal hafızasıdır**.
Proje değişir, kurallar eskir. Bu skill o eskimeyi yakalar.

Otomatik değildir — bilinçli olarak tetiklenir.

## Ne zaman çalıştırılır

- Anlamlı bir iş bittiğinde (PR öncesi iyi bir an)
- Yeni bir invariant ortaya çıktığında ("şuraya asla girilmemeli" gibi)
- Bir bug'ın kök nedeni "kimse bilmiyordu" çıktığında
- Bir agent yanlış şey yaptığında — talimatı yetersiz demektir
- Proje sabitleri/mimarisi değiştiğinde

## Sorular

Sırayla cevapla, hepsine "hayır" çıkabilir — o da geçerli bir sonuçtur.

### 1. Yeni bir kural mı doğdu?
Bu oturumda "bundan sonra hep böyle yapalım" denen bir şey oldu mu?
Varsa hangi dosyaya ait: proje konvansiyonları mı, bir agent'ın davranışı mı, bir prosedür mü?

### 2. Mevcut bir kural yanlışlandı mı?
Dosyalarda yazan bir şey artık doğru değil mi? (Bir sabit değişti, bir dosya taşındı,
bir yaklaşım terk edildi.) Yanlış kural, kural olmamasından kötüdür — silme, **düzelt**.

### 3. Bir agent beklendiği gibi davranmadı mı?
Agent yanlış şey yaptıysa suç genelde talimattadır:
- Yapmaması gereken şeyi yaptı → sınır eksik
- Yapması gerekeni atladı → adım eksik
- Hiç çağrılmadı → `description` alanı yetersiz
- Yanlış yerde çağrıldı → `description` fazla geniş

`description` en sık gözden kaçan alandır; tetiklenmeyi o belirler.

### 4. Bir skill fazla şişti mi?
Bir `SKILL.md` uzayıp okunmaz hale geldiyse, referans materyali yanına ayrı `.md` dosyalarına
böl — ana dosya kısa kalsın, detay gerektiğinde yüklensin.

### 5. Tekrar eden bir iş var mı?
Aynı prosedürü üçüncü kez elle anlatıyorsan, o bir skill olmalı.

## Değişikliği uygularken

- **Somut yaz.** "Dikkatli ol" kural değildir. "X'e dokunuyorsan Y prosedürünü çalıştır" kuraldır.
- **Neden'i koru.** Bir kuralın gerekçesi yazılı değilse, birileri onu ilerde haklı olarak siler.
- **Örnek ver ama olay anlatma.** "Bir kez şöyle oldu" yerine kuralı genel biçimde yaz;
  olayın detayı vault'a ait, kural dosyasına değil.
- **Sil ve arşivleme yapma.** Bunlar kod, wiki değil — eskiyen kural düzeltilir veya silinir.

## Çıktı

Önerdiğin her değişiklik için:
- Hangi dosya, hangi bölüm
- Ne eklenecek/değişecek
- Neden (hangi olay/ihtiyaç tetikledi)

Kullanıcı onaylamadan dosyaları değiştirme. Onaydan sonra commit'e dahil et —
kural değişikliği de takımın görmesi gereken bir değişikliktir.

## Kapsam ayrımı

| Nereye | Ne |
|---|---|
| `.claude/` dosyaları | **Kural** — bundan sonra hep geçerli olan |
| Vault (`MoonRover-Vault`) | **Olay** — ne oldu, ne öğrenildi, hangi karar verildi |

Aynı bilgi ikisine de gidebilir, ama farklı biçimde: kural genel ve emir kipinde,
vault kaydı tarihli ve gerekçeli.