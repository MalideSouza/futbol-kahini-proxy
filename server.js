// Gerekli kütüphaneleri dahil ediyoruz
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors"); // Farklı domain'den istek gelmesine izin vermek için

const app = express();
app.use(cors()); // CORS'u etkinleştiriyoruz

// Ana API rotamız
app.get("/getFixtures", async (req, res) => {
  // API Anahtarını güvenli ortam değişkenlerinden alıyoruz
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API anahtarı sunucuda tanımlanmamış." });
  }

  const leagueCode = 'CL'; // Şampiyonlar Ligi
  const apiUrl = `https://api.football-data.org/v4/competitions/${leagueCode}/matches?status=SCHEDULED`;

  try {
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Auth-Token': apiKey,
      }
    });

    const responseData = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error("API'den hata alındı:", responseData);
        return res.status(apiResponse.status).json({ error: responseData.message || "API'den veri çekilirken bir sorun oluştu." });
    }

    // Veriyi web sitemizin anlayacağı formata dönüştürüyoruz
    const fixtures = responseData.matches.map(match => ({
        id: match.id,
        group: `${(match.group || 'Eleme Turu').replace('GROUP_', 'Grup ')} - ${match.matchday}. Hafta`,
        date: new Date(match.utcDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', 'year': 'numeric' }),
        homeTeam: {
            name: match.homeTeam.name,
            logoUrl: match.homeTeam.crest
        },
        awayTeam: {
            name: match.awayTeam.name,
            logoUrl: match.awayTeam.crest
        }
    }));
    
    res.json(fixtures); // Veriyi web sitemize gönderiyoruz

  } catch (error) {
    console.error("Sunucuda bir hata oluştu:", error);
    res.status(500).json({ error: "Fikstürler çekilirken beklenmedik bir hata oluştu." });
  }
});

// Sunucuyu dinlemeye başlıyoruz
const port = process.env.PORT || 3000;
const listener = app.listen(port, () => {
  console.log("Futbol Kahini aracı sunucusu " + listener.address().port + " portunda çalışıyor.");
});



