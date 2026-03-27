const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(''));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../index.html');
});
 

require('./routes/sessions')(app);
require('./routes/assets')(app);
require('./routes/sops')(app);
require('./routes/sequences')(app);
require('./routes/seeds')(app);
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
