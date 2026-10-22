const express = require('express');
const { z } = require('zod');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../db');
const content = require('../services/site-content');
const router = express.Router();
router.get('/', async (req, res) => res.json({ ...await content.read(db), catalog: content.fields }));
router.put('/', async (req, res) => {
  const { entries } = z.object({ entries: content.entriesSchema }).strict().parse(req.body);
  res.json(await content.save(db, entries));
});
router.put('/copy', async (req, res) => {
  const { entries } = z.object({ entries: content.copySchema }).strict().parse(req.body);
  await db.transaction(async trx => {
    await trx('site_copy').del();
    if (entries.length) await trx('site_copy').insert(entries.map(entry => ({ source_text: entry.source, value_en: entry.en, value_ar: entry.ar })));
  });
  res.json({ copy: (await content.read(db)).copy });
});
router.get('/media', async (req, res) => {
  const media = [];
  const walk = async (dir, url, depth = 0) => {
    let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && depth < 2) await walk(path.join(dir, entry.name), `${url}/${entry.name}`, depth + 1);
      else if (entry.isFile() && /\.(?:png|jpe?g|webp|gif|avif)$/i.test(entry.name) && media.length < 300) media.push({ url: `${url}/${entry.name}`, name: entry.name });
    }
  };
  await walk(path.resolve(__dirname, '../../public/assets'), '/assets');
  await walk(path.resolve(__dirname, '../../public/uploads'), '/uploads');
  res.json({ media });
});
module.exports = router;
