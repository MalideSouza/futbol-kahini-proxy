const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';
const LEAGUE_CODE = 'CL'; // Şampiyonlar Ligi

const fetchData = async (endpoint) => {
  if (!API_KEY) {
    throw new Error("API anahtarı sunucuda tanımlanmamış.");
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error(`API'den hata alındı (${endpoint}):`, errorData);
    throw new Error(errorData.message || `API endpoint'i (${endpoint}) çalışmadı.`);
  }

  return response.json();
};

// Planlanmış maçları çeken endpoint
app.get("/getFixtures", async (req, res) => {
  try {
    const data = await fetchData(`/competitions/${LEAGUE_CODE}/matches?status=SCHEDULED`);
    const fixtures = data.matches.map(match => ({
        id: match.id,
        rawDate: match.utcDate,
        matchday: match.matchday,
        group: `${(match.group || 'Eleme Turu').replace('GROUP_', 'Grup ')}`,
        date: new Date(match.utcDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        homeTeam: { name: match.homeTeam.name, logoUrl: match.homeTeam.crest },
        awayTeam: { name: match.awayTeam.name, logoUrl: match.awayTeam.crest }
    }));
    res.json(fixtures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Biten maçları çeken endpoint
app.get("/getFinishedMatches", async (req, res) => {
  try {
    const data = await fetchData(`/competitions/${LEAGUE_CODE}/matches?status=FINISHED`);
    // Sadece son 5 biten maçı gönderiyoruz
    res.json(data.matches.slice(-5)); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gol krallığını çeken endpoint
app.get("/getScorers", async (req, res) => {
  try {
    const data = await fetchData(`/competitions/${LEAGUE_CODE}/scorers`);
     // Sadece ilk 10 golcüyü gönderiyoruz
    res.json(data.scorers.slice(0, 10));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Futbol Kahini aracı sunucusu ${port} portunda çalışıyor.`);
});




