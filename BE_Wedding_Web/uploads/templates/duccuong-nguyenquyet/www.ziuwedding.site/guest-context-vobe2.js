(function () {
  function readGuestContext() {
    let params;
    try {
      params = new URLSearchParams(window.location.search || (window.parent && window.parent.location.search) || '');
    } catch (_e) {
      params = new URLSearchParams(window.location.search);
    }
    const invData = window.invitationData || {};

    let rawGuest = params.get('to') || params.get('guest') || params.get('guest_name') || params.get('gname') || '';
    if (!rawGuest && invData.guest_name) rawGuest = invData.guest_name;
    if (!rawGuest) {
      const stored = localStorage.getItem('guest_name');
      if (stored && stored !== 'Quý khách' && stored !== 'QUÝ KHÁCH') rawGuest = stored;
    }

    let guestName = '';
    if (rawGuest) {
      try {
        guestName = decodeURIComponent(rawGuest.replace(/\+/g, ' ')).trim();
      } catch (_e) {
        guestName = rawGuest.replace(/\+/g, ' ').trim();
      }
    }

    const guestId = params.get('gid') || params.get('guest_id') || invData.guest_id || localStorage.getItem('guest_id') || '';
    const invitationSlug = params.get('inv') || invData.invitation_slug || invData.slug || localStorage.getItem('invitation_slug') || '';

    if (guestId) localStorage.setItem('guest_id', guestId);
    if (guestName && guestName !== 'Quý khách' && guestName !== 'QUÝ KHÁCH') {
      localStorage.setItem('guest_name', guestName);
    }
    if (invitationSlug) localStorage.setItem('invitation_slug', invitationSlug);

    return { guestId, guestName, invitationSlug };
  }

  function updateInvitationText(guestName) {
    const guestHeadline = document.querySelector('#HEADLINE3 .ladi-headline') || document.querySelector('#HEADLINE3');
    if (!guestHeadline) return;

    let name = (guestName || (window.invitationData && window.invitationData.guest_name) || '').trim();
    if (!name || name === 'Quý khách' || name === 'QUÝ KHÁCH') {
      try {
        const p = new URLSearchParams(window.location.search || (window.parent && window.parent.location.search) || '');
        const qTo = p.get('to') || p.get('guest') || p.get('guest_name') || p.get('gname');
        if (qTo) {
          name = decodeURIComponent(qTo.replace(/\+/g, ' ')).trim();
        }
      } catch (_e) {}
    }

    const finalGuestName = name || 'Quý khách';
    guestHeadline.textContent = ` ${finalGuestName}`;
  }

  function wireEnvelopeClick(context) {
    const envelope = document.getElementById('GROUP1');
    if (!envelope) return;

    const targetFile = 'phongbibe2.html';
    envelope.setAttribute('href', targetFile);
    envelope.setAttribute('target', '_self');

    if (!envelope.__wwWired) {
      envelope.__wwWired = true;
      envelope.addEventListener('click', function (event) {
        event.preventDefault();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'wedding-web:navigate', file: targetFile }, '*');
        } else {
          window.location.href = targetFile;
        }
      });
    }
  }

  function conditionallyHideDecorationElements(context) {
    const line1 = document.getElementById('LINE1');
    const headline3 = document.getElementById('HEADLINE3');

    if (line1) line1.style.display = 'block';
    if (headline3) headline3.style.display = 'block';
  }

  function init() {
    const context = readGuestContext();
    updateInvitationText(context.guestName);
    wireEnvelopeClick(context);
    conditionallyHideDecorationElements(context);

    // Re-apply in case LadiPageScript.run overwrote it
    [60, 200, 600, 1500].forEach(function(delay) {
      setTimeout(function() {
        updateInvitationText(context.guestName);
      }, delay);
    });

    try {
      const h3El = document.querySelector('#HEADLINE3 .ladi-headline') || document.querySelector('#HEADLINE3');
      if (h3El && window.MutationObserver && context.guestName && context.guestName !== 'Quý khách') {
        if (!h3El.__wwObserved) {
          h3El.__wwObserved = true;
          const obs = new MutationObserver(function() {
            if (h3El.textContent.trim() !== context.guestName) {
              h3El.textContent = ` ${context.guestName}`;
            }
          });
          obs.observe(h3El, { childList: true, characterData: true, subtree: true });
        }
      }
    } catch (_e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
})();
