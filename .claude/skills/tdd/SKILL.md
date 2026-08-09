---
name: tdd
description: DavranÄ±ÅŸ deÄŸiÅŸtiren kod yazarken test-Ã¶nce yaklaÅŸÄ±mÄ± uygulamak iÃ§in kullan. Yeni fonksiyon, bug dÃ¼zeltme, algoritma deÄŸiÅŸikliÄŸi ve refactor iÅŸlerinde devreye gir.
---

# Test Ã–nce

## DÃ¶ngÃ¼

1. **KÄ±rmÄ±zÄ±** â€” beklenen davranÄ±ÅŸÄ± ifade eden testi yaz, **Ã§alÄ±ÅŸtÄ±r, baÅŸarÄ±sÄ±z olduÄŸunu gÃ¶r**
2. **YeÅŸil** â€” testi geÃ§irecek en basit kodu yaz
3. **Refactor** â€” testler yeÅŸilken temizle

2. adÄ±mdaki "Ã§alÄ±ÅŸtÄ±r ve baÅŸarÄ±sÄ±z olduÄŸunu gÃ¶r" atlanmaz. BaÅŸarÄ±sÄ±z olduÄŸunu gÃ¶rmediÄŸin bir test,
hiÃ§bir ÅŸeyi test etmiyor olabilir.

## Bug dÃ¼zeltirken

SÄ±ra ÅŸudur:
1. Bug'Ä± **yeniden Ã¼reten** bir test yaz
2. Testin gerÃ§ekten baÅŸarÄ±sÄ±z olduÄŸunu gÃ¶r â€” bu, bug'Ä± doÄŸru anladÄ±ÄŸÄ±nÄ±n kanÄ±tÄ±dÄ±r
3. DÃ¼zelt
4. Test geÃ§sin
5. Testi bÄ±rak â€” aynÄ± bug bir daha geri gelirse yakalanÄ±r

Bug'Ä± Ã¶nce dÃ¼zeltip sonra test yazmak, teste "zaten geÃ§en bir ÅŸeyi" doÄŸrulatÄ±r.

## Neyi test edersin

**Test et:** iÅŸ mantÄ±ÄŸÄ±, sÄ±nÄ±r koÅŸullarÄ±, hata yollarÄ±, dÃ¶nÃ¼ÅŸÃ¼mler, algoritmalar,
"asla olmamalÄ±" garantileri.

**Etme:** framework'Ã¼n kendisini, Ã¼Ã§Ã¼ncÃ¼ parti kÃ¼tÃ¼phaneyi, trivial getter/setter'Ä±,
sadece kaplama sayÄ±sÄ± yÃ¼kselsin diye yazÄ±lan testi.

## UÃ§ durumlar â€” atlanan yerler

- BoÅŸ girdi, tek elemanlÄ± girdi
- SÄ±fÄ±r, negatif, Ã§ok bÃ¼yÃ¼k deÄŸer
- Grid/dizi **sÄ±nÄ±rlarÄ± ve kÃ¶ÅŸeleri** â€” sarma (wrap-around) hatalarÄ± burada yaÅŸar
- BaÅŸlangÄ±Ã§ = bitiÅŸ
- UlaÅŸÄ±lamaz / imkÃ¢nsÄ±z durum â€” fonksiyon dÃ¼rÃ¼stÃ§e baÅŸarÄ±sÄ±z oluyor mu, yoksa
  "baÅŸardÄ±m" diye yanlÄ±ÅŸ bir sonuÃ§ mu dÃ¶ndÃ¼rÃ¼yor?

Son madde kritik: bir fonksiyonun "yol bulundu" deyip aslÄ±nda geÃ§ersiz bir yol dÃ¶ndÃ¼rmesi,
hiÃ§ bulamamasÄ±ndan daha tehlikelidir.

## Test nasÄ±l yazÄ±lÄ±r

- **Bir test bir ÅŸeyi doÄŸrular.** Ä°sim ne doÄŸrulandÄ±ÄŸÄ±nÄ± sÃ¶ylesin.
- **Arrange â€“ Act â€“ Assert** ayrÄ±k olsun.
- Test **deterministik** olsun: rastgelelik varsa sabit tohum, zaman varsa sabit saat.
- Assert somut olsun. `expect(result).toBeTruthy()` Ã§oÄŸu zaman hiÃ§bir ÅŸey doÄŸrulamaz.

## Test edilemiyorsa

Bir ÅŸeyi test etmek Ã§ok zorsa, genellikle tasarÄ±m sorunudur: fonksiyon Ã§ok ÅŸey yapÄ±yor,
yan etkiler iÃ§ iÃ§e geÃ§miÅŸ, baÄŸÄ±mlÄ±lÄ±klar sabitlenmiÅŸ. Testi zorlamak yerine kodu ayÄ±r.

GerÃ§ekten test edilemeyen alanlar (3D render, canvas gÃ¶rseli) iÃ§in:
saf hesaplama kÄ±smÄ±nÄ± ayÄ±r, onu test et; gÃ¶rsel kÄ±smÄ± **gÃ¶zle doÄŸrula** ve bunu
"test edildi" diye raporlama â€” ekran gÃ¶rÃ¼ntÃ¼sÃ¼ iste.
