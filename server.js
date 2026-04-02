'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

app.get('/', (req, res) => {
res.send('P4 Memory Archive running v2');
});

app.get('/test', (req, res) => {
res.send('TEST OK');
});

app.post('/save-session', async (req, res) => {
const { prompt, response, tags } = req.body;
const { data, error } = await supabase
.from('sessions')
.insert([{ prompt, response, tags }]);
if (error) return res.status(500).json({ error });
res.json({ success: true, data });
});

app.get('/sessions', async (req, res) => {
const { data, error } = await supabase
.from('sessions')
.select('*')
.order('created_at', { ascending: false });
if (error) {
console.log(error);
return res.status(500).json({ error });
}
res.json(data);
});

require('./src/routes/fda-pipeline')(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
