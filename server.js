// Gerekli kütüphaneleri dahil ediyoruz
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors"); // Farklı domain'den istek gelmesine izin vermek için

const app = express();
app.use(cors()); // CORS'u etkinleştiriyoruz

// Ana API rotamız
app.get("/getFixtures", async (req, res) => {
  // API Anahtarını güvenli .env dosyasından alıyoruz
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API anahtarı sunucuda tanımlanmamış." });
  }

  const leagueId = '203'; // Süper Lig ID
  const season = new Date().getFullYear();
  const apiUrl = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}`;

  try {
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });

    const responseData = await apiResponse.json();

    // Hata kontrolü
    if (responseData.errors && (Object.keys(responseData.errors).length > 0 || responseData.errors.token) ) {
        console.error("API'den hata alındı:", responseData.errors);
        return res.status(500).json({ error: "API'den veri çekilirken bir sorun oluştu. API anahtarınızı veya aboneliğinizi kontrol edin." });
    }

    // Veriyi web sitemizin anlayacağı formata dönüştürüyoruz
    const fixtures = responseData.response.map(fixture => ({
      id: fixture.fixture.id,
      rawDate: fixture.fixture.date,
      group: `Süper Lig - ${fixture.league.round.replace('Regular Season - ', '')}. Hafta`,
      date: new Date(fixture.fixture.date).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      homeTeam: {
        name: fixture.teams.home.name,
        logoUrl: fixture.teams.home.logo
      },
      awayTeam: {
        name: fixture.teams.away.name,
        logoUrl: fixture.teams.away.logo
      }
    }));
    
    res.json(fixtures); // Veriyi web sitemize gönderiyoruz

  } catch (error) {
    console.error("Sunucuda bir hata oluştu:", error);
    res.status(500).json({ error: "Fikstürler çekilirken beklenmedik bir hata oluştu." });
  }
});

// Sunucuyu dinlemeye başlıyoruz
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Futbol Kahini aracı sunucusu " + listener.address().port + " portunda çalışıyor.");
});

