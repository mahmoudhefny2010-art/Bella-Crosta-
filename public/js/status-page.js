(() => {
  const byId = id => document.getElementById(id);
  const copy = {
    offline: {
      title: 'أنت غير متصل بالإنترنت',
      message: 'سلتك محفوظة على هذا الجهاز. اتصل بالإنترنت لعرض القائمة الحالية وإتمام طلبك.',
      action: 'حاول مجددًا', home: 'العودة إلى بيلا كروستا', note: 'سلتك المحفوظة هتكون موجودة لما ترجع للإنترنت.',
      brand: 'بيلا <span>كروستا</span>', pageTitle: 'بيلا كروستا · غير متصل'
    },
    notFound: {
      title: 'الصفحة دي مش موجودة',
      message: 'ممكن تكون الصفحة اتنقلت أو العنوان مكتوب غلط. ارجع لموقع بيلا كروستا وكمل التصفح.',
      home: 'العودة للرئيسية', back: 'ارجع للصفحة السابقة', code: 'خطأ · 404',
      brand: 'بيلا <span>كروستا</span>', pageTitle: 'بيلا كروستا · الصفحة غير موجودة'
    },
    server: {
      title: 'حصلت مشكلة مؤقتة',
      message: 'حصل خطأ أثناء تحميل الصفحة. حاول مرة أخرى بعد قليل.',
      action: 'حاول مجددًا', home: 'العودة للرئيسية', code: 'خطأ مؤقت · 500',
      brand: 'بيلا <span>كروستا</span>', pageTitle: 'بيلا كروستا · خطأ مؤقت'
    }
  };
  let language = 'en';
  try { language = localStorage.getItem('bella_language') === 'ar' ? 'ar' : 'en'; } catch {}
  if (language === 'ar') {
    const view = location.pathname.endsWith('/offline.html') ? 'offline' : location.pathname.endsWith('/500.html') ? 'server' : 'notFound';
    const text = copy[view];
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.title = text.pageTitle;
    document.querySelector('.status-brand').innerHTML = text.brand;
    document.querySelector('.status-logo').alt = 'شعار بيلا كروستا';
    byId('status-title').textContent = text.title;
    byId('status-message').textContent = text.message;
    if (byId('retry-button')) byId('retry-button').textContent = text.action;
    if (byId('home-link')) byId('home-link').textContent = text.home;
    if (byId('back-button')) byId('back-button').textContent = text.back;
    if (byId('status-note')) byId('status-note').textContent = text.note;
    if (document.querySelector('.status-code')) document.querySelector('.status-code').textContent = text.code;
  }
  document.querySelector('[data-status-action="retry"]')?.addEventListener('click', () => location.reload());
  document.querySelector('[data-status-action="back"]')?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.assign('/');
  });
})();
