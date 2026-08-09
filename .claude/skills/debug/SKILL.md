---
name: debug
description: Bir ÅŸey beklendiÄŸi gibi Ã§alÄ±ÅŸmadÄ±ÄŸÄ±nda sistematik teÅŸhis iÃ§in kullan. Hata mesajÄ±, gÃ¶rsel artefakt, yanlÄ±ÅŸ sayÄ±, "Ã¶nce Ã§alÄ±ÅŸÄ±yordu ÅŸimdi Ã§alÄ±ÅŸmÄ±yor" durumlarÄ±nda devreye gir.
---

# Sistematik Hata AyÄ±klama

## AltÄ±n kural

**Semptomu deÄŸil, kÃ¶k nedeni dÃ¼zelt.** Ekranda yanlÄ±ÅŸ sayÄ± gÃ¶rÃ¼nÃ¼yorsa, sayÄ±yÄ± dÃ¼zeltmek
Ã§Ã¶zÃ¼m deÄŸildir â€” o sayÄ±nÄ±n neden yanlÄ±ÅŸ hesaplandÄ±ÄŸÄ±nÄ± bul.

Ä°kinci kural: **tahmin etme, Ã¶lÃ§.** Her hipotez bir deneyle elenir ya da doÄŸrulanÄ±r.

## SÄ±ra

### 1. Yeniden Ã¼ret
Sorunu gÃ¼venilir ÅŸekilde tekrar Ã¼retemiyorsan, dÃ¼zelttiÄŸini de doÄŸrulayamazsÄ±n.
En kÃ¼Ã§Ã¼k tekrarlanabilir senaryoyu bul.

### 2. DeÄŸiÅŸikliÄŸi izole et â€” regresyon mu?
"Ã–nce Ã§alÄ±ÅŸÄ±yordu" deniyorsa **bunu doÄŸrula, varsayma:**
```
git stash          # deÄŸiÅŸiklikleri geÃ§ici kaldÄ±r
# senaryoyu tekrar Ã§alÄ±ÅŸtÄ±r
git stash pop
```
veya `git show HEAD:<dosya>` ile Ã¶nceki hÃ¢li karÅŸÄ±laÅŸtÄ±r.

Sorun eski kodda da varsa, bu bir regresyon deÄŸildir â€” suÃ§u son deÄŸiÅŸikliÄŸe atma.
Bu adÄ±m atlanÄ±nca yanlÄ±ÅŸ yerde saatler harcanÄ±r.

### 3. DeÄŸiÅŸiklik hedefe ulaÅŸÄ±yor mu?
Kod dÃ¼zeltildi ama davranÄ±ÅŸ aynÄ±ysa, Ã¶nce ÅŸunu ele:
- Sunucu/derleyici gerÃ§ekten yeni kodu mu servis ediyor? (`curl` ile diskteki dosyayla karÅŸÄ±laÅŸtÄ±r)
- Birden fazla sÃ¼reÃ§ mi Ã§alÄ±ÅŸÄ±yor? Port karÄ±ÅŸÄ±klÄ±ÄŸÄ± var mÄ±?
- Cache/HMR yakalamÄ±ÅŸ mÄ±? Sert yenileme yapÄ±ldÄ± mÄ±?
- DoÄŸru dosyaya mÄ± bakÄ±yorsun? (aynÄ± isimli iki dosya, kopya klasÃ¶r)

Bu, "kodda hata yok ama davranÄ±ÅŸ deÄŸiÅŸmiyor" durumlarÄ±nÄ±n en sÄ±k sebebidir.

### 4. Ãœretilen ÅŸey kullanÄ±lÄ±yor mu?
Bir deÄŸer/varlÄ±k Ã¼retiliyor ama hiÃ§bir tÃ¼keticiye baÄŸlanmamÄ±ÅŸ olabilir.
Ãœretim fonksiyonunda ne yaparsan yap sonuÃ§ deÄŸiÅŸmez.
`grep` ile: bu deÄŸeri kim okuyor? GerÃ§ekten bir yere gidiyor mu?

### 5. Ä°kiye bÃ¶lerek daralt
Sorunun hangi katmanda olduÄŸunu ikiye bÃ¶lerek bul: veri mi, hesap mÄ±, sunum mu?
Her katmanÄ±n Ã§Ä±ktÄ±sÄ±nÄ± ayrÄ± ayrÄ± incele. `git bisect` uzun geÃ§miÅŸlerde iÅŸe yarar.

### 6. Hipotezi test et
Her hipotez iÃ§in: bu doÄŸruysa **ne gÃ¶zlemlemeliyim?**
KÃ¼Ã§Ã¼k, izole bir deney kur (mini grid, tek fonksiyon Ã§aÄŸrÄ±sÄ±, baÄŸÄ±msÄ±z render).
GÃ¶zlem hipotezle uyuÅŸmuyorsa hipotezi bÄ±rak â€” zorlama.

### 7. KÃ¶k nedeni doÄŸrula
DÃ¼zeltmeden Ã¶nce aÃ§Ä±klaman **tÃ¼m** semptomlarÄ± aÃ§Ä±klÄ±yor mu?
Bir kÄ±smÄ±nÄ± aÃ§Ä±klÄ±yorsa muhtemelen iki ayrÄ± sorun var, ya da yanlÄ±ÅŸ nedeni buldun.

## YaygÄ±n yanÄ±lgÄ±lar

- **"Ä°statistik testi geÃ§ti, demek ki doÄŸru."** SayÄ±sal test gÃ¶rsel/davranÄ±ÅŸsal doÄŸruluÄŸu
  garanti etmez. GerÃ§ek Ã§Ä±ktÄ±ya bak.
- **"Hipotezim mantÄ±klÄ±, muhtemelen budur."** Ã–lÃ§meden geÃ§me.
- **"DÃ¼zelttim, bitti."** Kendi dÃ¼zeltmen yeni bir bug getirebilir; dÃ¼zeltmeyi de test et.
- **"Yorum bÃ¶yle diyor."** Yorum yanlÄ±ÅŸ olabilir. Kod ne yapÄ±yor, ona bak.

## Bulunca

KÃ¶k nedeni, kanÄ±tÄ± ve dÃ¼zeltmeyi birlikte belgele.
AynÄ± sÄ±nÄ±ftan baÅŸka yerlerde de aynÄ± hata var mÄ± â€” bir kez bakmaya deÄŸer.
GenelleÅŸtirilebilir bir ders varsa yaz; bir dahakine aranan yer orasÄ± olur.
