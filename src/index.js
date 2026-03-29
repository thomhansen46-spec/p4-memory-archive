const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

console.log("🚀 DEPLOY TEST");

app.use(cors());
app.use(express.json());

// ✅ ROUTES (MUST COME FIRST)
const sessionLog = require('./routes/session-log');
app.use('/api/session-log', sessionLog);

// ✅ STATIC + FRONTEND
app.use(express.static(__dirname + '/../'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../index.html');
});

// ✅ NOTION API
app.post('/api/add', async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: {
          database_id: process.env.NOTION_DATABASE_ID
        },
        properties: {
          Prompt: {
            title: [{ text: { content: prompt } }]
          },
          Response: {
            rich_text: [{ text: { content: "Logged from system" } }]
          }
        }
      })
    });

    res.json({ message: 'Saved to Notion ✅' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving' });
  }
});

// ✅ PORT (RENDER SAFE)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));