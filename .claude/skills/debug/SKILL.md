---
name: debug
description: Bir şey beklendiği gibi çalışmadığında sistematik teşhis için kullan. Hata mesajı, görsel artefakt, yanlış sayı, "önce çalışıyordu şimdi çalışmıyor" durumlarında devreye gir.
---

# Sistematik Hata Ayıklama

## Altın kural

**Semptomu değil, kök nedeni düzelt.** Ekranda yanlış sayı görünüyorsa, sayıyı düzeltmek
çözüm değildir — o sayının neden yanlış hesaplandığını bul.

İkinci kural: **tahmin etme, ölç.** Her hipotez bir deneyle elenir ya da doğrulanır.

## Sıra

### 1. Yeniden üret
Sorunu güvenilir şekilde tekrar üretemiyorsan, düzelttiğini de doğrulayamazsın.
En küçük tekrarlanabilir senaryoyu bul.

### 2. Değişikliği izole et — regresyon mu?
"Önce çalışıyordu" deniyorsa **bunu doğrula, varsayma:**
```
git stash          # değişiklikleri geçici kaldır
# senaryoyu tekrar çalıştır
git stash pop
```
veya `git show HEAD:<dosya>` ile önceki hâli karşılaştır.

Sorun eski kodda da varsa, bu bir regresyon değildir — suçu son değişikliğe atma.
Bu adım atlanınca yanlış yerde saatler harcanır.

### 3. Değişiklik hedefe ulaşıyor mu?
Kod düzeltildi ama davranış aynıysa, önce şunu ele:
- Sunucu/derleyici gerçekten yeni kodu mu servis ediyor? (`curl` ile diskteki dosyayla karşılaştır)
- Birden fazla süreç mi çalışıyor? Port karışıklığı var mı?
- Cache/HMR yakalamış mı? Sert yenileme yapıldı mı?
- Doğru dosyaya mı bakıyorsun? (aynı isimli iki dosya, kopya klasör)

Bu, "kodda hata yok ama davranış değişmiyor" durumlarının en sık sebebidir.

### 4. Üretilen şey kullanılıyor mu?
Bir değer/varlık üretiliyor ama hiçbir tüketiciye bağlanmamış olabilir.
Üretim fonksiyonunda ne yaparsan yap sonuç değişmez.
`grep` ile: bu değeri kim okuyor? Gerçekten bir yere gidiyor mu?

### 5. İkiye bölerek daralt
Sorunun hangi katmanda olduğunu ikiye bölerek bul: veri mi, hesap mı, sunum mu?
Her katmanın çıktısını ayrı ayrı incele. `git bisect` uzun geçmişlerde işe yarar.

### 6. Hipotezi test et
Her hipotez için: bu doğruysa **ne gözlemlemeliyim?**
Küçük, izole bir deney kur (mini grid, tek fonksiyon çağrısı, bağımsız render).
Gözlem hipotezle uyuşmuyorsa hipotezi bırak — zorlama.

### 7. Kök nedeni doğrula
Düzeltmeden önce açıklaman **tüm** semptomları açıklıyor mu?
Bir kısmını açıklıyorsa muhtemelen iki ayrı sorun var, ya da yanlış nedeni buldun.

## Yaygın yanılgılar

- **"İstatistik testi geçti, demek ki doğru."** Sayısal test görsel/davranışsal doğruluğu
  garanti etmez. Gerçek çıktıya bak.
- **"Hipotezim mantıklı, muhtemelen budur."** Ölçmeden geçme.
- **"Düzelttim, bitti."** Kendi düzeltmen yeni bir bug getirebilir; düzeltmeyi de test et.
- **"Yorum böyle diyor."** Yorum yanlış olabilir. Kod ne yapıyor, ona bak.

## Bulunca

Kök nedeni, kanıtı ve düzeltmeyi birlikte belgele.
Aynı sınıftan başka yerlerde de aynı hata var mı — bir kez bakmaya değer.
Genelleştirilebilir bir ders varsa yaz; bir dahakine aranan yer orası olur.