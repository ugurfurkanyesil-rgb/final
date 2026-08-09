---
name: plan
description: Bir iÅŸe baÅŸlamadan Ã¶nce plan Ã§Ä±karmak iÃ§in kullan. Yeni Ã¶zellik, refactor, migrasyon veya kapsamÄ± belirsiz herhangi bir istekte devreye gir. Plan olmadan bÃ¼yÃ¼k deÄŸiÅŸikliÄŸe giriÅŸilmesini engeller.
---

# Planlama Disiplini

## Plan ne zaman gerekir

| Durum | Plan? |
|---|---|
| Tek dosyada, geri almasÄ± kolay, aÃ§Ä±k bir dÃ¼zeltme | HayÄ±r â€” yap |
| 3+ dosyaya dokunuyor | Evet |
| Mevcut bir davranÄ±ÅŸÄ± deÄŸiÅŸtiriyor | Evet |
| KapsamÄ± belirsiz ("ÅŸunu iyileÅŸtirelim") | Evet â€” Ã¶nce netleÅŸtir |
| Geri almasÄ± zor (veri ÅŸemasÄ±, dosya taÅŸÄ±ma) | Evet |

## BelirsizliÄŸi Ã¶nce Ã§Ã¶z

Plan yazmadan Ã¶nce cevabÄ± olmayan soru bÄ±rakma. SorularÄ±nÄ± **tek seferde** sor, en fazla Ã¼Ã§ tane.

KÃ¶tÃ¼: varsayÄ±p devam etmek, sonra "aslÄ±nda Ã¶yle demek istememiÅŸtim" ile karÅŸÄ±laÅŸmak.
KÃ¶tÃ¼: her adÄ±mda bir soru sorup akÄ±ÅŸÄ± kesmek.

## Plan formatÄ±

```
## Hedef
Tek cÃ¼mle. BittiÄŸinde ne doÄŸru olacak?

## BaÄŸlam
Mevcut durum: hangi dosyalar, hangi mekanizma, neden ÅŸu an yetersiz.

## YaklaÅŸÄ±m
SeÃ§ilen yol ve neden. Elenen alternatif varsa bir satÄ±r.

## AdÄ±mlar
1. <dosya/alan> â€” <yapÄ±lacak> â€” <bitti kriteri>
2. ...

## Riskler
- <ne bozulabilir> â†’ <nasÄ±l tespit ederiz>

## DoÄŸrulama
Somut: hangi komut, hangi ekran, hangi sayÄ±.

## Kapsam dÄ±ÅŸÄ±
BilinÃ§li olarak yapÄ±lmayacaklar.
```

## Ä°yi adÄ±m / kÃ¶tÃ¼ adÄ±m

**KÃ¶tÃ¼:** "Kodu temizle" Â· "PerformansÄ± iyileÅŸtir" Â· "Test ekle"
BunlarÄ±n bitti kriteri yok, Ã¶lÃ§Ã¼lemez.

**Ä°yi:** "`x.js`'teki Ã¼Ã§ kopya hazard formÃ¼lÃ¼nÃ¼ tek fonksiyona indir; Ã¼Ã§ Ã§aÄŸrÄ± noktasÄ± da
aynÄ± sonucu Ã¼retmeli, mevcut testler geÃ§meli."

## Fazlara bÃ¶lme

8+ adÄ±mlÄ± planÄ± fazlara bÃ¶l. **Her faz tek baÅŸÄ±na deÄŸer Ã¼retmeli ve durdurulabilir olmalÄ±** â€”
"faz 1 bitti ama faz 2 olmadan iÅŸe yaramÄ±yor" kÃ¶tÃ¼ bir bÃ¶lÃ¼nmedir.

## Plan bir sÃ¶zleÅŸmedir

Uygulama sÄ±rasÄ±nda plandan sapmak gerekiyorsa: dur, sapmayÄ± sÃ¶yle, onay al.
Sessizce farklÄ± bir ÅŸey yapmak, planÄ±n anlamÄ±nÄ± yok eder.

Yol Ã¼stÃ¼nde fark edilen ilgisiz iyileÅŸtirmeler plana eklenmez â€” not edilir, ayrÄ± iÅŸ olur.
