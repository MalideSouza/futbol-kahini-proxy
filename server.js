const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());

// --- YENİ: FIREBASE ADMIN KURULUMU ---
// Bu, sunucumuzun Firestore veritabanına erişmesini ve puanları yazmasını sağlar.
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// --- BİTİŞ: FIREBASE ADMIN KURULUMU ---


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

// ... (getFixtures, getFinishedMatches, getScorers endpoint'leri burada değişiklik olmadan yer alıyor)
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

app.get("/getFinishedMatches", async (req, res) => {
  try {
    const data = await fetchData(`/competitions/${LEAGUE_CODE}/matches?status=FINISHED`);
    res.json(data.matches.slice(-5)); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/getScorers", async (req, res) => {
  try {
    const data = await fetchData(`/competitions/${LEAGUE_CODE}/scorers`);
    res.json(data.scorers.slice(0, 10));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- YENİ: PUANLAMA MOTORU ENDPOINT'İ ---
// Bu endpoint, Render'ın zamanlanmış görevi tarafından tetiklenecek.
app.post("/calculate-scores", async (req, res) => {
    // Güvenlik: Sadece Render'ın Cron Job'ından gelen istekleri kabul et
    if (req.headers["x-render-cron-job-secret"] !== process.env.CRON_SECRET) {
        return res.status(401).send("Yetkisiz erişim.");
    }

    console.log("Puanlama motoru çalıştırıldı.");

    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateFrom = yesterday.toISOString().split('T')[0];
        const dateTo = today.toISOString().split('T')[0];

        // Dün ve bugün biten maçları çek
        const finishedMatchesData = await fetchData(`/competitions/${LEAGUE_CODE}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`);
        const finishedMatches = finishedMatchesData.matches;
        
        if (finishedMatches.length === 0) {
            console.log("Hesaplanacak yeni maç bulunamadı.");
            return res.status(200).send("Hesaplanacak yeni maç yok.");
        }

        for (const match of finishedMatches) {
            const matchId = String(match.id);
            console.log(`Puanlar hesaplanıyor: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
            
            // Bu maça tahmin yapan tüm kullanıcıları bul
            const predictionsSnapshot = await db.collection('predictions').where('matchId', '==', match.id).get();
            
            if (predictionsSnapshot.empty) {
                console.log(`Maç ${matchId} için tahmin bulunamadı.`);
                continue;
            }

            predictionsSnapshot.forEach(async (predDoc) => {
                const prediction = predDoc.data();
                const userId = predDoc.ref.parent.parent.id; // Tahminin sahibini bul
                
                let points = 0;
                const predHome = prediction.homeScore;
                const predAway = prediction.awayScore;
                const realHome = match.score.fullTime.home;
                const realAway = match.score.fullTime.away;

                // Kurallara göre puanları hesapla
                if (predHome === realHome && predAway === realAway) {
                    points = 15; // Skor bilme
                } else if ((predHome > predAway && realHome > realAway) || (predHome < predAway && realHome < realAway) || (predHome === predAway && realHome === realAway)) {
                    points = 5; // Taraf bilme
                }

                if (points > 0) {
                    const userRef = db.collection('users').doc(userId);
                    // Firestore'un özel 'increment' fonksiyonu ile puanı güvenli bir şekilde ekle
                    await userRef.update({
                        totalScore: admin.firestore.FieldValue.increment(points)
                    });
                    console.log(`Kullanıcı ${userId}, ${matchId} maçı için ${points} puan kazandı.`);
                }
            });
        }
        
        res.status(200).send("Puanlar başarıyla hesaplandı.");

    } catch (error) {
        console.error("Puanlama motorunda hata oluştu:", error);
        res.status(500).json({ error: "Puanlama sırasında bir hata oluştu." });
    }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Futbol Kahini aracı sunucusu ${port} portunda çalışıyor.`);
});

