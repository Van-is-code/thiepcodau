(function () {
  var TOKEN_KEY = 'api_docs_bearer_token';
  var SECURITY_SCHEME = 'bearerAuth';

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function authorize(ui, token) {
    if (!ui || !token) {
      return false;
    }

    try {
      ui.authActions.authorize({
        [SECURITY_SCHEME]: {
          name: SECURITY_SCHEME,
          schema: {
            type: 'http',
            in: 'header',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          value: token
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  var attempts = 0;
  var maxAttempts = 40;

  var timer = setInterval(function () {
    attempts += 1;
    var token = getToken();
    var done = authorize(window.ui, token);

    if (done || attempts >= maxAttempts) {
      clearInterval(timer);
    }
  }, 250);
})();
