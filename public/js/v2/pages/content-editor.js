import { originalTranslation, contentPhrases } from '../i18n.js';

export async function renderContentEditor(ctx, container) {
  const { api, esc, language, toast, busy } = ctx;
  const ar = language === 'ar', text = (en, arabic) => esc(ar ? arabic : en);
  let data = await api('/api/admin/content');
  const names = { Header:'الهيدر', Hero:'القسم الرئيسي', 'Home sections':'أقسام الرئيسية', Footer:'الفوتر', Images:'الصور', Pages:'الصفحات', Settings:'الإعدادات' };
  const groups = [...new Set(data.catalog.map(field => field.group))];
  const value = (field, locale) => data.customized.includes(field.key) ? data.settings[field.key][locale] : locale === 'ar' && field.type === 'text' ? originalTranslation(field.source || field.default.en, 'ar') : field.default[locale];
  const input = (name, label, val = '', type = 'text') => `<label>${label}<input name="${name}" type="${type}" value="${esc(val)}" ${type === 'number' ? 'min="0" max="10000" step="1"' : ''}></label>`;
  const uploadField = current => `<div class="content-image-control">${input('image',text('Image path','مسار الصورة'),current)}<label>${text('Upload image','رفع صورة')}<input type="file" data-content-upload accept="image/png,image/jpeg,image/webp"></label><img class="content-image-preview" src="${esc(current || '/assets/logo.png')}" alt="${text('Image preview','معاينة الصورة')}" loading="lazy"></div>`;
  const record = (type, item = {}) => `<div class="content-record" data-record>${type === 'pages' ? `${input('slug',text('Page URL slug','اسم رابط الصفحة'),item.slug)}<div class="content-language-fields">${input('title_en','English title',item.title_en)}${input('title_ar','العنوان بالعربية',item.title_ar)}</div><div class="content-language-fields"><label>English content<textarea name="body_en" rows="7" maxlength="12000">${esc(item.body_en || '')}</textarea></label><label>المحتوى بالعربية<textarea name="body_ar" rows="7" maxlength="12000" dir="rtl">${esc(item.body_ar || '')}</textarea></label></div>${uploadField(item.image)}<label class="content-checkbox"><input name="published" type="checkbox" ${item.published ? 'checked' : ''}>${text('Published','منشورة')}</label><small>/pages/${esc(item.slug || 'page-name')}</small>` : `<div class="content-language-fields">${input('label_en','English label',item.label_en)}${input('label_ar','الاسم بالعربية',item.label_ar)}</div>${input('href',text('Link','الرابط'),item.href)}<label class="content-checkbox"><input name="visible" type="checkbox" ${item.visible !== false ? 'checked' : ''}>${text('Visible','ظاهر')}</label>`}<button type="button" data-remove-record class="small danger">${text('Remove','حذف')}</button></div>`;
  const fieldMarkup = field => {
    const en = value(field,'en'), arabic = value(field,'ar'), legend = esc(field.label);
    if (['pages','navigation','links'].includes(field.type)) {
      const items = JSON.parse(en);
      return `<fieldset class="content-field" data-key="${field.key}" data-kind="${field.type}"><legend>${legend}</legend><div data-record-list>${items.map(item => record(field.type,item)).join('')}</div><button type="button" data-add-record>${text(field.type === 'pages' ? 'Add page' : 'Add link',field.type === 'pages' ? 'إضافة صفحة' : 'إضافة رابط')}</button></fieldset>`;
    }
    if (field.type === 'boolean') return `<fieldset class="content-field" data-key="${field.key}" data-kind="boolean"><label class="content-checkbox"><input name="value" type="checkbox" ${en === 'true' ? 'checked' : ''}>${legend}</label></fieldset>`;
    if (field.type === 'image') return `<fieldset class="content-field" data-key="${field.key}" data-kind="image"><legend>${legend}</legend>${uploadField(en)}</fieldset>`;
    if (field.type !== 'text') return `<fieldset class="content-field" data-key="${field.key}" data-kind="${field.type}"><legend>${legend}</legend>${input('value',legend,en,field.type === 'number' ? 'number' : 'text')}</fieldset>`;
    return `<fieldset class="content-field" data-key="${field.key}" data-kind="text"><legend>${legend}</legend><div class="content-language-fields"><label>English<textarea name="en" maxlength="2000" rows="2">${esc(en)}</textarea></label><label>العربية<textarea name="ar" maxlength="2000" rows="2" dir="rtl">${esc(arabic)}</textarea></label></div></fieldset>`;
  };
  container.innerHTML = `<div class="content-editor"><p class="notice">${text('Changes are saved to the existing database. Save a section, then open the website to see the result. Text is displayed as text; no code or HTML is needed.','التغييرات تُحفظ في قاعدة البيانات الحالية. احفظ القسم وافتح الموقع لمعاينته. لا تحتاج لكتابة كود أو HTML.')} <a href="/" target="_blank" rel="noopener">${text('View website','معاينة الموقع')}</a></p>${groups.map((group,index) => `<details class="panel content-group" ${index === 0 ? 'open' : ''}><summary>${esc(ar ? names[group] : group)}</summary><form data-content-form>${data.catalog.filter(field => field.group === group).map(fieldMarkup).join('')}<div class="actions"><button type="submit" class="primary">${text('Save section','حفظ القسم')}</button><span data-save-state role="status"></span></div></form></details>`).join('')}<details class="panel content-group"><summary>${text('Other page text','نصوص الصفحات الأخرى')}</summary><p>${text('Use the current English phrase shown on the website, then enter its replacement in both languages.','اختر أو اكتب العبارة الإنجليزية الموجودة في الصفحة، ثم اكتب النص البديل باللغتين.')}</p><datalist id="content-phrases">${contentPhrases().map(phrase => `<option value="${esc(phrase)}"></option>`).join('')}</datalist><form id="content-copy-form"><div id="content-copy-rows"></div><div class="actions"><button type="button" id="content-add-copy">${text('Add text','إضافة نص')}</button><button type="submit" class="primary">${text('Save text','حفظ النصوص')}</button><span data-save-state role="status"></span></div></form></details><details class="panel content-group"><summary>${text('Image library','مكتبة الصور')}</summary><button type="button" id="content-load-media">${text('Load images','عرض الصور')}</button><p>${text('Select an image to copy its path into a logo, hero, feature or page image field.','اختار الصورة لنسخ مسارها لاستخدامها في اللوجو أو القسم الرئيسي أو الصفحات.')}</p><div id="content-media" class="content-media-grid"></div></details></div>`;
  const editor = container.querySelector('.content-editor');
  const intro = editor.querySelector('.notice');
  intro.className = 'content-editor-toolbar';
  intro.innerHTML = `<div><strong>${text('Edit your website', 'تعديل الموقع')}</strong><p>${text('Choose a section, update its content, then save your changes.', 'اختار القسم، عدل المحتوى، وبعدها احفظ التغييرات.')}</p></div><a class="button" href="/" target="_blank" rel="noopener">${text('Preview website', 'معاينة الموقع')} ↗</a>`;
  const layout = document.createElement('div');
  layout.className = 'content-editor-layout';
  const navigation = document.createElement('nav');
  navigation.className = 'content-section-nav';
  navigation.setAttribute('aria-label', ar ? 'أقسام محتوى الموقع' : 'Website content sections');
  const sections = document.createElement('div');
  sections.className = 'content-section-body';
  const panels = [...editor.querySelectorAll('.content-group')];
  const descriptions = [
    ['Navigation labels, links and visibility.', 'أسماء وروابط القائمة وإظهار العناصر.'],
    ['Main headline, welcome message and buttons.', 'العنوان الرئيسي ورسالة الترحيب والأزرار.'],
    ['Homepage sections, highlights and descriptions.', 'أقسام الصفحة الرئيسية والنصوص المميزة.'],
    ['Contact information, credits and footer links.', 'بيانات التواصل وروابط أسفل الصفحة.'],
    ['Brand logo and featured website images.', 'شعار الموقع والصور الرئيسية.'],
    ['Page titles and custom published or draft pages.', 'عناوين الصفحات والصفحات المنشورة والمسودات.'],
    ['Site details, delivery fee and order availability.', 'بيانات الموقع ورسوم التوصيل واستقبال الطلبات.'],
    ['Update other website phrases in both languages.', 'تعديل باقي نصوص الموقع باللغتين.'],
    ['Browse existing images and copy their paths.', 'تصفح الصور الموجودة ونسخ مساراتها.']
  ];
  const selectSection = index => {
    panels.forEach((panel, position) => { panel.hidden = position !== index; panel.open = position === index; });
    [...navigation.children].forEach((button, position) => {
      button.classList.toggle('is-active', position === index);
      if (position === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  };
  panels.forEach((panel, index) => {
    panel.id = `content-section-${index}`;
    const summary = panel.querySelector('summary');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = summary.textContent;
    button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => selectSection(index));
    navigation.append(button);
    summary.addEventListener('click', event => event.preventDefault());
    const description = document.createElement('p');
    description.className = 'content-section-description';
    description.textContent = descriptions[index]?.[ar ? 1 : 0] || '';
    summary.after(description);
    sections.append(panel);
    const form = panel.querySelector('form');
    if (form) {
      const state = form.querySelector('[data-save-state]');
      state.setAttribute('aria-live', 'polite');
      const markChanged = () => { state.textContent = ar ? 'تغييرات غير محفوظة' : 'Unsaved changes'; state.className = 'content-unsaved'; };
      form.addEventListener('input', markChanged);
      form.addEventListener('change', markChanged);
      form.addEventListener('click', event => {
        if (event.target.closest('[data-add-record],[data-remove-record],#content-add-copy,[data-remove-copy]')) markChanged();
      });
    }
  });
  layout.append(navigation, sections);
  editor.append(layout);
  selectSection(0);
  const copyRows = container.querySelector('#content-copy-rows');
  const copyRow = (source = '', entry = {}) => `<div class="content-record" data-copy-record><label>${text('Current English phrase','العبارة الإنجليزية الحالية')}<input name="source" list="content-phrases" maxlength="400" value="${esc(source)}" required></label><div class="content-language-fields">${input('en','English replacement',entry.en)}${input('ar','النص العربي البديل',entry.ar)}</div><button type="button" data-remove-copy>${text('Remove','حذف')}</button></div>`;
  copyRows.innerHTML = Object.entries(data.copy).map(([source,entry]) => copyRow(source,entry)).join('');
  const message = (form, value, error = false) => { const element = form.querySelector('[data-save-state]'); element.textContent = value; element.className = error ? 'error' : 'success'; };
  container.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-add-record')) { const field = button.closest('[data-key]'); field.querySelector('[data-record-list]').insertAdjacentHTML('beforeend',record(field.dataset.kind)); }
    if (button.hasAttribute('data-remove-record')) button.closest('[data-record]').remove();
    if (button.id === 'content-add-copy') copyRows.insertAdjacentHTML('beforeend',copyRow());
    if (button.hasAttribute('data-remove-copy')) button.closest('[data-copy-record]').remove();
    if (button.id === 'content-load-media') {
      try { await busy(button, async () => { const {media} = await api('/api/admin/content/media'); container.querySelector('#content-media').innerHTML = media.map(item => `<button type="button" data-media-path="${esc(item.url)}"><img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.name)}</span></button>`).join(''); }); } catch(error) { toast(error.message); }
    }
    if (button.dataset.mediaPath) {
      try { await navigator.clipboard.writeText(button.dataset.mediaPath); toast(ar ? 'تم نسخ مسار الصورة' : 'Image path copied'); }
      catch { const input = document.createElement('input'); input.readOnly = true; input.value = button.dataset.mediaPath; button.append(input); input.select(); }
    }
  });
  container.addEventListener('change', async event => {
    const fileInput = event.target.closest('[data-content-upload]'); if (!fileInput) return;
    const file = fileInput.files?.[0]; if (!file) return;
    if (file.size > 4 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) { toast(ar ? 'اختر صورة JPG أو PNG أو WebP بحجم أقل من 4 ميجا.' : 'Choose a JPG, PNG or WebP image up to 4 MB.'); fileInput.value = ''; return; }
    const form = fileInput.closest('form'), saveButton = form.querySelector('[type="submit"]'); fileInput.disabled = saveButton.disabled = true;
    try {
      const response = await fetch('/api/admin/uploads', { method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file });
      const result = await response.json(); if (!response.ok) throw Error(result.message || 'Upload failed.');
      const control = fileInput.closest('.content-image-control'); control.querySelector('[name="image"]').value = result.image_url; control.querySelector('img').src = result.image_url;
      message(form,ar ? 'تم رفع الصورة. احفظ القسم لنشرها.' : 'Image uploaded. Save the section to publish it.');
    } catch(error) { message(form,error.message,true); } finally { fileInput.disabled = saveButton.disabled = false; fileInput.value = ''; }
  });
  container.querySelectorAll('[data-content-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const entries = [...form.querySelectorAll('[data-key]')].map(field => {
      const kind = field.dataset.kind; let en, arabic;
      if (kind === 'text') { en = field.querySelector('[name="en"]').value; arabic = field.querySelector('[name="ar"]').value; }
      else if (['pages','navigation','links'].includes(kind)) {
        const records = [...field.querySelectorAll('[data-record]')].map(row => { const item = {}; row.querySelectorAll('input[name],textarea[name]').forEach(input => { item[input.name] = input.type === 'checkbox' ? input.checked : input.value; }); return item; }); en = arabic = JSON.stringify(records);
      } else if (kind === 'image') en = arabic = field.querySelector('[name="image"]').value;
      else en = arabic = kind === 'boolean' ? String(field.querySelector('[name="value"]').checked) : field.querySelector('[name="value"]').value;
      return {key:field.dataset.key,en,ar:arabic};
    });
    try { await busy(form.querySelector('[type="submit"]'), async () => { data = { ...data, ...await api('/api/admin/content',{method:'PUT',body:{entries}}) }; message(form,ar ? 'تم حفظ القسم.' : 'Section saved.'); }); }
    catch(error) { message(form,error.fields?.[0]?.message || error.message,true); }
  }));
  container.querySelector('#content-copy-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const entries = [...copyRows.querySelectorAll('[data-copy-record]')].map(row => Object.fromEntries([...row.querySelectorAll('input[name]')].map(input => [input.name,input.value])));
    try { await busy(form.querySelector('[type="submit"]'),async()=> { await api('/api/admin/content/copy',{method:'PUT',body:{entries}}); message(form,ar ? 'تم حفظ النصوص.' : 'Text saved.'); }); } catch(error) { message(form,error.fields?.[0]?.message || error.message,true); }
  });
}
