const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../server/services/site-content');
const { hasRole, primaryRole } = require('../server/services/roles');
const same = (key,value) => ({key,en:value,ar:value});

test('Owner is a business role and never implicitly grants administrator privileges', () => {
  const owner={role:'owner',roles:['owner','driver']};
  assert.equal(hasRole(owner,'owner'),true);assert.equal(hasRole(owner,'driver'),true);assert.equal(hasRole(owner,'admin'),false);
  assert.equal(primaryRole(owner.roles),'owner');
  assert.equal(hasRole({role:'admin',roles:['owner']},'admin'),false);
  assert.equal(hasRole({role:'admin',roles:['admin']},'owner'),false);
});

test('Website settings are allowlisted and links cannot execute scripts or expose credentials', () => {
  assert.throws(()=>content.entriesSchema.parse([same('SQLSERVER_PASSWORD','anything')]));
  for (const value of ['javascript:alert(1)','data:text/html,bad','//example.com','https://user:password@example.com','file:///C:/Windows']) assert.equal(content.safeLink(value),false,value);
  for (const value of ['/menu','/pages/about','https://example.com/about']) assert.equal(content.safeLink(value),true,value);
  assert.throws(()=>content.entriesSchema.parse([same('business.delivery_fee','-1')]));
  assert.throws(()=>content.entriesSchema.parse([same('business.delivery_fee','2.5')]));
  assert.throws(()=>content.entriesSchema.parse([same('business.accept_orders','yes')]));
  assert.throws(()=>content.entriesSchema.parse([same('asset.hero','/uploads/../server/app.js')]));
  assert.throws(()=>content.entriesSchema.parse([same('hero.title','a'),same('hero.title','b')]));
  assert.doesNotThrow(()=>content.entriesSchema.parse([{key:'hero.title',en:'A literal <script> tag',ar:'Safe text'}]));
});

test('Custom page slugs, publication state and navigation receive server validation', () => {
  const page={slug:'about-pizza',title_en:'About',title_ar:'',body_en:'Text',body_ar:'',published:false,image:''};
  assert.doesNotThrow(()=>content.entriesSchema.parse([same('pages',JSON.stringify([page]))]));
  assert.throws(()=>content.entriesSchema.parse([same('pages',JSON.stringify([page,page]))]));
  assert.throws(()=>content.entriesSchema.parse([same('pages',JSON.stringify([{...page,slug:'../admin'}]))]));
  const link={label_en:'Admin',label_ar:'',href:'/admin',visible:true};
  assert.throws(()=>content.entriesSchema.parse([same('header.extra_links',JSON.stringify([link]))]));
  assert.throws(()=>content.copySchema.parse([{source:'x'.repeat(401),en:'a',ar:'b'}]));
  assert.throws(()=>content.copySchema.parse([{source:'Menu',en:'a',ar:'b'},{source:'menu',en:'c',ar:'d'}]));
});
