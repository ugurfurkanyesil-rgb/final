---
name: code-review
description: Bir değişikliği birleştirmeden önce gözden geçirmek için kullan. PR incelemesi, "buna bir bak", "hazır mı" tarzı isteklerde ve kendi işini bitirmeden önce kendini denetlerken devreye gir.
---

# Kod İnceleme

## Duruş

Amaç hata bulmak değil, **kodun iddia ettiği şeyi yaptığından emin olmak**.
Bulgu yoksa uydurma. Bulgu varsa yumuşatma.

## Kontrol listesi

### 1. İddia ↔ gerçek
- Commit mesajı / PR açıklaması ne diyor, kod ne yapıyor? Aynı mı?
- Yorumlar ve JSDoc kodla uyumlu mu?
- İsimler davranışı doğru anlatıyor mu? (Bir kontrolün etiketi yaptığı işi yansıtıyor mu?)

### 2. Doğruluk
- Uç durumlar: boş, sıfır, negatif, sınır, köşe
- Off-by-one, satır sarması, indeks taşması
- Ölçek/birim hataları: 0–1 değer yüzdeye çevrilirken çarpan doğru mu, metre/hücre karışmış mı
- Hata yolu: başarısızlıkta ne oluyor? Sessizce yanlış sonuç dönüyor mu?

### 3. Tutarlılık
- Aynı kavram başka bir yerde de hesaplanıyor mu? İkisi aynı sonucu veriyor mu?
- Yeni kod dosyadaki mevcut kalıplara uyuyor mu?
- Tekrar eden mantık kopyalanmış mı?

### 4. Kapsam
- Değişiklik amaçlanan alanın dışına taşmış mı?
- Commit'e sızmış ilgisiz dosya var mı? (editör durum dosyaları, geçici scriptler, sonuç JSON'ları)
- Debug log'u, yorum satırına alınmış kod, TODO kalmış mı?

### 5. Ölü kod
- Hesaplanıp kullanılmayan değişken
- Geçirilip okunmayan parametre
- Fonksiyonun kabul etmediği argümanla yapılan çağrı (sessizce yok sayılır)
- Üretilip hiçbir yere bağlanmayan varlık

### 6. Güvenlik
- Girdi doğrulaması
- Koda gömülü sır/anahtar/token
- Yeni bağımlılık: gerekli mi, bakımlı mı, boyutu makul mü

### 7. Regresyon
- Bu değişiklik hangi mevcut davranışı bozabilir?
- Proje invariant'larından biri ihlal ediliyor mu?
- Doğrulama gerçekten yapılmış mı, yoksa "çalışıyor gibi" mi?

## Suçu doğru yere atmak

Bir sorun bildirildiğinde, onu bu değişikliğin sebep olduğunu **varsayma.**
`git stash` / `git show HEAD` ile değişiklik öncesi davranışı kontrol et.
Önceden var olan bir sorunu regresyon sanmak, yanlış yerde saatler harcatır.

## Etkiyi derecelendir

Her bulgu için: kullanıcının gördüğü sonucu mu değiştiriyor, bir kararı mı,
yoksa sadece raporlanan bir sayıyı mı? Bu ayrım önceliği belirler.

## Çıktı

**Engelleyici** / **Önemli** / **Öneri** olarak grupla.
Her bulgu: `dosya:satır` — ne — neden — nasıl.

Sonuç net olsun: onaylıyor musun, yoksa düzeltme mi bekliyorsun?