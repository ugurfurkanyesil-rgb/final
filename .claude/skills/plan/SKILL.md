---
name: plan
description: Bir işe başlamadan önce plan çıkarmak için kullan. Yeni özellik, refactor, migrasyon veya kapsamı belirsiz herhangi bir istekte devreye gir. Plan olmadan büyük değişikliğe girişilmesini engeller.
---

# Planlama Disiplini

## Plan ne zaman gerekir

| Durum | Plan? |
|---|---|
| Tek dosyada, geri alması kolay, açık bir düzeltme | Hayır — yap |
| 3+ dosyaya dokunuyor | Evet |
| Mevcut bir davranışı değiştiriyor | Evet |
| Kapsamı belirsiz ("şunu iyileştirelim") | Evet — önce netleştir |
| Geri alması zor (veri şeması, dosya taşıma) | Evet |

## Belirsizliği önce çöz

Plan yazmadan önce cevabı olmayan soru bırakma. Sorularını **tek seferde** sor, en fazla üç tane.

Kötü: varsayıp devam etmek, sonra "aslında öyle demek istememiştim" ile karşılaşmak.
Kötü: her adımda bir soru sorup akışı kesmek.

## Plan formatı

```
## Hedef
Tek cümle. Bittiğinde ne doğru olacak?

## Bağlam
Mevcut durum: hangi dosyalar, hangi mekanizma, neden şu an yetersiz.

## Yaklaşım
Seçilen yol ve neden. Elenen alternatif varsa bir satır.

## Adımlar
1. <dosya/alan> — <yapılacak> — <bitti kriteri>
2. ...

## Riskler
- <ne bozulabilir> → <nasıl tespit ederiz>

## Doğrulama
Somut: hangi komut, hangi ekran, hangi sayı.

## Kapsam dışı
Bilinçli olarak yapılmayacaklar.
```

## İyi adım / kötü adım

**Kötü:** "Kodu temizle" · "Performansı iyileştir" · "Test ekle"
Bunların bitti kriteri yok, ölçülemez.

**İyi:** "`x.js`'teki üç kopya hazard formülünü tek fonksiyona indir; üç çağrı noktası da
aynı sonucu üretmeli, mevcut testler geçmeli."

## Fazlara bölme

8+ adımlı planı fazlara böl. **Her faz tek başına değer üretmeli ve durdurulabilir olmalı** —
"faz 1 bitti ama faz 2 olmadan işe yaramıyor" kötü bir bölünmedir.

## Plan bir sözleşmedir

Uygulama sırasında plandan sapmak gerekiyorsa: dur, sapmayı söyle, onay al.
Sessizce farklı bir şey yapmak, planın anlamını yok eder.

Yol üstünde fark edilen ilgisiz iyileştirmeler plana eklenmez — not edilir, ayrı iş olur.