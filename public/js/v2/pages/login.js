export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

function login() {
  const errors = {
    google_network: ['The server could not connect to Google. Please try again or contact the restaurant.', 'تعذر اتصال السيرفر بجوجل. حاول مجددًا أو تواصل مع المطعم.'],
    google_credentials: ['Google sign-in settings need to be checked by the restaurant.', 'إعدادات تسجيل جوجل تحتاج مراجعة من المطعم.'],
    google_retry: ['This sign-in attempt has expired. Please start again using the button below.', 'محاولة تسجيل الدخول انتهت. ابدأ من جديد باستخدام الزر بالأسفل.'],
    google: ['Google sign-in could not be completed. Please try again.', 'تعذر إكمال تسجيل الدخول بجوجل. حاول مجددًا.']
  };
  const error = errors[new URLSearchParams(location.search).get('error')];
  page('Sign in', 'Place orders and keep your favourites close.').innerHTML =
    (error ? `<p class="notice" role="alert">${esc(error[language === 'ar' ? 1 : 0])}</p>` : '') +
    (config.googleEnabled ? `<a href="/auth/google" class="button primary">${tr('Continue with Google')} ↗</a>` : `<p class="notice">${tr('Google sign-in needs to be configured by the restaurant.')}</p>`);
}

  return login();
}
