const express = require('express');
const { Client } = require('pg');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express(); // Upewniamy się, że app jest zdefiniowane PRZED użyciem
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const logMessages = [];

// 🔌 Konfiguracja bazy
const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function startServer() {
  try {
    await client.connect();
    const dbMessage = 'Połączono z bazą PostgreSQL.';
    console.log(dbMessage);
    logMessages.push(dbMessage);

    // 🔍 Endpoint główny
    app.get('/', (req, res) => {
      const messages = [...logMessages, 'Serwer działa!', `🌐 Port: ${PORT}`];
      res.send(`
        <html>
          <head><title>Logi serwera</title></head>
          <body>
            <h1>Logi:</h1>
            <ul>${messages.map(m => `<li>${m}</li>`).join('')}</ul>
          </body>
        </html>
      `);
    });

    // Pobierz teksty
    app.get('/texts', async (req, res) => {
      try {
        const result = await client.query('SELECT id, content, sentiment FROM texts ORDER BY id DESC LIMIT 10');
        res.json(result.rows);
      } catch (err) {
        console.error('Błąd SELECT:', err.message);
        res.status(500).json({ error: 'Błąd pobierania danych' });
      }
    });

    // Dodaj tekst
    app.post('/add', async (req, res) => {
      try {
        console.log('Odebrano żądanie POST /add');
        const { content } = req.body;
        console.log('Treść dodana:', content);

        if (!content || content.trim().length === 0) {
          return res.status(400).json({ error: 'Content cannot be empty' });
        }

        const result = await client.query(
          'INSERT INTO texts (content, sentiment) VALUES ($1, NULL) RETURNING id',
          [content]
        );

        const newId = result.rows[0].id;
        console.log('Nowy ID:', newId);
        res.json({ id: newId });
      } catch (err) {
        console.error('Błąd dodawania:', err.message);
        res.status(500).json({ error: 'Błąd dodawania: ' + err.message });
      }
    });

    // Analiza AI
    app.get('/analyze/:id', async (req, res) => {
      try {
        const textId = req.params.id;
        const result = await client.query('SELECT content FROM texts WHERE id = $1', [textId]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Nie znaleziono tekstu' });
        }

        const { content } = result.rows[0];
        console.log(`Analiza ID=${textId}: "${content}"`);

        const hfResponse = await fetch(
          'https://api-inference.huggingface.co/models/nlptown/bert-base-multilingual-uncased-sentiment',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.HF_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: content })
          }
        );

        const textResult = await hfResponse.text();
        console.log('Surowa odpowiedź z API:', textResult);

        let resultAI;
        try {
          resultAI = JSON.parse(textResult);
        } catch (err) {
          console.error('Nieprawidłowy JSON z API');
          return res.status(500).json({ error: 'Model AI zwrócił niepoprawną odpowiedź' });
        }

        let label = 'UNKNOWN';

        if (Array.isArray(resultAI) && resultAI.length > 0 && Array.isArray(resultAI[0])) {
          const sorted = resultAI[0].sort((a, b) => b.score - a.score);
          const best = sorted[0];
          console.log('Najlepszy wynik:', best);

          const stars = parseInt(best.label);
          if (!isNaN(stars)) {
            if (stars >= 4) label = 'POSITIVE';
            else if (stars === 3) label = 'NEUTRAL';
            else label = 'NEGATIVE';
          }
        }

        await client.query('UPDATE texts SET sentiment = $1 WHERE id = $2', [label, textId]);
        console.log(`Zapisano sentyment: ${label}`);
        res.json({ id: textId, sentiment: label });
      } catch (err) {
        console.error('Błąd analizy:', err.message);
        res.status(500).json({ error: 'Błąd podczas analizy: ' + err.message });
      }
    });

    // 🚀 Uruchom serwer
    const { exec } = require('child_process');
    app.listen(PORT, () => {
      const msg = `Serwer działa: http://localhost:${PORT}`;
      console.log(msg);
      logMessages.push(msg);
      exec(`start http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Błąd połączenia z bazą danych:', err.stack);
    process.exit(1);
  }
}

startServer();
