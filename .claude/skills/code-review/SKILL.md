---
name: code-review
description: Bir deÄŸiÅŸikliÄŸi birleÅŸtirmeden Ã¶nce gÃ¶zden geÃ§irmek iÃ§in kullan. PR incelemesi, "buna bir bak", "hazÄ±r mÄ±" tarzÄ± isteklerde ve kendi iÅŸini bitirmeden Ã¶nce kendini denetlerken devreye gir.
---

# Kod Ä°nceleme

## DuruÅŸ

AmaÃ§ hata bulmak deÄŸil, **kodun iddia ettiÄŸi ÅŸeyi yaptÄ±ÄŸÄ±ndan emin olmak**.
Bulgu yoksa uydurma. Bulgu varsa yumuÅŸatma.

## Kontrol listesi

### 1. Ä°ddia â†” gerÃ§ek
- Commit mesajÄ± / PR aÃ§Ä±klamasÄ± ne diyor, kod ne yapÄ±yor? AynÄ± mÄ±?
- Yorumlar ve JSDoc kodla uyumlu mu?
- Ä°simler davranÄ±ÅŸÄ± doÄŸru anlatÄ±yor mu? (Bir kontrolÃ¼n etiketi yaptÄ±ÄŸÄ± iÅŸi yansÄ±tÄ±yor mu?)

### 2. DoÄŸruluk
- UÃ§ durumlar: boÅŸ, sÄ±fÄ±r, negatif, sÄ±nÄ±r, kÃ¶ÅŸe
- Off-by-one, satÄ±r sarmasÄ±, indeks taÅŸmasÄ±
- Ã–lÃ§ek/birim hatalarÄ±: 0â€“1 deÄŸer yÃ¼zdeye Ã§evrilirken Ã§arpan doÄŸru mu, metre/hÃ¼cre karÄ±ÅŸmÄ±ÅŸ mÄ±
- Hata yolu: baÅŸarÄ±sÄ±zlÄ±kta ne oluyor? Sessizce yanlÄ±ÅŸ sonuÃ§ dÃ¶nÃ¼yor mu?

### 3. TutarlÄ±lÄ±k
- AynÄ± kavram baÅŸka bir yerde de hesaplanÄ±yor mu? Ä°kisi aynÄ± sonucu veriyor mu?
- Yeni kod dosyadaki mevcut kalÄ±plara uyuyor mu?
- Tekrar eden mantÄ±k kopyalanmÄ±ÅŸ mÄ±?

### 4. Kapsam
- DeÄŸiÅŸiklik amaÃ§lanan alanÄ±n dÄ±ÅŸÄ±na taÅŸmÄ±ÅŸ mÄ±?
- Commit'e sÄ±zmÄ±ÅŸ ilgisiz dosya var mÄ±? (editÃ¶r durum dosyalarÄ±, geÃ§ici scriptler, sonuÃ§ JSON'larÄ±)
- Debug log'u, yorum satÄ±rÄ±na alÄ±nmÄ±ÅŸ kod, TODO kalmÄ±ÅŸ mÄ±?

### 5. Ã–lÃ¼ kod
- HesaplanÄ±p kullanÄ±lmayan deÄŸiÅŸken
- GeÃ§irilip okunmayan parametre
- Fonksiyonun kabul etmediÄŸi argÃ¼manla yapÄ±lan Ã§aÄŸrÄ± (sessizce yok sayÄ±lÄ±r)
- Ãœretilip hiÃ§bir yere baÄŸlanmayan varlÄ±k

### 6. GÃ¼venlik
- Girdi doÄŸrulamasÄ±
- Koda gÃ¶mÃ¼lÃ¼ sÄ±r/anahtar/token
- Yeni baÄŸÄ±mlÄ±lÄ±k: gerekli mi, bakÄ±mlÄ± mÄ±, boyutu makul mÃ¼

### 7. Regresyon
- Bu deÄŸiÅŸiklik hangi mevcut davranÄ±ÅŸÄ± bozabilir?
- Proje invariant'larÄ±ndan biri ihlal ediliyor mu?
- DoÄŸrulama gerÃ§ekten yapÄ±lmÄ±ÅŸ mÄ±, yoksa "Ã§alÄ±ÅŸÄ±yor gibi" mi?

## SuÃ§u doÄŸru yere atmak

Bir sorun bildirildiÄŸinde, onu bu deÄŸiÅŸikliÄŸin sebep olduÄŸunu **varsayma.**
`git stash` / `git show HEAD` ile deÄŸiÅŸiklik Ã¶ncesi davranÄ±ÅŸÄ± kontrol et.
Ã–nceden var olan bir sorunu regresyon sanmak, yanlÄ±ÅŸ yerde saatler harcatÄ±r.

## Etkiyi derecelendir

Her bulgu iÃ§in: kullanÄ±cÄ±nÄ±n gÃ¶rdÃ¼ÄŸÃ¼ sonucu mu deÄŸiÅŸtiriyor, bir kararÄ± mÄ±,
yoksa sadece raporlanan bir sayÄ±yÄ± mÄ±? Bu ayrÄ±m Ã¶nceliÄŸi belirler.

## Ã‡Ä±ktÄ±

**Engelleyici** / **Ã–nemli** / **Ã–neri** olarak grupla.
Her bulgu: `dosya:satÄ±r` â€” ne â€” neden â€” nasÄ±l.

SonuÃ§ net olsun: onaylÄ±yor musun, yoksa dÃ¼zeltme mi bekliyorsun?
