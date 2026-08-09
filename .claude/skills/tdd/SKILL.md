---
name: tdd
description: Davranış değiştiren kod yazarken test-önce yaklaşımı uygulamak için kullan. Yeni fonksiyon, bug düzeltme, algoritma değişikliği ve refactor işlerinde devreye gir.
---

# Test Önce

## Döngü

1. **Kırmızı** — beklenen davranışı ifade eden testi yaz, **çalıştır, başarısız olduğunu gör**
2. **Yeşil** — testi geçirecek en basit kodu yaz
3. **Refactor** — testler yeşilken temizle

2. adımdaki "çalıştır ve başarısız olduğunu gör" atlanmaz. Başarısız olduğunu görmediğin bir test,
hiçbir şeyi test etmiyor olabilir.

## Bug düzeltirken

Sıra şudur:
1. Bug'ı **yeniden üreten** bir test yaz
2. Testin gerçekten başarısız olduğunu gör — bu, bug'ı doğru anladığının kanıtıdır
3. Düzelt
4. Test geçsin
5. Testi bırak — aynı bug bir daha geri gelirse yakalanır

Bug'ı önce düzeltip sonra test yazmak, teste "zaten geçen bir şeyi" doğrulatır.

## Neyi test edersin

**Test et:** iş mantığı, sınır koşulları, hata yolları, dönüşümler, algoritmalar,
"asla olmamalı" garantileri.

**Etme:** framework'ün kendisini, üçüncü parti kütüphaneyi, trivial getter/setter'ı,
sadece kaplama sayısı yükselsin diye yazılan testi.

## Uç durumlar — atlanan yerler

- Boş girdi, tek elemanlı girdi
- Sıfır, negatif, çok büyük değer
- Grid/dizi **sınırları ve köşeleri** — sarma (wrap-around) hataları burada yaşar
- Başlangıç = bitiş
- Ulaşılamaz / imkânsız durum — fonksiyon dürüstçe başarısız oluyor mu, yoksa
  "başardım" diye yanlış bir sonuç mu döndürüyor?

Son madde kritik: bir fonksiyonun "yol bulundu" deyip aslında geçersiz bir yol döndürmesi,
hiç bulamamasından daha tehlikelidir.

## Test nasıl yazılır

- **Bir test bir şeyi doğrular.** İsim ne doğrulandığını söylesin.
- **Arrange – Act – Assert** ayrık olsun.
- Test **deterministik** olsun: rastgelelik varsa sabit tohum, zaman varsa sabit saat.
- Assert somut olsun. `expect(result).toBeTruthy()` çoğu zaman hiçbir şey doğrulamaz.

## Test edilemiyorsa

Bir şeyi test etmek çok zorsa, genellikle tasarım sorunudur: fonksiyon çok şey yapıyor,
yan etkiler iç içe geçmiş, bağımlılıklar sabitlenmiş. Testi zorlamak yerine kodu ayır.

Gerçekten test edilemeyen alanlar (3D render, canvas görseli) için:
saf hesaplama kısmını ayır, onu test et; görsel kısmı **gözle doğrula** ve bunu
"test edildi" diye raporlama — ekran görüntüsü iste.